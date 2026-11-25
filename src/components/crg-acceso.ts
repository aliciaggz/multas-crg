import { css, html, LitElement, nothing } from 'lit';
import type { AccesoStaff } from '../lib/acceso-staff';

class CrgAcceso extends LitElement {
  static properties = {
    acceso: { attribute: false },
    temporada: { type: String },
    pin: { state: true },
    error: { state: true },
    segundos: { state: true },
    enviando: { state: true },
  };

  declare acceso: AccesoStaff;
  declare temporada: string;
  private declare pin: string;
  private declare error: string;
  private declare segundos: number;
  private declare enviando: boolean;
  private intervalo?: number;

  constructor() {
    super();
    this.pin = '';
    this.error = '';
    this.segundos = 0;
    this.enviando = false;
  }

  static styles = css`
    :host { display: block; max-width: 27rem; margin-inline: auto; }
    h1, p { margin: 0; }
    .volver { display: inline-flex; align-items: center; min-height: 44px; color: var(--color-primario); font-size: 0.79rem; font-weight: 700; text-decoration: none; }
    .cabecera { text-align: center; margin: 0.2rem 0 1rem; }
    h1 { font-size: clamp(1.45rem, 5.5vw, 1.9rem); font-weight: 800; letter-spacing: -0.05em; }
    .temporada { margin-top: 0.25rem; color: var(--color-gris); font: 600 0.78rem var(--fuente-etiqueta); }
    .tarjeta { border: 1px solid var(--color-borde); border-radius: var(--radio-tarjeta); background: var(--color-superficie); box-shadow: var(--sombra-tarjeta); padding: 0.8rem; }
    label { display: block; color: var(--color-primario); font-size: 0.77rem; font-weight: 800; }
    .etiqueta-pin { text-align: center; }
    .entrada-pin { display: flex; position: relative; justify-content: center; gap: 0.4rem; margin: 0.4rem auto 0.15rem; max-width: 15rem; border-radius: 0.7rem; }
    .entrada-pin:focus-within { outline: 2px solid var(--color-rojo); outline-offset: 3px; }
    .entrada-pin input { position: absolute; inset: 0; box-sizing: border-box; width: 100%; opacity: 0; cursor: text; }
    .digito { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 0.65rem; background: var(--color-suave); color: var(--color-dorado); font-size: 0.95rem; }
    .digito.relleno { background: var(--color-tarjeta-oscura); }
    .digito.actual { box-shadow: inset 0 0 0 1px var(--color-rojo); }
    .teclado { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; margin-top: 0.55rem; }
    button { min-height: 44px; border-radius: 0.65rem; border: 1px solid var(--color-borde); background: var(--color-superficie); color: var(--color-primario); font: 700 1.14rem var(--fuente-etiqueta); cursor: pointer; box-shadow: var(--sombra-tarjeta); }
    button:disabled { opacity: 0.55; cursor: default; }
    .borrar { background: var(--color-suave); }
    .confirmar { background: var(--color-rojo); border-color: transparent; color: white; letter-spacing: 0.01em; font-size: 0.83rem; }
    .error { margin: 0.5rem 0 0.15rem; color: var(--color-rojo); font-size: 0.78rem; font-weight: 800; }
    .ayuda { min-height: 44px; display: inline-flex; align-items: center; font-size: 0.77rem; color: var(--color-gris); cursor: pointer; }
    details p { padding-bottom: 0.45rem; color: var(--color-gris); font-size: 0.77rem; }
    .volver { border: 0; background: transparent; box-shadow: none; padding: 0; text-align: start; }
    :focus-visible { outline: 2px solid var(--color-rojo); outline-offset: 2px; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.actualizarEspera();
    this.intervalo = window.setInterval(() => this.actualizarEspera(), 250);
  }

  disconnectedCallback() {
    window.clearInterval(this.intervalo);
    super.disconnectedCallback();
  }

  private actualizarEspera() {
    this.segundos = this.acceso?.segundosRestantes() ?? 0;
  }

  private introducirPin(evento: Event) {
    const input = evento.currentTarget as HTMLInputElement;
    this.pin = input.value.replace(/\D/g, '').slice(0, 4);
    input.value = this.pin;
  }

  private async confirmar(evento: SubmitEvent) {
    evento.preventDefault();
    this.actualizarEspera();
    if (this.segundos || this.enviando) return;
    const pin = this.pin;
    if (!/^\d{4}$/.test(pin)) {
      this.error = 'Introduce tu PIN de cuatro dígitos.';
      return;
    }

    this.enviando = true;
    this.pin = '';
    this.error = '';
    try {
      const resultado = await this.acceso.intentar(pin);
      if (resultado.estado === 'incorrecto') this.error = 'PIN incorrecto.';
    } catch {
      this.error = 'No se pudo comprobar el acceso. Inténtalo de nuevo.';
    } finally {
      this.enviando = false;
      this.actualizarEspera();
    }
  }

  private tecla(numero: number) {
    return html`<button type="button" ?disabled=${this.segundos > 0 || this.enviando}
      @click=${() => { if (this.pin.length < 4) this.pin += numero; }}>${numero}</button>`;
  }

  render() {
    return html`
      <button class="volver" type="button" @click=${() => this.dispatchEvent(new Event('volver-a-jugadoras'))}>← Volver a Jugadoras</button>
      <header class="cabecera"><h1>Acceso entrenadores</h1>
        ${this.temporada ? html`<p class="temporada">Temporada ${this.temporada}</p>` : nothing}
      </header>
        <form @submit=${this.confirmar}>
          <div class="tarjeta">
            <label for="pin" class="etiqueta-pin">PIN de 4 dígitos</label>
            <div class="entrada-pin">
              ${[0, 1, 2, 3].map((indice) => html`<span aria-hidden="true" class=${`digito ${indice < this.pin.length ? 'relleno' : indice === this.pin.length ? 'actual' : ''}`}>${indice < this.pin.length ? '●' : nothing}</span>`)}
              <input id="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" .value=${this.pin}
                ?disabled=${this.segundos > 0 || this.enviando} @input=${this.introducirPin}>
            </div>
            ${this.segundos ? html`<p class="error" role="status">Demasiados intentos. Vuelve a probar en ${this.segundos} s.</p>`
              : this.error ? html`<p class="error" role="status">${this.error}</p>` : nothing}
          </div>
          <div class="teclado" role="group" aria-label="Teclado numérico">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((numero) => this.tecla(numero))}
            <button type="button" class="borrar" aria-label="Borrar último dígito" ?disabled=${!this.pin || this.segundos > 0 || this.enviando}
              @click=${() => { this.pin = this.pin.slice(0, -1); }}>⌫</button>
            ${this.tecla(0)}
            <button type="submit" class="confirmar" ?disabled=${this.segundos > 0 || this.enviando}>${this.enviando ? 'Comprobando…' : 'Entrar'}</button>
          </div>
        </form>
        <details><summary class="ayuda">¿Olvidaste el PIN?</summary><p>Solicita un restablecimiento a quien administra el sistema.</p></details>
    `;
  }
}

customElements.define('crg-acceso', CrgAcceso);
