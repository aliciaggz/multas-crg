import { css, html, LitElement, nothing } from 'lit';
import catalogo from '../data/catalogo.json';
import { aplicaDoble, enlaceFicha, esTecnico, estaActivo, etiquetaDestinatario } from '../lib/destinatarios';
import type { Destinatario, Temporada } from '../data/temporadas-demo';
import { coincideBusquedaJugadora, euros, nombreConcepto } from '../lib/presentacion';
import { prepararRegistro, proponerEscalon, type RegistroMulta, type ResultadoGuardado } from '../lib/registro-multas';
import { fechaEnMadrid, importeRegistro } from '../lib/reglas';

const grupos = [{ id: 'entreno', nombre: 'Entrenamiento' }, { id: 'partido', nombre: 'Partido' }] as const;
type Grupo = typeof grupos[number]['id'];

class CrgNuevaSancion extends LitElement {
  static properties = {
    temporada: { attribute: false }, guardar: { attribute: false },
    busqueda: { state: true }, fichaElegida: { state: true }, grupo: { state: true },
    conceptoId: { state: true }, cantidad: { state: true }, minutos: { state: true },
    importeManual: { state: true }, fecha: { state: true }, observacion: { state: true },
    pagadaAhora: { state: true }, guardando: { state: true }, error: { state: true },
    propuesta: { state: true },
  };

  declare temporada: Temporada;
  declare guardar: (multa: RegistroMulta, temporadaId: string) => Promise<ResultadoGuardado>;
  private declare busqueda: string;
  private declare fichaElegida: string;
  private declare grupo: Grupo;
  private declare conceptoId: string;
  private declare cantidad: string;
  private declare minutos: string;
  private declare importeManual: string;
  private declare fecha: string;
  private declare observacion: string;
  private declare pagadaAhora: boolean;
  private declare guardando: boolean;
  private declare error: string;
  private declare propuesta: ReturnType<typeof proponerEscalon>;

  constructor() {
    super();
    this.busqueda = '';
    this.fichaElegida = '';
    this.grupo = 'entreno';
    this.limpiarConcepto();
    this.fecha = fechaEnMadrid(new Date());
    this.guardando = false;
    this.error = '';
  }

  static styles = css`
    :host { display: block; }
    h1, p, fieldset { margin: 0; }
    h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.04em; }
    .cabecera { display: flex; gap: 0.6rem; align-items: center; justify-content: space-between; }
    .temporada { padding: 0.3rem 0.55rem; border-radius: 999px; background: var(--color-suave); font: 700 0.77rem var(--fuente-etiqueta); }
    .volver { display: inline-flex; align-items: center; min-height: 44px; color: inherit; font-size: 0.8rem; font-weight: 700; text-decoration: none; }
    fieldset { min-width: 0; border: 0; padding: 0; }
    .bloque { margin-top: 1.1rem; }
    legend { font-weight: 800; font-size: 0.9rem; margin-bottom: 0.5rem; padding: 0; }
    legend::before { content: ''; display: inline-block; width: 0.45rem; height: 0.45rem; margin-right: 0.45rem; border-radius: 50%; background: var(--color-rojo); vertical-align: 0.07rem; }
    input:not([type='checkbox']), textarea {
      box-sizing: border-box; width: 100%; min-height: 44px; padding: 0.55rem 0.65rem;
      border-radius: 0.75rem; border: 1px solid var(--color-borde); color: inherit;
      background: var(--color-superficie); font: inherit;
    }
    textarea { min-height: 4.5rem; resize: vertical; }
    label { display: grid; gap: 0.35rem; font-size: 0.82rem; font-weight: 700; }
    label + label { margin-top: 0.65rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.42rem; margin-top: 0.65rem; }
    button { min-height: 44px; border: 1px solid var(--color-borde); background: var(--color-superficie); color: inherit; font: 700 0.83rem var(--fuente-texto); border-radius: 0.75rem; padding: 0.4rem 0.7rem; cursor: pointer; }
    button:disabled { opacity: 0.62; cursor: default; }
    .chips button { border-radius: 999px; background: var(--color-suave); }
    .chips button[aria-pressed='true'], .opciones button[aria-pressed='true'] { background: var(--color-tarjeta-oscura); color: white; }
    .grupo { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0.3rem; padding: 0.25rem; background: var(--color-suave); border-radius: 0.9rem; }
    .grupo button { background: transparent; border-color: transparent; }
    .grupo button[aria-pressed='true'] { background: var(--color-superficie); box-shadow: var(--sombra-tarjeta); }
    .opciones { display: grid; gap: 0.35rem; margin-top: 0.5rem; }
    .opciones button { text-align: left; display: flex; justify-content: space-between; align-items: center; gap: 0.45rem; }
    .precio { white-space: nowrap; font: 700 0.83rem var(--fuente-etiqueta); }
    .opciones button[aria-pressed='true'] .precio { color: var(--color-dorado); }
    .campo-variable { margin-top: 0.6rem; }
    .aviso { color: var(--color-gris); font-size: 0.82rem; line-height: 1.4; }
    .resumen, .escalon { border: 1px solid var(--color-borde); background: var(--color-superficie); border-radius: var(--radio-tarjeta); padding: 0.75rem; box-shadow: var(--sombra-tarjeta); }
    .resumen { margin-top: 1rem; display: grid; gap: 0.55rem; }
    .pagar { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; }
    .pagar input { width: 1.2rem; height: 1.2rem; accent-color: var(--color-rojo); }
    .confirmar { background: var(--color-rojo); color: white; border-color: transparent; }
    .error { margin-top: 0.65rem; font-size: 0.85rem; font-weight: 700; }
    .error { color: var(--color-rojo); }
    .escalon { margin-top: 0.65rem; }
    .acciones { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
    :focus-visible { outline: 2px solid var(--color-rojo); outline-offset: 2px; }
  `;

