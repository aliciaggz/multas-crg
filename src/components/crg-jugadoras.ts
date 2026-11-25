import { css, html, LitElement, nothing } from 'lit';
import type { Destinatario, Temporada } from '../data/temporadas-demo';
import { coincideBusquedaJugadora, euros } from '../lib/presentacion';
import { enlaceFicha, esTecnico, multasDe } from '../lib/destinatarios';
import { noConvocable, saldoJugadora } from '../lib/reglas';

const filtros = ['Todas', 'Pendientes', 'Al día'] as const;
type Filtro = typeof filtros[number];

class CrgJugadoras extends LitElement {
  static properties = {
    temporada: { attribute: false }, hoy: { attribute: false }, enInicio: { type: Boolean },
    busqueda: { state: true }, filtro: { state: true }, porDorsal: { state: true },
  };

  declare temporada: Temporada;
  declare hoy: Date;
  declare enInicio: boolean;
  private declare busqueda: string;
  private declare filtro: Filtro;
  private declare porDorsal: boolean;

  constructor() {
    super();
    this.busqueda = '';
    this.filtro = 'Todas';
    this.porDorsal = false;
  }

  static styles = css`
    :host { display: block; }
    .buscador { position: relative; display: block; }
    .buscador::before {
      content: ''; position: absolute; left: 1rem; top: 1rem;
      width: 0.65rem; height: 0.65rem; border: 2px solid var(--color-gris); border-radius: 50%;
    }
    .buscador::after {
      content: ''; position: absolute; left: 1.67rem; top: 1.72rem;
      width: 0.45rem; height: 2px; transform: rotate(45deg); background: var(--color-gris);
    }
    input {
      box-sizing: border-box; display: block; width: 100%; min-height: 3.1rem;
      padding: 0.6rem 1rem 0.6rem 2.85rem; border: 1px solid var(--color-borde);
      border-radius: 0.9rem; background: var(--color-superficie); color: var(--color-primario);
      font: 600 1rem var(--fuente-texto); box-shadow: var(--sombra-tarjeta);
    }
    input::placeholder { color: var(--color-gris); }
    .filtros { display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.75rem 0 1.4rem; }
    button {
      min-height: 44px; border-radius: 999px; padding: 0.35rem 0.7rem;
      border: 1px solid var(--color-borde); background: var(--color-superficie);
      color: var(--color-primario); font: 700 0.76rem var(--fuente-texto); cursor: pointer;
    }
    button[aria-pressed='true'] { background: var(--color-tarjeta-oscura); color: white; border-color: transparent; }
    button span { margin-inline-start: 0.16rem; font-family: var(--fuente-etiqueta); }
    .cabecera { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.65rem; }
    h1, h2 { margin: 0; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.03em; }
    .opciones { display: flex; align-items: center; justify-content: end; flex-wrap: wrap; gap: 0 0.55rem; }
    .opciones .orden { padding-inline: 0.15rem; border: 0; background: transparent; color: var(--color-primario); text-decoration: underline; }
    .opciones .orden[aria-pressed='true'] { color: var(--color-rojo); }
    .contador { color: var(--color-gris); font: 600 0.82rem var(--fuente-etiqueta); text-align: end; }
    .cuerpo-tecnico { margin-top: 1.25rem; }
    .cuerpo-tecnico h2 { margin-bottom: 0.65rem; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
    a {
      box-sizing: border-box; display: grid; grid-template-columns: 2.65rem minmax(0, 1fr) auto 0.5rem;
      align-items: center; gap: 0.65rem; min-height: 4.4rem; padding: 0.65rem 0.85rem;
      border: 1px solid var(--color-borde); border-radius: var(--radio-tarjeta); background: var(--color-superficie);
      color: inherit; text-decoration: none; box-shadow: var(--sombra-tarjeta);
    }
    a:hover { border-color: var(--color-gris); }
    a.vencida { border-color: #f7cdd5; }
    .dorsal {
      width: 2.65rem; height: 2.65rem; border-radius: 50%; position: relative; display: grid; place-items: center;
      background: var(--color-suave); color: var(--color-primario); font: 700 0.95rem var(--fuente-etiqueta);
    }
    .dorsal img { width: 100%; height: 100%; object-fit: contain; }
    .capitana {
      position: absolute; inset: auto -0.14rem -0.1rem auto; border-radius: 50%; display: grid; place-items: center;
      width: 0.92rem; height: 0.92rem; border: 1px solid white;
      color: var(--color-primario); background: var(--color-dorado); font-size: 0.63rem;
    }
    .vencida .dorsal { color: var(--color-rojo); background: var(--color-rojo-claro); }
    .nombre { display: block; font-size: 0.98rem; font-weight: 800; overflow-wrap: anywhere; }
    .estado { color: var(--color-rojo); font-size: 0.72rem; font-weight: 700; }
    .estado.al-dia { color: var(--color-verde); }
    .importe { white-space: nowrap; font: 700 1rem var(--fuente-etiqueta); }
    .vencida .importe { color: var(--color-rojo); }
    .importe.cero { color: var(--color-gris); }
    .flecha { width: 0.38rem; height: 0.38rem; border-top: 2px solid #9aabc0; border-right: 2px solid #9aabc0; transform: rotate(45deg); }
    .vacio { margin: 0; padding: 1rem; border-radius: var(--radio-tarjeta); background: white; color: var(--color-gris); font-size: 0.88rem; }
    :focus-visible { outline: 2px solid var(--color-rojo); outline-offset: 2px; }
  `;

