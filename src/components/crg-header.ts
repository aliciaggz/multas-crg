import { css, html, LitElement, nothing } from 'lit';
import type { ResumenTemporada } from '../data/temporadas-demo';

class CrgHeader extends LitElement {
  static properties = {
    temporadas: { attribute: false }, seleccionada: { type: String },
    haySesion: { type: Boolean }, enEntrenadores: { type: Boolean },
  };
  declare temporadas: readonly ResumenTemporada[];
  declare seleccionada: string;
  declare haySesion: boolean;
  declare enEntrenadores: boolean;

  static styles = css`
    :host { display: block; border-bottom: 1px solid var(--color-borde); }
    header {
      max-width: var(--ancho-contenido);
      margin: auto;
      padding: 0.75rem 1rem;
      display: grid;
      grid-template-columns: 2.75rem minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.75rem;
    }
    .escudo {
      width: 2.75rem;
      height: 2.75rem;
      object-fit: contain;
    }
    strong { display: block; font-size: 1.05rem; font-weight: 800; letter-spacing: -0.035em; }
    .temporada { display: flex; flex-wrap: wrap; align-items: center; column-gap: 0.2rem; }
    .equipo { color: var(--color-rojo); font: 600 0.72rem var(--fuente-etiqueta); }
    select {
      min-height: 44px;
      min-width: 4.25rem;
      border: 0;
      background: transparent;
      color: var(--color-primario);
      font: 700 0.75rem var(--fuente-etiqueta);
      cursor: pointer;
    }
    summary, .cuenta button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      min-width: 44px;
      min-height: 44px;
      border-radius: 999px;
      padding-inline: 0.75rem;
      border: 1px solid var(--color-borde);
      background: var(--color-superficie);
      color: var(--color-primario);
      font: 700 0.83rem var(--fuente-texto);
      box-shadow: var(--sombra-tarjeta);
      cursor: pointer;
    }
    details { position: relative; }
    summary { gap: 0.35rem; list-style: none; }
    .coaches { color: #67223c; border-color: #67223c; }
    .en-acceso { font: 700 0.83rem var(--fuente-texto); color: #67223c; }
    summary::-webkit-details-marker { display: none; }
    .cuenta {
      position: absolute; z-index: 3; inset: calc(100% + 0.4rem) 0 auto auto;
      min-width: 10rem; max-width: 14rem; padding: 0.65rem; border: 1px solid var(--color-borde);
      border-radius: 0.75rem; background: var(--color-superficie); box-shadow: var(--sombra-tarjeta);
    }
    .cuenta strong { margin-bottom: 0.5rem; font-size: 0.86rem; overflow-wrap: anywhere; }
    .cuenta button { width: 100%; box-shadow: none; }
    @media (max-width: 25rem) {
      header { padding-inline: 0.65rem; gap: 0.4rem; }
      summary, .en-acceso { font-size: 0.76rem; }
    }
    :focus-visible { outline: none; }
  `;

  private cambiarTemporada(evento: Event) {
    const select = evento.currentTarget as HTMLSelectElement;
    this.dispatchEvent(new CustomEvent('temporada-cambiada', { detail: select.value }));
  }

  private accionarMenu(evento: MouseEvent) {
    const boton = evento.currentTarget as HTMLButtonElement;
    const menu = boton.closest('details');
    if (menu) menu.open = false;
    this.dispatchEvent(new Event(this.haySesion ? 'cerrar-sesion' : 'acceder-entrenadores'));
  }

  private cerrarMenuConEscape(evento: KeyboardEvent) {
    const menu = evento.currentTarget as HTMLDetailsElement;
    if (evento.key !== 'Escape' || !menu.open) return;
    evento.preventDefault();
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }

  render() {
    return html`
      <header>
        <img class="escudo" src=${`${import.meta.env.BASE_URL}iconos/escudo-guindalera.png`} width="44" height="44" alt="">
        <div>
          <strong>CR Guindalera</strong>
          <div class="temporada">
            <span class="equipo">Senior femenino</span>
            ${this.temporadas.length ? html`
              <select aria-label="Temporada" @change=${this.cambiarTemporada}>
                ${this.temporadas.map((temporada) => html`
                  <option value=${temporada.id} .selected=${temporada.id === this.seleccionada}>${temporada.nombre}</option>
                `)}
              </select>
            ` : nothing}
          </div>
        </div>
        ${this.enEntrenadores && !this.haySesion ? html`
          <span class="en-acceso">Entrenadores</span>
        ` : html`
          <details @keydown=${this.cerrarMenuConEscape}>
            <summary class=${this.haySesion ? 'Entrenadores' : nothing}>
              ${this.haySesion ? 'Entrenadores' : 'Jugadoras'} <span aria-hidden="true">▾</span>
            </summary>
            <div class="cuenta">
              <button type="button" @click=${this.accionarMenu}>
                ${this.haySesion ? 'Cerrar sesión' : 'Acceder como entrenador'}
              </button>
            </div>
          </details>
        `}
      </header>
    `;
  }
}

customElements.define('crg-header', CrgHeader);