  private limpiarConcepto() {
    this.conceptoId = '';
    this.cantidad = '1';
    this.minutos = '';
    this.importeManual = '';
    this.observacion = '';
    this.pagadaAhora = false;
  }

  private seleccionarConcepto(id: string) {
    this.conceptoId = id;
    this.cantidad = '1';
    this.minutos = '';
    this.importeManual = '';
    this.error = '';
  }

  private get disponibles(): Destinatario[] {
    return [...this.temporada.jugadoras, ...(this.temporada.tecnicos ?? [])].filter(estaActivo);
  }

  private get destinatario() {
    return this.disponibles.find((persona) => enlaceFicha(persona) === this.fichaElegida);
  }

  private get vistaPrevia() {
    return prepararRegistro({
      destinatario: this.destinatario, conceptoId: this.conceptoId, cantidad: this.cantidad,
      minutos: this.minutos, importeManual: this.importeManual, fecha: this.fecha,
      observacion: this.observacion, pagadaAhora: this.pagadaAhora,
    }, new Date());
  }

  private async enviar(multa: RegistroMulta): Promise<ResultadoGuardado | undefined> {
    if (this.guardando) return;
    this.guardando = true;
    this.error = '';
    try {
      const resultado = await this.guardar(multa, this.temporada.id);
      if (!resultado.ok) this.error = resultado.error;
      return resultado;
    } catch {
      this.error = 'No se pudo confirmar el registro. Comprueba el detalle antes de volver a guardar.';
    } finally {
      this.guardando = false;
    }
  }

  private async registrar(evento: SubmitEvent) {
    evento.preventDefault();
    const destinatario = this.destinatario;
    const previa = this.vistaPrevia;
    if (!destinatario || !previa.ok || this.propuesta) return;

    const resultado = await this.enviar(previa.multa);
    if (!resultado?.ok) return;
    if (previa.cuentaAsistencia && resultado.temporada) {
      this.propuesta = proponerEscalon(destinatario, resultado.temporada.multas, fechaEnMadrid(new Date()));
    }
    this.limpiarConcepto();
  }

  private async registrarEscalon() {
    if (!this.propuesta) return;
    const resultado = await this.enviar(this.propuesta.multa);
    if (!resultado?.ok) return;
    this.propuesta = undefined;
  }

