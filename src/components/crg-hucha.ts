import { css, html, LitElement, nothing } from 'lit';
import type { Temporada } from '../data/temporadas-demo';
import { leerImporteHucha, resumirHucha } from '../lib/hucha';
import { euros, fechaCorta } from '../lib/presentacion';
import { fechaEnMadrid } from '../lib/reglas';
import type { GestionarStaff } from '../lib/supabase';

const filtros = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'ingreso', nombre: 'Ingresos' },
  { id: 'gasto', nombre: 'Gastos' },
] as const;
type Filtro = (typeof filtros)[number]['id'];

class CrgHucha extends LitElement {
  static properties = {
    temporada: { attribute: false },
    gestionar: { attribute: false },
    filtro: { state: true },
    edicion: { state: true },
    importe: { state: true },
    motivo: { state: true },
    fecha: { state: true },
    guardando: { state: true },
    error: { state: true },
  };
  declare temporada: Temporada;
  declare gestionar?: GestionarStaff;
  declare private filtro: Filtro;
  declare private edicion?: 'gasto' | 'inicial';
  declare private importe: string;
  declare private motivo: string;
  declare private fecha: string;
  declare private guardando: boolean;
  declare private error: string;

  constructor() {
    super();
    this.filtro = 'todos';
    this.importe = '';
    this.motivo = '';
    this.fecha = '';
    this.guardando = false;
    this.error = '';
  }

  static styles = css`
    :host {
      display: block;
    }
    h1,
    h2,
    h3,
    p,
    dl,
    dd {
      margin: 0;
    }
    .bote {
      position: relative;
      overflow: hidden;
      padding: 1.1rem;
      border-radius: 1.4rem;
      color: white;
      background: linear-gradient(125deg, var(--color-tarjeta-oscura) 45%, #2e2339);
      box-shadow: 0 10px 25px rgb(15 23 42 / 11%);
    }
    .bote h1 {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.035em;
    }
    .temporada {
      margin-top: 0.25rem;
      color: #d2d9ea;
      font: 600 0.78rem var(--fuente-etiqueta);
    }
    .total {
      display: block;
      margin: 0.55rem 0 0.85rem;
      font: 700 clamp(2.15rem, 8.6vw, 3.2rem) var(--fuente-etiqueta);
      letter-spacing: -0.05em;
    }
    .bote img {
      position: absolute;
      top: 1rem;
      right: 0.86rem;
      width: 5rem;
      height: 5rem;
      object-fit: contain;
    }
    .balance {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
    }
    .balance div {
      padding: 0.6rem;
      border: 1px solid rgb(255 255 255 / 16%);
      background: rgb(255 255 255 / 10%);
      border-radius: 0.75rem;
    }
    dt {
      color: #e4e9f5;
      font: 700 0.73rem var(--fuente-etiqueta);
    }
    dd {
      margin-top: 0.25rem;
      font: 700 1.03rem var(--fuente-etiqueta);
    }
    section + section {
      margin-top: 1.25rem;
    }
    h2 {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    h2 span {
      font: 600 0.83rem var(--fuente-etiqueta);
      color: var(--color-gris);
      margin-inline-start: 0.35rem;
    }
    .filtros {
      margin: 0.65rem 0 0.8rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    button {
      min-height: 44px;
      padding: 0.3rem 0.8rem;
      border: 1px solid var(--color-borde);
      border-radius: 999px;
      background: var(--color-suave);
      color: var(--color-primario);
      font: 700 0.79rem var(--fuente-texto);
      cursor: pointer;
    }
    button[aria-pressed='true'] {
      color: white;
      background: var(--color-tarjeta-oscura);
      border-color: transparent;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.45rem;
    }
    li {
      display: grid;
      grid-template-columns: 2.45rem minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.6rem;
      min-height: 3.4rem;
      padding: 0.5rem 0.7rem;
      border-radius: var(--radio-tarjeta);
      border: 1px solid var(--color-borde);
      background: var(--color-superficie);
      box-shadow: var(--sombra-tarjeta);
    }
    .icono {
      width: 2.45rem;
      height: 2.45rem;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--color-suave);
      color: var(--color-dorado-oscuro);
      font-size: 1.1rem;
    }
    .gasto .icono {
      background: var(--color-rojo-claro);
      color: var(--color-rojo);
    }
    h3 {
      font-size: 0.86rem;
      font-weight: 800;
    }
    .apunte {
      margin-top: 0.15rem;
      color: var(--color-gris);
      font-size: 0.74rem;
    }
    .importe {
      white-space: nowrap;
      font: 700 0.95rem var(--fuente-etiqueta);
    }
    .gasto .importe {
      color: var(--color-rojo);
    }
    .vacio {
      padding: 0.85rem;
      border-radius: 0.7rem;
      background: var(--color-superficie);
      font-size: 0.84rem;
    }
    .gestion {
      margin-top: 0.9rem;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    .gestion form {
      padding: 0.8rem;
      border-radius: var(--radio-tarjeta);
      background: var(--color-superficie);
      border: 1px solid var(--color-borde);
    }
    .gestion label {
      display: grid;
      gap: 0.3rem;
      margin: 0.6rem 0;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .gestion input,
    .gestion textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 44px;
      padding: 0.5rem;
      border: 1px solid var(--color-borde);
      border-radius: 0.55rem;
      background: var(--color-fondo);
      color: inherit;
      font: inherit;
    }
    .primario {
      background: var(--color-rojo);
      color: white;
      border-color: transparent;
    }
    .error {
      margin-bottom: 0.5rem;
      color: var(--color-rojo);
      font-size: 0.82rem;
    }
    button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .historial {
      margin-top: 1rem;
    }
    .historial summary {
      display: flex;
      align-items: center;
      min-height: 44px;
      font-size: 0.86rem;
      font-weight: 800;
      cursor: pointer;
    }
    .historial li {
      display: flex;
      justify-content: space-between;
    }
    :focus-visible {
      outline: none;
    }
    @media (min-width: 34rem) {
      .bote img {
        right: 1.1rem;
        width: 6.25rem;
        height: 6.25rem;
      }
    }
  `;

