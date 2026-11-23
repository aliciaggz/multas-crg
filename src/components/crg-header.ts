import { css, html, LitElement, nothing } from "lit";
import type { ResumenTemporada } from "../data/temporadas-demo";

class CrgHeader extends LitElement {
  static properties = {
    temporadas: { attribute: false },
    seleccionada: { type: String },
    usuarioStaff: { type: String },
    enStaff: { type: Boolean },
    pagosPendientes: { type: Number },
  };
  declare temporadas: readonly ResumenTemporada[];
  declare seleccionada: string;
  declare usuarioStaff: string;
  declare enStaff: boolean;
  declare pagosPendientes: number;

  static styles = css`
    :host {
      display: block;
      border-bottom: 1px solid var(--color-borde);
    }
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
    .escudo span,
    .escudo span::after {
      clip-path: polygon(
        50% 0,
        100% 16%,
        100% 55%,
        84% 78%,
        50% 100%,
        16% 78%,
        0 55%,
        0 16%
      );
    }
    .escudo span {
      display: grid;
      place-items: center;
      width: 1.2rem;
      height: 1.42rem;
      background: var(--color-dorado);
    }
    .escudo span::after {
      content: "";
      width: 0.9rem;
      height: 1.08rem;
      background: linear-gradient(
        135deg,
        var(--color-tarjeta-oscura) 51%,
        var(--color-dorado) 52% 63%,
        var(--color-tarjeta-oscura) 64%
      );
    }
    strong {
      display: block;
      font-size: 1.05rem;
      font-weight: 800;
      letter-spacing: -0.035em;
    }
    .temporada {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      column-gap: 0.2rem;
    }
    .equipo {
      color: var(--color-rojo);
      font: 600 0.72rem var(--fuente-etiqueta);
    }
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
    .staff[aria-current="page"] {
      color: var(--color-rojo);
      border-color: var(--color-rojo);
    }
    .insignia {
      margin-left: 0.35rem;
      min-width: 1.15rem;
      height: 1.15rem;
      display: inline-grid;
      place-items: center;
      padding-inline: 0.16rem;
      border-radius: 999px;
      background: var(--color-rojo);
      color: white;
      font: 700 0.69rem var(--fuente-etiqueta);
    }
    :focus-visible {
      outline: 2px solid var(--color-rojo);
      outline-offset: 2px;
    }
  `;

  private cambiarTemporada(evento: Event) {
    const select = evento.currentTarget as HTMLSelectElement;
    this.dispatchEvent(
      new CustomEvent("temporada-cambiada", { detail: select.value }),
    );
  }

  render() {
    return html`
      <header>
        <div class="escudo" aria-hidden="true"><span></span></div>
        <div>
          <strong>CR Guindalera</strong>
          <div class="temporada">
            <span class="equipo">Senior femenino</span>
            ${this.temporadas.length
              ? html`
                  <select
                    aria-label="Temporada"
                    @change=${this.cambiarTemporada}
                  >
                    ${this.temporadas.map(
                      (temporada) => html`
                        <option
                          value=${temporada.id}
                          .selected=${temporada.id === this.seleccionada}
                        >
                          ${temporada.nombre}
                        </option>
                      `,
                    )}
                  </select>
                `
              : nothing}
          </div>
        </div>
        <a
          class="staff"
          href="#staff"
          aria-current=${this.enStaff ? "page" : nothing}
          >${this.usuarioStaff || "Staff"}
          ${this.pagosPendientes
            ? html`<span
                class="insignia"
                aria-label=${`${this.pagosPendientes} pagos por verificar`}
                >${this.pagosPendientes}</span
              >`
            : nothing}
        </a>
      </header>
    `;
  }
}

customElements.define("crg-header", CrgHeader);
