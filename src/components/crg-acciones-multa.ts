import { css, html, LitElement, nothing } from 'lit';
import type { Multa } from '../data/temporadas-demo';
import { euros } from '../lib/presentacion';
import { fechaEnMadrid, importeActual } from '../lib/reglas';
import type { DeclararPago, GestionarStaff, ResultadoGestion } from '../lib/supabase';

type Accion = 'declarar' | 'cobrar' | 'aceptar' | 'rechazar' | 'anular';
const instrucciones: Record<Accion, string> = {
  declarar: '¿Confirmas que ya has pagado esta multa? El pago queda pendiente de revisión por Staff.',
  cobrar: 'Indica la fecha en que se recibió el pago.',
  aceptar: 'Confirma la fecha en que se recibió el pago.',
  rechazar: '¿Rechazar esta declaración? La multa volverá a estar pendiente.',
  anular: 'Indica el motivo para anular la multa.',
};
const confirmaciones: Record<Accion, string> = {
  declarar: 'Enviar declaración',
  cobrar: 'Confirmar cobro',
  aceptar: 'Confirmar pago',
  rechazar: 'Rechazar declaración',
  anular: 'Confirmar anulación',
};

class CrgAccionesMulta extends LitElement {
  static properties = {
    multa: { attribute: false },
    declarar: { attribute: false },
    gestionar: { attribute: false },
    accion: { state: true },
    guardando: { state: true },
    error: { state: true },
    fecha: { state: true },
    motivo: { state: true },
  };

  declare multa: Multa;
  declare declarar?: DeclararPago;
  declare gestionar?: GestionarStaff;
  declare private accion?: Accion;
  declare private guardando: boolean;
  declare private error: string;
  declare private fecha: string;
  declare private motivo: string;

  constructor() {
    super();
    this.guardando = false;
    this.error = '';
    this.fecha = '';
    this.motivo = '';
  }

  static styles = css`
    :host {
      display: block;
    }
    p {
      margin: 0;
      font-size: 0.81rem;
      line-height: 1.45;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.45rem;
    }
    button,
    input,
    textarea {
      box-sizing: border-box;
      min-height: 44px;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--color-borde);
      border-radius: 0.65rem;
      background: var(--color-superficie);
      color: inherit;
      font: 700 0.82rem var(--fuente-texto);
    }
    button {
      cursor: pointer;
    }
    button:disabled {
      cursor: default;
      opacity: 0.6;
    }
    button.principal {
      background: var(--color-tarjeta-oscura);
      color: white;
    }
    button.peligro {
      background: var(--color-rojo);
      color: white;
    }
    form {
      margin-top: 0.55rem;
      padding: 0.65rem;
      border-radius: 0.7rem;
      background: var(--color-suave);
    }
    label {
      display: grid;
      gap: 0.3rem;
      margin: 0.5rem 0;
      font-size: 0.82rem;
      font-weight: 700;
    }
    input,
    textarea {
      width: 100%;
      font-weight: 500;
    }
    .error {
      margin-top: 0.45rem;
      color: var(--color-rojo);
    }
    :focus-visible {
      outline: none;
    }
  `;

  private abrir(accion: Accion) {
    this.accion = accion;
    this.error = '';
    this.motivo = '';
    this.fecha = fechaEnMadrid(accion === 'aceptar' && this.multa.declarada_en ? this.multa.declarada_en : new Date());
  }

  private async enviar(evento: SubmitEvent) {
    evento.preventDefault();
    const accion = this.accion;
    const id = this.multa.id;
    if (!id || !accion || this.guardando) return;
    if (accion === 'anular' && !this.motivo.trim()) {
      this.error = 'Indica el motivo de la anulación.';
      return;
    }

    this.guardando = true;
    this.error = '';
    try {
      const resultado = await this.ejecutar(accion, id);
      if (!resultado.ok) this.error = resultado.error;
      else this.accion = undefined;
    } catch {
      this.error = 'No se pudo confirmar la operación. Actualiza los datos antes de volver a intentarlo.';
    } finally {
      this.guardando = false;
    }
  }