  private abrir(edicion: 'gasto' | 'inicial') {
    this.edicion = edicion;
    this.importe = edicion === 'inicial' ? String(this.temporada.huchaInicial).replace('.', ',') : '';
    this.motivo = '';
    this.fecha = fechaEnMadrid(new Date());
    this.error = '';
  }

  private async guardar(evento: SubmitEvent) {
    evento.preventDefault();
    if (!this.gestionar || !this.edicion || this.guardando) return;
    const importe = leerImporteHucha(this.importe);
    const motivo = this.motivo.trim();
    if (importe === undefined || (this.edicion === 'gasto' && importe <= 0) || !motivo || !this.fecha) {
      this.error =
        this.edicion === 'gasto'
          ? 'Indica un importe positivo, el motivo y la fecha.'
          : 'Indica el importe, el motivo y la fecha.';
      return;
    }

    this.guardando = true;
    this.error = '';
    try {
      const respuesta = await this.gestionar({
        funcion: this.edicion === 'gasto' ? 'registrar_gasto' : 'editar_hucha_inicial',
        temporada_id: this.temporada.id,
        importe,
        motivo,
        fecha: this.fecha,
      });
      if (respuesta.ok) this.edicion = undefined;
      else this.error = respuesta.error;
    } catch {
      this.error = 'No se pudo confirmar el cambio. Revisa la hucha antes de volver a guardar.';
    } finally {
      this.guardando = false;
    }
  }

