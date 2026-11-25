import { css, html, LitElement, nothing, type PropertyValues } from 'lit';

type Resultado = { ok: true } | { ok: false; error: string };
type Estado = 'carga' | 'exito' | 'error' | 'incierto' | 'actualizando';
type Decision = 'cerrar' | 'reintentar' | 'actualizar';

type Operacion<T> = {
  carga: string;
  exito: string | ((resultado: T) => string);
  actualizar: () => Promise<boolean>;
  revisar: () => void;
  enfocarContenido: () => void;
};

function elementoActivo(): HTMLElement | undefined {
  let activo = document.activeElement;
  while (activo?.shadowRoot?.activeElement) activo = activo.shadowRoot.activeElement;
  return activo instanceof HTMLElement ? activo : undefined;
}

export class CrgOperacion extends LitElement {
  static properties = {
    estado: { state: true },
    mensaje: { state: true },
    fallos: { state: true },
    revision: { state: true },
  };

  declare private estado: Estado;
  declare private mensaje: string;
  declare private fallos: number;
  declare private revision: string;
  private ocupada = false;
  private responder?: (decision: Decision) => void;

  static styles = css`
    dialog {
      box-sizing: border-box;
      width: min(25rem, calc(100% - 2rem));
      padding: 1.25rem;
      border: 1px solid var(--color-borde);
      border-radius: 1.25rem;
      color: var(--color-primario);
      background: var(--color-superficie);
      box-shadow: var(--sombra-tarjeta);
      text-align: center;
    }
    dialog::backdrop {
      background: rgb(15 23 42 / 52%);
    }
    h2 {
      font-size: 1.15rem;
      line-height: 1.3;
      margin: 0.6rem 0 0;
      overflow-wrap: anywhere;
    }
    p {
      margin: 0.45rem 0 0;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .icono {
      box-sizing: border-box;
      display: inline-grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      font: 800 1.6rem var(--fuente-texto);
      background: var(--color-suave);
    }
    .exito {
      background: #e6f5ec;
      color: #14643a;
    }
    .error {
      background: var(--color-rojo-claro);
      color: var(--color-rojo);
    }
    .carga {
      border: 4px solid var(--color-borde);
      border-top-color: var(--color-primario);
      animation: girar 0.85s linear infinite;
    }
    @keyframes girar {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .carga {
        animation: none;
      }
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    button {
      min-height: 44px;
      padding: 0.4rem 0.85rem;
      border-radius: 0.7rem;
      border: 1px solid var(--color-borde);
      background: var(--color-superficie);
      color: var(--color-primario);
      font: 700 0.85rem var(--fuente-texto);
      cursor: pointer;
    }
    button.principal {
      background: var(--color-tarjeta-oscura);
      color: white;
    }
    :focus-visible {
      outline: none;
    }
  `;

  private decidir(decision: Decision) {
    const responder = this.responder;
    this.responder = undefined;
    responder?.(decision);
  }

  private cancelar(evento: Event) {
    evento.preventDefault();
    this.decidir('cerrar');
  }

  private alPulsarTecla(evento: KeyboardEvent) {
    if (evento.key === 'Escape') this.cancelar(evento);
  }

  private esperar(): Promise<Decision> {
    return new Promise((resolver) => {
      this.responder = resolver;
    });
  }

  async ejecutar<T extends Resultado>(
    op: Operacion<T>,
    escribir: () => Promise<T>,
  ): Promise<T | { ok: false; error: string }> {
    if (this.ocupada) return { ok: false, error: 'Hay otra operación en curso.' };
    const origen = elementoActivo();
    this.ocupada = true;
    this.fallos = 0;
    this.revision = '';
    let revisar = false;
    try {
      for (;;) {
        this.estado = 'carga';
        this.mensaje = op.carga;
        await this.updateComplete;
        const dialogo = this.renderRoot.querySelector('dialog');
        if (dialogo && !dialogo.open) dialogo.showModal();
        this.enfocarTitulo();

        let resultado: T;
        try {
          resultado = await escribir();
        } catch {
          this.fallos++;
          this.mensaje = 'No se pudo confirmar la operación.';
          this.estado = 'incierto';
          while ((await this.esperar()) === 'actualizar') {
            this.estado = 'actualizando';
            const actualizada = await op.actualizar().catch(() => false);
            this.estado = 'incierto';
            this.revision = actualizada
              ? 'Datos actualizados. Revisa si el cambio aparece antes de volver a enviarlo.'
              : 'No se pudieron actualizar los datos.';
          }
          revisar = true;
          return { ok: false, error: '' };
        }

        if (resultado.ok) {
          this.estado = 'exito';
          this.mensaje = typeof op.exito === 'string' ? op.exito : op.exito(resultado);
          await this.esperar();
          return resultado;
        }
        this.estado = 'error';
        this.mensaje = resultado.error;
        this.fallos++;
        if ((await this.esperar()) !== 'reintentar') return resultado;
      }
    } finally {
      this.renderRoot.querySelector('dialog')?.close();
      this.ocupada = false;
      if (revisar) op.revisar();
      requestAnimationFrame(() => {
        if (!revisar && origen?.isConnected && !origen.matches(':disabled')) origen.focus({ preventScroll: true });
        else op.enfocarContenido();
      });
    }
  }

  protected updated(cambios: PropertyValues) {
    if (cambios.has('estado') && this.renderRoot.querySelector('dialog')?.open) this.enfocarTitulo();
  }

  private enfocarTitulo() {
    this.renderRoot.querySelector('h2')?.focus({ preventScroll: true });
  }

  render() {
    const enCurso = this.estado === 'carga' || this.estado === 'actualizando';
    const incierto = this.estado === 'incierto' || this.estado === 'actualizando';
    return html`
      <dialog
        closedby="none"
        aria-labelledby="operacion-titulo"
        aria-describedby="operacion-descripcion"
        @keydown=${this.alPulsarTecla}
        @cancel=${this.cancelar}
      >
        <div role="status" aria-live="polite" aria-atomic="true">
          <span class="icono ${enCurso ? 'carga' : this.estado === 'exito' ? 'exito' : 'error'}" aria-hidden="true">
            ${enCurso ? nothing : this.estado === 'exito' ? '✓' : '!'}
          </span>
          <h2 id="operacion-titulo" tabindex="-1" autofocus>
            ${this.estado === 'actualizando' ? 'Actualizando datos…' : this.mensaje}
          </h2>
          <div id="operacion-descripcion">
            ${incierto ? html`<p>Revisa los datos antes de volver a intentarlo.</p>` : nothing}
            ${this.revision && incierto ? html`<p>${this.revision}</p>` : nothing}
            ${
              this.fallos >= 3 && this.estado !== 'exito' && !enCurso
                ? html`<p>Contacta con la persona responsable de la aplicación.</p>`
                : nothing
            }
          </div>
        </div>
        ${
          enCurso
            ? nothing
            : html`<div class="acciones">
                ${this.estado === 'error' ? html`<button class="principal" type="button" @click=${() => this.decidir('reintentar')}>Reintentar</button>` : nothing}
                ${incierto ? html`<button class="principal" type="button" @click=${() => this.decidir('actualizar')}>Actualizar datos</button>` : nothing}
                <button
                  type="button"
                  class=${this.estado === 'exito' ? 'principal' : ''}
                  @click=${() => this.decidir('cerrar')}
                >
                  ${this.estado === 'exito' ? 'Aceptar' : incierto ? 'Revisar datos' : 'Cerrar'}
                </button>
              </div>`
        }
      </dialog>
    `;
  }
}

customElements.define('crg-operacion', CrgOperacion);