  private ejecutar(accion: Accion, id: string): Promise<ResultadoGestion> {
    if (accion === 'declarar' && this.declarar) return this.declarar(id);
    if (!this.gestionar) return Promise.resolve({ ok: false, error: 'Inicia sesión para continuar.' });
    switch (accion) {
      case 'cobrar':
        return this.gestionar({ funcion: 'marcar_pagada', multa_id: id, fecha_pago: this.fecha });
      case 'aceptar':
        return this.gestionar({ funcion: 'verificar_pago', multa_id: id, aceptar: true, fecha_pago: this.fecha });
      case 'rechazar':
        return this.gestionar({ funcion: 'verificar_pago', multa_id: id, aceptar: false, fecha_pago: null });
      case 'anular':
        return this.gestionar({ funcion: 'anular_multa', multa_id: id, motivo: this.motivo.trim() });
      default:
        return Promise.resolve({ ok: false, error: 'Operación no disponible.' });
    }
  }

  render() {
    const { id, estado } = this.multa;
    if (!id || estado === 'anulada') return nothing;
    if (!this.accion)
      return html` <div class="acciones">
        ${estado === 'pendiente' && this.declarar && !this.gestionar ? html`<button type="button" @click=${() => this.abrir('declarar')}>Ya he pagado</button>` : nothing}
        ${estado === 'pendiente' && this.gestionar ? html`<button class="principal" type="button" @click=${() => this.abrir('cobrar')}>Marcar como pagada</button>` : nothing}
        ${
          estado === 'pago_declarado' && this.gestionar
            ? html`
                <button class="principal" type="button" @click=${() => this.abrir('aceptar')}>Aceptar pago</button>
                <button type="button" @click=${() => this.abrir('rechazar')}>Rechazar pago</button>
              `
            : nothing
        }
        ${this.gestionar ? html`<button type="button" @click=${() => this.abrir('anular')}>Anular</button>` : nothing}
      </div>`;

    const accion = this.accion;
    const solicitaFecha = accion === 'cobrar' || accion === 'aceptar';
    const hoy = fechaEnMadrid(new Date());
    return html`<form @submit=${this.enviar} aria-busy=${this.guardando ? 'true' : 'false'}>
      <p>${instrucciones[accion]}</p>
      ${
        solicitaFecha
          ? html`<label
                >Fecha de pago
                <input
                  name="fecha_pago"
                  type="date"
                  min=${this.multa.fecha}
                  max=${hoy}
                  required
                  .value=${this.fecha}
                  ?disabled=${this.guardando}
                  @input=${(evento: Event) => {
                    this.fecha = (evento.currentTarget as HTMLInputElement).value;
                  }}
                />
              </label>
              ${this.fecha ? html`<p>Importe a cobrar: <strong>${euros(importeActual(this.multa, accion === 'cobrar' ? this.fecha : hoy))}</strong></p>` : nothing} `
          : nothing
      }
      ${
        accion === 'anular'
          ? html`<label
              >Motivo<textarea
                name="motivo"
                required
                .value=${this.motivo}
                ?disabled=${this.guardando}
                @input=${(evento: Event) => {
                  this.motivo = (evento.currentTarget as HTMLTextAreaElement).value;
                }}
              ></textarea>
            </label>`
          : nothing
      }
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      <div class="acciones">
        <button
          class=${accion === 'anular' || accion === 'rechazar' ? 'peligro' : 'principal'}
          type="submit"
          ?disabled=${this.guardando}
        >
          ${this.guardando ? 'Guardando…' : confirmaciones[accion]}
        </button>
        <button
          type="button"
          ?disabled=${this.guardando}
          @click=${() => {
            this.accion = undefined;
          }}
        >
          Cancelar
        </button>
      </div>
    </form>`;
  }
}

customElements.define('crg-acciones-multa', CrgAccionesMulta);