  private formularioGestion() {
    if (!this.gestionar) return nothing;
    if (!this.edicion)
      return html`<div class="gestion acciones">
        <button type="button" @click=${() => this.abrir('gasto')}>+ Registrar gasto</button>
        <button type="button" @click=${() => this.abrir('inicial')}>Editar importe inicial</button>
      </div>`;

    return html`<div class="gestion">
      <form novalidate @submit=${this.guardar} aria-busy=${this.guardando ? 'true' : 'false'}>
        <h2>${this.edicion === 'gasto' ? 'Registrar gasto' : 'Editar importe inicial'}</h2>
        <label
          >Importe en euros<input
            name="importe"
            inputmode="decimal"
            .value=${this.importe}
            ?disabled=${this.guardando}
            @input=${(evento: Event) => {
              this.importe = (evento.currentTarget as HTMLInputElement).value;
            }}
        /></label>
        <label
          >Motivo<textarea
            name="motivo"
            .value=${this.motivo}
            ?disabled=${this.guardando}
            @input=${(evento: Event) => {
              this.motivo = (evento.currentTarget as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </label>
        <label
          >Fecha<input
            name="fecha"
            type="date"
            .value=${this.fecha}
            ?disabled=${this.guardando}
            @input=${(evento: Event) => {
              this.fecha = (evento.currentTarget as HTMLInputElement).value;
            }}
        /></label>
        ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
        <div class="acciones">
          <button type="submit" class="primario" ?disabled=${this.guardando}>
            ${this.guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            ?disabled=${this.guardando}
            @click=${() => {
              this.edicion = undefined;
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>`;
  }

  render() {
    const { saldo, ingresado, gastado, movimientos } = resumirHucha(this.temporada);
    const visibles = this.filtro === 'todos' ? movimientos : movimientos.filter(({ tipo }) => tipo === this.filtro);
    const ajustes = [...(this.temporada.historialHuchaInicial ?? [])].reverse();

    return html`
      <section class="bote">
        <h1>La hucha de Nacho</h1>
        <p class="temporada">Temporada ${this.temporada.nombre}</p>
        <strong class="total" aria-label="Saldo ${euros(saldo)}">${euros(saldo)}</strong>
        <img src=${`${import.meta.env.BASE_URL}nacho-pig-1.png`} width="80" height="80" alt="" />
        <dl class="balance">
          <div>
            <dt>Ingresado</dt>
            <dd>${euros(ingresado)}</dd>
          </div>
          <div>
            <dt>Gastado</dt>
            <dd>${euros(gastado)}</dd>
          </div>
        </dl>
      </section>
      ${this.formularioGestion()}
      <section>
        <h2>Movimientos <span aria-live="polite">${visibles.length}</span></h2>
        <div class="filtros" role="group" aria-label="Filtrar movimientos">
          ${filtros.map(
            ({ id, nombre }) =>
              html`<button
                type="button"
                aria-pressed=${this.filtro === id ? 'true' : 'false'}
                @click=${() => {
                  this.filtro = id;
                }}
              >
                ${nombre}
              </button>`,
          )}
        </div>
        ${
          visibles.length
            ? html`<ul>
                ${visibles.map(
                  (movimiento) => html`
                    <li class=${movimiento.tipo}>
                      <span class="icono" aria-hidden="true">${movimiento.tipo === 'ingreso' ? '↓' : '↑'}</span>
                      <div>
                        <h3>${movimiento.concepto}</h3>
                        <p class="apunte">
                          ${movimiento.tipo === 'gasto' ? 'Gasto · ' : html`Ingreso · `}${movimiento.nombreTecnico ? `${movimiento.nombreTecnico} · ` : movimiento.dorsal !== undefined ? `#${movimiento.dorsal} · ` : nothing}<time
                            datetime=${movimiento.fecha}
                            >${fechaCorta(movimiento.fecha)}</time
                          >
                        </p>
                      </div>
                      <strong class="importe"
                        >${movimiento.tipo === 'ingreso' ? '+' : '−'}${euros(movimiento.importe)}</strong
                      >
                    </li>
                  `,
                )}
              </ul>`
            : html`<p class="vacio">No hay movimientos para este filtro.</p>`
        }
      </section>
      ${
        ajustes.length
          ? html`<details class="historial">
              <summary>Ajustes del importe inicial (${ajustes.length})</summary>
              <ul>
                ${ajustes.map(
                  (ajuste) =>
                    html`<li>
                      <div>
                        <h3>${ajuste.motivo}</h3>
                        <p class="apunte">
                          ${fechaCorta(ajuste.fecha)}${this.gestionar && ajuste.usuario ? ` · ${ajuste.usuario}` : ''}
                        </p>
                      </div>
                      <strong class="importe">${euros(ajuste.anterior)} → ${euros(ajuste.nuevo)}</strong>
                    </li>`,
                )}
              </ul>
            </details>`
          : nothing
      }
    `;
  }
}

customElements.define('crg-hucha', CrgHucha);
