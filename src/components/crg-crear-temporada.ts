import { css, html, LitElement, nothing } from 'lit';
import type { Temporada } from '../data/temporadas-demo';
import { leerImporteHucha, resumirHucha } from '../lib/hucha';
import { euros } from '../lib/presentacion';
import type { GestionarStaff } from '../lib/supabase';

class CrgCrearTemporada extends LitElement {
  static properties = {
    temporada: { attribute: false }, gestionar: { attribute: false },
    nombre: { state: true }, inicial: { state: true }, guardando: { state: true }, error: { state: true },
  };

  declare temporada: Temporada;
  declare gestionar: GestionarStaff;
  private declare nombre: string;
  private declare inicial?: string;
  private declare guardando: boolean;
  private declare error: string;

  constructor() {
    super();
    this.nombre = '';
    this.guardando = false;
    this.error = '';
  }

  static styles = css`
    :host { display: block; }
    h1, p { margin: 0; }
    h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.04em; }
    .volver { display: inline-flex; align-items: center; min-height: 44px; color: inherit; font-size: 0.82rem; font-weight: 800; text-decoration: none; }
    .tarjeta { margin-top: 0.8rem; padding: 0.85rem; border: 1px solid var(--color-borde); border-radius: var(--radio-tarjeta); background: var(--color-superficie); box-shadow: var(--sombra-tarjeta); }
    .apunte { color: var(--color-gris); font-size: 0.81rem; line-height: 1.4; }
    label { display: grid; gap: 0.35rem; margin: 0.75rem 0; font-size: 0.84rem; font-weight: 700; }
    input, button { min-height: 44px; border-radius: 0.65rem; padding: 0.45rem 0.65rem; font: inherit; }
    input { box-sizing: border-box; width: 100%; background: var(--color-fondo); color: inherit; border: 1px solid var(--color-borde); }
    button { margin-top: 0.7rem; border: 0; background: var(--color-rojo); color: white; font-weight: 800; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: default; }
    .error { margin-top: 0.55rem; color: var(--color-rojo); font-size: 0.82rem; }
    :focus-visible { outline: none; }
  `;

  private async crear(evento: SubmitEvent) {
    evento.preventDefault();
    if (this.guardando) return;
    const nombre = this.nombre.trim();
    const huchaInicial = this.inicial === undefined ? null : leerImporteHucha(this.inicial);
    if (!nombre || huchaInicial === undefined) {
      this.error = 'Indica el nombre de la temporada y un importe inicial válido.';
      return;
    }

    this.guardando = true;
    this.error = '';
    try {
      const resultado = await this.gestionar({ funcion: 'crear_temporada', nombre, hucha_inicial: huchaInicial });
      if (resultado.ok) {
        this.nombre = '';
        this.inicial = undefined;
      } else this.error = resultado.error;
    } catch {
      this.error = 'No se pudo confirmar la creación. Revisa el selector de temporadas antes de repetirla.';
    } finally {
      this.guardando = false;
    }
  }

  render() {
    const { saldo } = resumirHucha(this.temporada);
    return html`
      <a class="volver" href="#inicio">← Volver a Inicio</a>
      <h1>Crear temporada</h1>
      <form class="tarjeta" novalidate @submit=${this.crear} aria-busy=${this.guardando ? 'true' : 'false'}>
        <p class="apunte">Saldo actual de ${this.temporada.nombre}: <strong>${euros(saldo)}</strong></p>
        <label>Nombre<input name="nombre" placeholder="Ej. 2027/28" .value=${this.nombre} ?disabled=${this.guardando}
          @input=${(evento: Event) => { this.nombre = (evento.currentTarget as HTMLInputElement).value; }}></label>
        <label>Importe inicial en euros<input name="importe" inputmode="decimal" .value=${this.inicial ?? String(saldo).replace('.', ',')}
          ?disabled=${this.guardando} @input=${(evento: Event) => { this.inicial = (evento.currentTarget as HTMLInputElement).value; }}></label>
        <p class="apunte">Al crearla, se activará la nueva temporada.</p>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <button type="submit" ?disabled=${this.guardando}>${this.guardando ? 'Creando…' : 'Crear y activar temporada'}</button>
      </form>
    `;
  }
}

customElements.define('crg-crear-temporada', CrgCrearTemporada);
