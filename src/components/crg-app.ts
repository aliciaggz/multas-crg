import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { crearTemporadasDemo, type Temporada } from '../data/temporadas-demo';
import { crearAccesoDemo } from '../lib/acceso-demo';
import { resumirHucha } from '../lib/hucha';
import { euros } from '../lib/presentacion';
import './crg-acceso';
import './crg-catalogo';
import './crg-detalle';
import './crg-header';
import './crg-hucha';
import './crg-jugadoras';

class CrgApp extends LitElement {
  static properties = { ruta: { state: true }, temporada: { state: true }, sesionDemo: { state: true } };

  private readonly hoy = new Date();
  private readonly temporadas = crearTemporadasDemo(this.hoy);
  private readonly accesoDemo = crearAccesoDemo();
  private declare ruta: string;
  private declare temporada: Temporada;
  private declare sesionDemo: string;

  constructor() {
    super();
    this.temporada = this.temporadas.find(({ activa }) => activa) ?? this.temporadas[0];
    this.ruta = window.location.hash;
    this.sesionDemo = '';
  }

  static styles = css`
    :host { display: block; }
    .contenido {
      box-sizing: border-box; max-width: var(--ancho-contenido); margin-inline: auto;
      padding: 1rem 0.85rem calc(5.5rem + env(safe-area-inset-bottom));
    }
    .hucha {
      box-sizing: border-box; position: relative; isolation: isolate; overflow: hidden;
      min-height: 10.4rem; margin-bottom: 1rem; border-radius: 1.5rem;
      padding: 1.15rem 7.1rem 1.05rem 1.15rem;
      display: flex; flex-direction: column; justify-content: space-between;
      background: var(--color-tarjeta-oscura); color: white; text-decoration: none;
      box-shadow: 0 10px 25px rgb(15 23 42 / 11%);
    }
    .hucha h2 { margin: 0; color: #e1e8f4; font: 600 0.8rem var(--fuente-etiqueta); text-transform: uppercase; letter-spacing: 0.035em; }
    .hucha strong { display: block; margin-top: 0.2rem; font: 700 clamp(1.85rem, 8.5vw, 2.85rem) var(--fuente-etiqueta); letter-spacing: -0.055em; white-space: nowrap; }
    .hucha p { margin: 0.65rem 0 0; color: #c4cde1; font-size: 0.69rem; font-weight: 600; line-height: 1.5; }
    .hucha img {
      position: absolute; right: 0.65rem; bottom: 0; z-index: -1; width: 6rem; height: 6rem;
      border-radius: 1rem 1rem 0 0; object-fit: cover;
    }
    .demo { margin: 0 0 0.65rem 0.12rem; color: var(--color-gris); font: 600 0.7rem var(--fuente-etiqueta); }
    nav {
      position: fixed; inset: auto 0 0; z-index: 2;
      border-top: 1px solid var(--color-borde); background: var(--color-superficie);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .navegacion { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: var(--ancho-contenido); margin: auto; }
    nav a {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem;
      min-height: 3.65rem; padding: 0.25rem; border: 0; background: none; color: var(--color-gris);
      text-decoration: none; font: 700 0.7rem var(--fuente-texto); line-height: 1.2;
    }
    nav a[aria-current='page'] { color: var(--color-rojo); }
    .icono { display: inline-grid; place-items: center; width: 1.45rem; height: 1.45rem; font: 700 1.34rem / 1 system-ui, sans-serif; }
    .icono.inicio::before { content: '⌂'; font-size: 1.65rem; transform: translateY(-0.12rem); }
    .icono.personas { position: relative; }
    .icono.personas::before {
      content: ''; position: absolute; inset: 0.08rem auto auto 0.37rem;
      width: 0.32rem; height: 0.32rem; border: 1.5px solid currentColor; border-radius: 50%;
      box-shadow: 0.5rem 0 0 -1px currentColor;
    }
    .icono.personas::after {
      content: ''; position: absolute; inset: auto auto 0.23rem 0.11rem;
      width: 0.85rem; height: 0.38rem; border: 1.5px solid currentColor; border-radius: 0.6rem 0.6rem 0.18rem 0.18rem;
      box-shadow: 0.27rem 0 0 -1px currentColor;
    }
    .icono.bote::before { content: '▣'; }
    .icono.libro::before { content: '▤'; }
    :focus-visible { outline: 2px solid var(--color-rojo); outline-offset: 2px; }
    @media (min-width: 34rem) {
      .contenido { padding-inline: 1rem; }
      .hucha { min-height: 12rem; padding: 1.35rem 11rem 1.25rem 1.45rem; }
      .hucha img { right: 1rem; width: 8.4rem; height: 8.4rem; }
      .hucha p { font-size: 0.8rem; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.actualizarRuta();
    window.addEventListener('hashchange', this.actualizarRuta);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.actualizarRuta);
    super.disconnectedCallback();
  }

  private actualizarRuta = () => { this.ruta = window.location.hash; };

  protected updated(cambios: PropertyValues) {
    if (cambios.has('ruta')) {
      window.scrollTo(0, 0);
    }
  }

  private cambiarTemporada(evento: CustomEvent<string>) {
    const temporada = this.temporadas.find(({ id }) => id === evento.detail);
    if (!temporada) return;
    this.temporada = temporada;
    if (this.ruta.startsWith('#jugadora/') && !temporada.jugadoras.some(({ id }) => `#jugadora/${id}` === this.ruta)) {
      window.location.hash = 'jugadoras';
    }
  }

  private tarjetaHucha() {
    const pendientes = this.temporada.multas.filter(({ estado }) => estado === 'pendiente' || estado === 'pago_declarado');
    const { saldo } = resumirHucha(this.temporada);

    return html`
      <a class="hucha" href="#hucha">
        <div><h2>La hucha de Nacho</h2><strong>${euros(saldo)}</strong></div>
        <p>Temporada ${this.temporada.nombre}<br>Saldo disponible · ${pendientes.length}
          ${pendientes.length === 1 ? 'multa pendiente' : 'multas pendientes'}</p>
        <img src=${`${import.meta.env.BASE_URL}nacho-pig.png`} width="96" height="96" alt="">
      </a>
    `;
  }

  render() {
    const jugadora = this.temporada.jugadoras.find(({ id }) => `#jugadora/${id}` === this.ruta);
    const mostrarInicio = this.ruta === '' || this.ruta === '#inicio';
    const esCatalogo = this.ruta === '#catalogo';
    const esHucha = this.ruta === '#hucha';
    const esStaff = this.ruta === '#staff';
    const esPlantilla = !esCatalogo && !esHucha && !esStaff && !jugadora;

    return html`
      <crg-header .temporadas=${this.temporadas} .seleccionada=${this.temporada.id}
        .usuarioDemo=${this.sesionDemo} .enStaff=${esStaff}
        @temporada-cambiada=${this.cambiarTemporada}></crg-header>
      <main class="contenido">
        <p class="demo">Datos de demostración</p>
        ${mostrarInicio ? this.tarjetaHucha() : nothing}
        <div ?hidden=${!esPlantilla}>
          <crg-jugadoras .temporada=${this.temporada} .hoy=${this.hoy}></crg-jugadoras>
        </div>
        ${jugadora ? html`
          <crg-detalle .jugadora=${jugadora} .hoy=${this.hoy}
            .multas=${this.temporada.multas.filter(({ jugadora_id }) => jugadora_id === jugadora.id)}></crg-detalle>
        ` : nothing}
        ${esCatalogo ? html`<crg-catalogo></crg-catalogo>` : nothing}
        ${esHucha ? html`<crg-hucha .temporada=${this.temporada}></crg-hucha>` : nothing}
        ${esStaff ? html`<crg-acceso .acceso=${this.accesoDemo} .temporada=${this.temporada.nombre} .sesion=${this.sesionDemo}
          @acceso-demo-confirmado=${(evento: CustomEvent<string>) => { this.sesionDemo = evento.detail; }}
          @cerrar-acceso-demo=${() => { this.sesionDemo = ''; }}></crg-acceso>` : nothing}
      </main>
      <nav aria-label="Navegación principal">
        <div class="navegacion">
          <a href="#inicio" aria-current=${mostrarInicio ? 'page' : nothing}><span class="icono inicio" aria-hidden="true"></span>Inicio</a>
          <a href="#jugadoras" aria-current=${!mostrarInicio && (esPlantilla || jugadora) ? 'page' : nothing}><span class="icono personas" aria-hidden="true"></span>Jugadoras</a>
          <a href="#hucha" aria-current=${esHucha ? 'page' : nothing}><span class="icono bote" aria-hidden="true"></span>Hucha</a>
          <a href="#catalogo" aria-current=${esCatalogo ? 'page' : nothing}><span class="icono libro" aria-hidden="true"></span>Catálogo</a>
        </div>
      </nav>
    `;
  }
}

customElements.define('crg-app', CrgApp);
