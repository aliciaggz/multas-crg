import { css, html, LitElement, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { Temporada } from "../data/temporadas-demo";
import { euros, fechaCorta, nombreConcepto } from "../lib/presentacion";
import { fechaEnMadrid, importeActual } from "../lib/reglas";
import type { GestionarStaff } from "../lib/supabase";
import "./crg-acciones-multa";

class CrgPagosPendientes extends LitElement {
  static properties = {
    temporada: { attribute: false },
    gestionar: { attribute: false },
  };
  declare temporada: Temporada;
  declare gestionar: GestionarStaff;

  static styles = css`
    :host {
      display: block;
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    .volver {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: inherit;
      font-size: 0.82rem;
      font-weight: 800;
      text-decoration: none;
    }
    .detalle {
      color: var(--color-gris);
      font-size: 0.8rem;
      margin-top: 0.3rem;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0.75rem 0;
      display: grid;
      gap: 0.6rem;
    }
    li,
    .vacio {
      padding: 0.85rem;
      background: var(--color-superficie);
      border: 1px solid var(--color-borde);
      border-radius: var(--radio-tarjeta);
      box-shadow: var(--sombra-tarjeta);
    }
    .vacio {
      margin-top: 0.75rem;
      font-size: 0.85rem;
    }
    .resumen {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 0.65rem;
    }
    h2 {
      font-size: 0.95rem;
    }
    h2 a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }
    strong {
      font: 700 1.1rem var(--fuente-etiqueta);
      white-space: nowrap;
    }
    :focus-visible {
      outline: 2px solid var(--color-rojo);
      outline-offset: 2px;
    }
  `;

  render() {
    const pendientes = this.temporada.multas
      .filter(({ estado }) => estado === "pago_declarado")
      .sort((a, b) =>
        (a.declarada_en ?? "").localeCompare(b.declarada_en ?? ""),
      );
    const hoy = new Date();
    return html`
      <a href="#staff" class="volver">← Volver a Staff</a>
      <h1>Pendientes de verificar</h1>
      <p class="detalle">
        Temporada ${this.temporada.nombre} · ${pendientes.length}
        ${pendientes.length === 1 ? "pago" : "pagos"}
      </p>
      ${pendientes.length
        ? html`<ul>
            ${repeat(
              pendientes,
              (multa) => multa.id,
              (multa) => {
                const jugadora = this.temporada.jugadoras.find(
                  ({ id }) => id === multa.jugadora_id,
                );
                return html`<li>
                  <div class="resumen">
                    <div>
                      <h2>
                        ${jugadora
                          ? html`<a href=${`#jugadora/${jugadora.id}`}
                              >#${jugadora.dorsal} ${jugadora.nombre}</a
                            >`
                          : "Jugadora"}
                      </h2>
                      <p class="detalle">
                        ${nombreConcepto(multa.concepto_id)}${multa.declarada_en
                          ? html` · Declarado el
                            ${fechaCorta(fechaEnMadrid(multa.declarada_en))}`
                          : nothing}
                      </p>
                    </div>
                    <strong>${euros(importeActual(multa, hoy))}</strong>
                  </div>
                  <crg-acciones-multa
                    .multa=${multa}
                    .gestionar=${this.gestionar}
                  ></crg-acciones-multa>
                </li>`;
              },
            )}
          </ul>`
        : html`<p class="vacio">No hay pagos pendientes de verificar.</p>`}
    `;
  }
}

customElements.define("crg-pagos-pendientes", CrgPagosPendientes);
