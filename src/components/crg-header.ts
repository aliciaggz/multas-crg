import { css, html, LitElement, nothing } from 'lit';
import type { Temporada } from '../data/temporadas-demo';

class CrgHeader extends LitElement {
  static properties = {
    temporadas: { attribute: false }, seleccionada: { type: String },
    usuarioDemo: { type: String }, enStaff: { type: Boolean },
  };
  declare temporadas: readonly Temporada[];
  declare seleccionada: string;
  declare usuarioDemo: string;
  declare enStaff: boolean;

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
      border-radius: 0.85rem;
      display: grid;
      place-items: center;
      background: var(--color-tarjeta-oscura);
      box-shadow: var(--sombra-tarjeta);
    }
    .escudo span, .escudo span::after {
      clip-path: polygon(50% 0, 100% 16%, 100% 55%, 84% 78%, 50% 100%, 16% 78%, 0 55%, 0 16%);
    }
    .escudo span {
      display: grid;
      place-items: center;
      width: 1.2rem;
      height: 1.42rem;
      background: var(--color-dorado);
    }
    .escudo span::after {
      content: '';
      width: 0.9rem;
      height: 1.08rem;
      background: linear-gradient(135deg, var(--color-tarjeta-oscura) 51%, var(--color-dorado) 52% 63%, var(--color-tarjeta-oscura) 64%);
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
    .staff {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      border-radius: 999px;
      padding-inline: 0.75rem;
      border: 1px solid var(--color-borde);
      background: var(--color-superficie);
      color: var(--color-primario);
      font: 700 0.83rem var(--fuente-texto);
      box-shadow: var(--sombra-tarjeta);
      text-decoration: none;
    }
    .staff[aria-current='page'] { color: var(--color-rojo); border-color: var(--color-rojo); }
    :focus-visible { outline: 2px solid var(--color-rojo); outline-offset: 2px; }
  `;

  private cambiarTemporada(evento: Event) {
    const select = evento.currentTarget as HTMLSelectElement;
    this.dispatchEvent(new CustomEvent('temporada-cambiada', { detail: select.value }));
  }

  render() {
    return html`
      <header>
        <div class="escudo" aria-hidden="true"><span></span></div>
        <div>
          <strong>CR Guindalera</strong>
          <div class="temporada">
            <span class="equipo">Senior femenino</span>
            <select aria-label="Temporada" .value=${this.seleccionada} @change=${this.cambiarTemporada}>
              ${this.temporadas.map((temporada) => html`<option value=${temporada.id}>${temporada.nombre}</option>`)}
            </select>
          </div>
        </div>
        <a class="staff" href="#staff" aria-current=${this.enStaff ? 'page' : nothing}>${this.usuarioDemo || 'Staff'}</a>
      </header>
    `;
  }
}

customElements.define('crg-header', CrgHeader);