  render() {
    const hoy = fechaEnMadrid(new Date());
    const destinatario = this.destinatario;
    const busqueda = this.busqueda.trim();
    const coincidencias = busqueda
      ? this.disponibles.filter((persona) => coincideBusquedaJugadora(persona, busqueda)) : [];
    const precio = (concepto: typeof catalogo[number]) => importeRegistro(concepto, 1, aplicaDoble(destinatario));
    const tarifasTardanza = catalogo.filter(({ tipo }) => tipo === 'tardanza').map(precio);
    const conceptos = catalogo.filter(({ grupo, id }) => grupo === this.grupo && id !== 'par_tarde_20')
      .map((concepto) => ({
        concepto,
        tarifas: concepto.id === 'par_tarde' ? tarifasTardanza : [precio(concepto)],
      }))
      .sort((a, b) => a.tarifas[0] - b.tarifas[0]);
    const seleccionado = catalogo.find(({ id }) => id === this.conceptoId);
    const manual = this.conceptoId === 'ajuste_manual';
    const previa = this.vistaPrevia;

    return html`
      <a class="volver" href="#inicio">← Volver a Inicio</a>
      <header class="cabecera"><h1>Nueva multa</h1><span class="temporada">${this.temporada.nombre}</span></header>
      <form novalidate @submit=${this.registrar} aria-busy=${this.guardando ? 'true' : 'false'}>
        <fieldset ?disabled=${this.guardando || Boolean(this.propuesta)}>
          <fieldset class="bloque">
            <legend>Destinatario</legend>
            ${destinatario ? html`<div class="chips">
              <p class="aviso">${etiquetaDestinatario(destinatario)} · ${esTecnico(destinatario) ? 'Cuerpo técnico' : 'Jugadoras'}</p>
              <button type="button" @click=${() => { this.fichaElegida = ''; this.busqueda = ''; this.error = ''; }}>Cambiar destinatario</button>
            </div>` : html`
              <input type="search" aria-label="Buscar jugadora o entrenador por nombre, o jugadora por dorsal"
                placeholder="Buscar por nombre o dorsal…" .value=${this.busqueda}
                @input=${(evento: Event) => { this.busqueda = valor(evento); }}>
              <div class="chips">
                ${coincidencias.map((persona) => html`<button type="button"
                  @click=${() => { this.fichaElegida = enlaceFicha(persona); this.error = ''; }}>
                  ${etiquetaDestinatario(persona)} · ${esTecnico(persona) ? 'Cuerpo técnico' : 'Jugadoras'}
                </button>`)}
                ${!coincidencias.length ? html`<p class="aviso">${busqueda
                  ? 'No hay coincidencias para esta búsqueda.' : 'Escribe un nombre o dorsal para buscar.'}</p>` : nothing}
              </div>
            `}
          </fieldset>
          <fieldset class="bloque">
            <legend>Concepto</legend>
            <div class="grupo" role="group" aria-label="Grupo de conceptos">
              ${grupos.map(({ id, nombre }) => html`<button type="button" aria-pressed=${this.grupo === id ? 'true' : 'false'}
                @click=${() => { if (this.grupo !== id) { this.grupo = id; this.seleccionarConcepto(''); } }}>${nombre}</button>`)}
            </div>
            <div class="opciones">
              ${conceptos.map(({ concepto, tarifas }) => html`<button type="button" aria-pressed=${this.conceptoId === concepto.id ? 'true' : 'false'}
                @click=${() => this.seleccionarConcepto(concepto.id)}>
                <span>${concepto.nombre}</span>
                <span class="precio">${tarifas.map(euros).join(' / ')}${concepto.tipo === 'por_prenda' ? ' / prenda' : nothing}</span>
              </button>`)}
              <button type="button" aria-pressed=${manual ? 'true' : 'false'} @click=${() => this.seleccionarConcepto('ajuste_manual')}>Ajuste manual</button>
            </div>
            ${seleccionado?.tipo === 'por_prenda' ? html`<label class="campo-variable">Cantidad de prendas
              <input type="number" name="cantidad" min="1" step="1" .value=${this.cantidad} @input=${(evento: Event) => { this.cantidad = valor(evento); }}></label>` : nothing}
            ${this.conceptoId === 'par_tarde' ? html`<label class="campo-variable">Minutos desde la convocatoria
              <input type="number" name="minutos" min="0" step="1" .value=${this.minutos} @input=${(evento: Event) => { this.minutos = valor(evento); }}></label>` : nothing}
            ${manual ? html`<label class="campo-variable">Importe en euros
              <input inputmode="decimal" name="importe" .value=${this.importeManual} @input=${(evento: Event) => { this.importeManual = valor(evento); }}></label>` : nothing}
          </fieldset>
          <fieldset class="bloque">
            <legend>Fecha y observaciones</legend>
            <label>Fecha<input type="date" name="fecha" max=${hoy} .value=${this.fecha} @input=${(evento: Event) => { this.fecha = valor(evento); }}></label>
            <label>${manual ? 'Motivo del ajuste' : 'Observaciones (opcional)'}
              <textarea name="observacion" .value=${this.observacion} @input=${(evento: Event) => { this.observacion = valor(evento); }}></textarea></label>
          </fieldset>
          <div class="resumen">
            <p class="aviso" aria-live="polite">${previa.ok && destinatario
              ? `${etiquetaDestinatario(destinatario)} · ${nombreConcepto(previa.multa.concepto_id)}`
              : previa.ok ? '' : previa.mensaje}</p>
            <label class="pagar"><input type="checkbox" name="pagar" .checked=${this.pagadaAhora}
              @change=${(evento: Event) => { this.pagadaAhora = (evento.currentTarget as HTMLInputElement).checked; }}> ${destinatario && esTecnico(destinatario) ? 'El entrenador ya ha pagado' : 'La jugadora ya ha pagado'}</label>
            <button type="submit" class="confirmar guardar" ?disabled=${!previa.ok}>
              ${this.guardando ? 'Guardando…' : `Guardar multa${previa.ok ? ` (${euros(previa.total)})` : ''}`}
            </button>
          </div>
        </fieldset>
      </form>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.propuesta && destinatario ? html`<section class="escalon" aria-label="Confirmar escalón">
        <p>${destinatario.nombre} lleva ${this.propuesta.faltas} faltas. Corresponde registrar ${euros(this.propuesta.multa.importe)} por el escalón.</p>
        <div class="acciones">
          <button type="button" class="confirmar" ?disabled=${this.guardando} @click=${this.registrarEscalon}>Registrar escalón</button>
          <button type="button" ?disabled=${this.guardando} @click=${() => { this.propuesta = undefined; this.error = ''; }}>Ahora no</button>
        </div>
      </section>` : nothing}
    `;
  }
}

function valor(evento: Event): string {
  return (evento.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
}

customElements.define('crg-nueva-sancion', CrgNuevaSancion);