  private cambiarBusqueda(evento: Event) {
    this.busqueda = (evento.currentTarget as HTMLInputElement).value;
  }

  private resumen<T extends Destinatario>(persona: T) {
    const multas = multasDe(persona, this.temporada.multas);
    return {
      persona,
      saldo: saldoJugadora(multas, this.hoy),
      vencida: noConvocable(multas, this.hoy),
      pendiente: multas.some(({ estado }) => estado === 'pendiente' || estado === 'pago_declarado'),
    };
  }

  private fila({ persona, saldo, vencida, pendiente }: ReturnType<CrgJugadoras['resumen']>) {
    return html`
      <li>
        <a href=${enlaceFicha(persona)} class=${vencida ? 'vencida' : ''}>
          ${esTecnico(persona) ? html`<span class="dorsal" aria-hidden="true">
            <img src=${`${import.meta.env.BASE_URL}nacho-pig-1.png`} width="42" height="42" alt="">
          </span>`
            : html`<span class="dorsal">#${persona.dorsal}${persona.capitana
              ? html`<span class="capitana" aria-label="Capitana">C</span>` : nothing}</span>`}
          <span>
            <span class="nombre">${persona.nombre}</span>
            <span class=${pendiente ? 'estado' : 'estado al-dia'}>
              ${vencida ? 'No convocable' : pendiente ? 'Pendiente' : 'Al día'}
            </span>
          </span>
          <span class=${saldo ? 'importe' : 'importe cero'}>${euros(saldo)}</span>
          <span class="flecha" aria-hidden="true"></span>
        </a>
      </li>
    `;
  }

  render() {
    const jugadoras = this.temporada.jugadoras.map((jugadora) => this.resumen(jugadora));
    const tecnicos = this.enInicio ? this.temporada.tecnicos ?? [] : [];
    const buscadas = jugadoras.filter(({ persona }) => coincideBusquedaJugadora(persona, this.busqueda));
    const pendientes = buscadas.filter(({ pendiente }) => pendiente);
    const alDia = buscadas.filter(({ pendiente }) => !pendiente);
    const grupos = { Todas: buscadas, Pendientes: pendientes, 'Al día': alDia };
    const grupo = grupos[this.filtro];
    const visibles = [...grupo].sort((a, b) => this.porDorsal
      ? a.persona.dorsal - b.persona.dorsal
      : Number(b.pendiente) - Number(a.pendiente) || b.saldo - a.saldo);
    const mensajeVacio = !jugadoras.length ? 'Todavía no hay jugadoras registradas'
      : !buscadas.length ? 'No encontramos jugadoras con ese nombre o dorsal'
        : 'No hay jugadoras que coincidan con el filtro seleccionado';

    return html`
      <label class="buscador">
        <input type="search" aria-label="Buscar jugadora por nombre o dorsal" placeholder="Buscar jugadora o dorsal…"
          .value=${this.busqueda} @input=${this.cambiarBusqueda}>
      </label>
      <div class="filtros" role="group" aria-label="Filtrar por estado">
        ${filtros.map((filtro) => html`
          <button aria-pressed=${this.filtro === filtro ? 'true' : 'false'} @click=${() => { this.filtro = filtro; }}>
            ${filtro}<span>${grupos[filtro].length}</span>
          </button>
        `)}
      </div>
      <div class="cabecera">
        ${this.enInicio ? html`<h2>Plantilla</h2>` : html`<h1>Plantilla</h1>`}
        <div class="opciones">
          <span class="contador" aria-live="polite">${visibles.length} ${visibles.length === 1 ? 'jugadora' : 'jugadoras'}</span>
          ${jugadoras.length ? html`<button class="orden" type="button" aria-pressed=${String(this.porDorsal)}
            @click=${() => { this.porDorsal = !this.porDorsal; }}>Ordenar por dorsal</button>` : ''}
        </div>
      </div>
      ${visibles.length ? html`<ul>${visibles.map((resumen) => this.fila(resumen))}</ul>`
        : html`<p class="vacio">${mensajeVacio}.</p>`}
      ${tecnicos.length ? html`
        <section class="cuerpo-tecnico" aria-labelledby="titulo-cuerpo-tecnico">
          <h2 id="titulo-cuerpo-tecnico">Cuerpo técnico</h2>
          <ul>${tecnicos.map((tecnico) => this.fila(this.resumen(tecnico)))}</ul>
        </section>` : nothing}
    `;
  }
}

customElements.define('crg-jugadoras', CrgJugadoras);
