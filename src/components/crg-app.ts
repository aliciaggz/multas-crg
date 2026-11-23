import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import type { ResumenTemporada, Temporada } from "../data/temporadas-demo";
import { crearAccesoStaff } from "../lib/acceso-staff";
import {
  declararPago,
  ejecutarGestionStaff,
  leerDatosPublicos,
  loginStaff,
  registrarMulta,
  type CredencialesStaff,
  type DeclararPago,
  type GestionarStaff,
  type RespuestaRpc,
} from "../lib/supabase";
import { resumirHucha } from "../lib/hucha";
import { euros } from "../lib/presentacion";
import type { RegistroMulta, ResultadoGuardado } from "../lib/registro-multas";
import "./crg-acceso";
import "./crg-catalogo";
import "./crg-crear-temporada";
import "./crg-detalle";
import "./crg-header";
import "./crg-hucha";
import "./crg-jugadoras";
import "./crg-nueva-sancion";
import "./crg-pagos-pendientes";

const confirmaciones = {
  marcar_pagada: "Cobro registrado.",
  anular_multa: "Multa anulada.",
  verificar_pago: "Pago aceptado.",
  registrar_gasto: "Gasto registrado.",
  editar_hucha_inicial: "Importe inicial actualizado.",
  crear_temporada: "Temporada creada y activada.",
};

class CrgApp extends LitElement {
  static properties = {
    ruta: { state: true },
    temporada: { state: true },
    temporadas: { state: true },
    temporadaElegida: { state: true },
    cargando: { state: true },
    error: { state: true },
    usuarioStaff: { state: true },
    avisoStaff: { state: true },
    avisoOperacion: { state: true },
  };

  private readonly controlAcceso = crearAccesoStaff(loginStaff);
  private readonly acceso = {
    segundosRestantes: this.controlAcceso.segundosRestantes,
    intentar: (usuario: string, pin: string) => this.autenticar(usuario, pin),
  };
  #credenciales?: CredencialesStaff;
  private intentoAcceso = 0;
  private hoy = new Date();
  private consulta = 0;
  private intervalo?: number;
  declare private ruta: string;
  declare private temporada: Temporada | undefined;
  declare private temporadas: ResumenTemporada[];
  declare private temporadaElegida: string | undefined;
  declare private cargando: boolean;
  declare private error: string;
  declare private usuarioStaff: string;
  declare private avisoStaff: string;
  declare private avisoOperacion: string;

  constructor() {
    super();
    this.temporadas = [];
    this.ruta = window.location.hash;
    this.cargando = true;
    this.error = "";
    this.usuarioStaff = "";
    this.avisoStaff = "";
    this.avisoOperacion = "";
  }

  static styles = css`
    :host {
      display: block;
    }
    .contenido {
      box-sizing: border-box;
      max-width: var(--ancho-contenido);
      margin-inline: auto;
      padding: 1rem 0.85rem calc(5.5rem + env(safe-area-inset-bottom));
    }
    .hucha {
      box-sizing: border-box;
      position: relative;
      isolation: isolate;
      overflow: hidden;
      min-height: 10.4rem;
      margin-bottom: 1rem;
      border-radius: 1.5rem;
      padding: 1.15rem 7.1rem 1.05rem 1.15rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: var(--color-tarjeta-oscura);
      color: white;
      text-decoration: none;
      box-shadow: 0 10px 25px rgb(15 23 42 / 11%);
    }
    .hucha h2 {
      margin: 0;
      color: #e1e8f4;
      font: 600 0.8rem var(--fuente-etiqueta);
      text-transform: uppercase;
      letter-spacing: 0.035em;
    }
    .hucha strong {
      display: block;
      margin-top: 0.2rem;
      font: 700 clamp(1.85rem, 8.5vw, 2.85rem) var(--fuente-etiqueta);
      letter-spacing: -0.055em;
      white-space: nowrap;
    }
    .hucha p {
      margin: 0.65rem 0 0;
      color: #c4cde1;
      font-size: 0.69rem;
      font-weight: 600;
      line-height: 1.5;
    }
    .hucha img {
      position: absolute;
      right: 0.65rem;
      bottom: 0;
      z-index: -1;
      width: 6rem;
      height: 6rem;
      border-radius: 1rem 1rem 0 0;
      object-fit: cover;
    }
    .estado-carga {
      margin: 0 0 1rem;
      font-size: 0.88rem;
      color: var(--color-primario);
    }
    .estado-carga button {
      min-height: 44px;
      margin-inline-start: 0.5rem;
      border-radius: 0.6rem;
      padding-inline: 0.7rem;
      border: 1px solid var(--color-borde);
      background: var(--color-superficie);
      color: var(--color-primario);
      font: inherit;
      cursor: pointer;
    }
    nav {
      position: fixed;
      inset: auto 0 0;
      z-index: 2;
      border-top: 1px solid var(--color-borde);
      background: var(--color-superficie);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .navegacion {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      max-width: var(--ancho-contenido);
      margin: auto;
    }
    nav a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      min-height: 3.65rem;
      padding: 0.25rem;
      border: 0;
      background: none;
      color: var(--color-gris);
      text-decoration: none;
      font: 700 0.7rem var(--fuente-texto);
      line-height: 1.2;
    }
    nav a[aria-current="page"] {
      color: var(--color-rojo);
    }
    .icono {
      display: inline-grid;
      place-items: center;
      width: 1.45rem;
      height: 1.45rem;
      font:
        700 1.34rem / 1 system-ui,
        sans-serif;
    }
    .icono.inicio::before {
      content: "⌂";
      font-size: 1.65rem;
      transform: translateY(-0.12rem);
    }
    .icono.personas {
      position: relative;
    }
    .icono.personas::before {
      content: "";
      position: absolute;
      inset: 0.08rem auto auto 0.37rem;
      width: 0.32rem;
      height: 0.32rem;
      border: 1.5px solid currentColor;
      border-radius: 50%;
      box-shadow: 0.5rem 0 0 -1px currentColor;
    }
    .icono.personas::after {
      content: "";
      position: absolute;
      inset: auto auto 0.23rem 0.11rem;
      width: 0.85rem;
      height: 0.38rem;
      border: 1.5px solid currentColor;
      border-radius: 0.6rem 0.6rem 0.18rem 0.18rem;
      box-shadow: 0.27rem 0 0 -1px currentColor;
    }
    .icono.bote::before {
      content: "▣";
    }
    .icono.libro::before {
      content: "▤";
    }
    :focus-visible {
      outline: 2px solid var(--color-rojo);
      outline-offset: 2px;
    }
    @media (min-width: 34rem) {
      .contenido {
        padding-inline: 1rem;
      }
      .hucha {
        min-height: 12rem;
        padding: 1.35rem 11rem 1.25rem 1.45rem;
      }
      .hucha img {
        right: 1rem;
        width: 8.4rem;
        height: 8.4rem;
      }
      .hucha p {
        font-size: 0.8rem;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.actualizarRuta();
    window.addEventListener("hashchange", this.actualizarRuta);
    document.addEventListener("visibilitychange", this.refrescarSiVisible);
    this.intervalo = window.setInterval(this.refrescarSiVisible, 60_000);
    void this.cargarDatos();
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.actualizarRuta);
    document.removeEventListener("visibilitychange", this.refrescarSiVisible);
    window.clearInterval(this.intervalo);
    this.consulta++;
    this.cerrarSesion();
    super.disconnectedCallback();
  }

  private actualizarRuta = () => {
    if (this.ruta !== window.location.hash) {
      this.intentoAcceso++;
      this.avisoOperacion = "";
    }
    this.ruta = window.location.hash;
  };

  protected updated(cambios: PropertyValues) {
    if (cambios.has("ruta")) {
      window.scrollTo(0, 0);
    }
  }

  private refrescarSiVisible = () => {
    if (!document.hidden && !this.cargando) void this.cargarDatos();
  };

  private async cargarDatos() {
    const consulta = ++this.consulta;
    this.cargando = true;
    this.error = "";

    try {
      const { temporadas, temporada } = await leerDatosPublicos(
        this.temporadaElegida,
      );
      if (consulta !== this.consulta) return;

      if (import.meta.env.DEV && !this.temporadas.length && temporada.activa) {
        console.info(`[Supabase] Temporada activa: ${temporada.nombre}`, {
          jugadoras: temporada.jugadoras.length,
          multas: temporada.multas.length,
          gastos: temporada.gastos.length,
        });
      }
      this.hoy = new Date();
      this.temporadas = temporadas;
      this.temporada = temporada;
      if (this.temporadaElegida !== temporada.id)
        this.temporadaElegida = undefined;
      if (
        this.ruta.startsWith("#jugadora/") &&
        !temporada.jugadoras.some(({ id }) => `#jugadora/${id}` === this.ruta)
      ) {
        window.location.hash = "jugadoras";
      }
      return temporada;
    } catch (error) {
      if (consulta !== this.consulta) return;
      this.error = this.temporada
        ? "No se pudieron actualizar los datos. Se muestra la última lectura."
        : "No se pudieron cargar los datos de la temporada.";
      if (import.meta.env.DEV) console.error("[Supabase]", error);
    } finally {
      if (consulta === this.consulta) this.cargando = false;
    }
  }

  private cambiarTemporada(evento: CustomEvent<string>) {
    if (!this.temporadas.some(({ id }) => id === evento.detail)) return;
    this.avisoOperacion = "";
    this.temporadaElegida = evento.detail;
    this.temporada = undefined;
    void this.cargarDatos();
  }

  private mostrarTemporadaActiva() {
    this.temporadaElegida = undefined;
    this.temporada = undefined;
    void this.cargarDatos();
  }

  private async autenticar(usuario: string, pin: string) {
    const intento = ++this.intentoAcceso;
    this.avisoStaff = "";
    const resultado = await this.controlAcceso.intentar(usuario, pin);
    if (
      resultado.estado === "correcto" &&
      intento === this.intentoAcceso &&
      this.isConnected
    ) {
      this.#credenciales = { usuario: resultado.usuario, pin };
      this.usuarioStaff = resultado.usuario;
    }
    return resultado;
  }

  private cerrarSesion() {
    this.intentoAcceso++;
    this.#credenciales = undefined;
    this.usuarioStaff = "";
    this.avisoStaff = "";
    this.avisoOperacion = "";
  }

  private async solicitarStaff<T extends object>(
    ejecutar: (credenciales: CredencialesStaff) => Promise<RespuestaRpc<T>>,
  ): Promise<RespuestaRpc<T>> {
    const credenciales = this.#credenciales;
    if (!credenciales)
      return { ok: false, error: "Inicia sesión para continuar." };
    const resultado = await ejecutar(credenciales);
    if (
      !resultado.ok &&
      resultado.error === "No autorizado" &&
      this.#credenciales === credenciales
    ) {
      this.cerrarSesion();
      this.avisoStaff =
        "No se pudo autorizar la operación. Vuelve a iniciar sesión.";
    }
    return resultado;
  }

  private guardarMulta = async (
    multa: RegistroMulta,
    temporadaId: string,
  ): Promise<ResultadoGuardado> => {
    if (!this.temporada?.activa || this.temporada.id !== temporadaId) {
      return {
        ok: false,
        error: "Selecciona la temporada activa para registrar la multa.",
      };
    }

    const resultado = await this.solicitarStaff((credenciales) =>
      registrarMulta(credenciales, multa),
    );
    if (!resultado.ok) return resultado;

    const temporada = await this.cargarDatos();
    return {
      ok: true,
      temporada: temporada?.id === temporadaId ? temporada : undefined,
    };
  };

  private declarar: DeclararPago = async (multaId) => {
    this.avisoOperacion = "";
    const resultado = await declararPago(multaId);
    if (resultado.ok) {
      const temporada = await this.cargarDatos();
      const multa = temporada?.multas.find(({ id }) => id === multaId);
      this.avisoOperacion =
        multa?.estado === "pago_declarado"
          ? "Pago declarado. Staff lo revisará."
          : "Solicitud enviada. Consulta el estado de la multa.";
    }
    return resultado;
  };

  private gestionar: GestionarStaff = async (operacion) => {
    this.avisoOperacion = "";
    const resultado = await this.solicitarStaff((credenciales) =>
      ejecutarGestionStaff(credenciales, operacion),
    );
    if (!resultado.ok) return resultado;

    if (operacion.funcion === "crear_temporada")
      this.temporadaElegida = resultado.id;
    const temporada = await this.cargarDatos();
    const mensaje =
      operacion.funcion === "verificar_pago" && !operacion.aceptar
        ? "Declaración rechazada. La multa vuelve a estar pendiente."
        : confirmaciones[operacion.funcion];
    this.avisoOperacion = temporada
      ? mensaje
      : `${mensaje} Actualiza la pantalla para ver el cambio.`;
    return resultado;
  };

  private tarjetaHucha(temporada: Temporada) {
    const pendientes = temporada.multas.filter(
      ({ estado }) => estado === "pendiente" || estado === "pago_declarado",
    );
    const { saldo } = resumirHucha(temporada);

    return html`
      <a class="hucha" href="#hucha">
        <div>
          <h2>La hucha de Nacho</h2>
          <strong>${euros(saldo)}</strong>
        </div>
        <p>
          Temporada ${temporada.nombre}<br />Saldo disponible ·
          ${pendientes.length}
          ${pendientes.length === 1 ? "multa pendiente" : "multas pendientes"}
        </p>
        <img
          src=${`${import.meta.env.BASE_URL}nacho-pig.png`}
          width="96"
          height="96"
          alt=""
        />
      </a>
    `;
  }

  render() {
    const temporada = this.temporada;
    const jugadora = temporada?.jugadoras.find(
      ({ id }) => `#jugadora/${id}` === this.ruta,
    );
    const mostrarInicio = this.ruta === "" || this.ruta === "#inicio";
    const esCatalogo = this.ruta === "#catalogo";
    const esHucha = this.ruta === "#hucha";
    const esNuevaSancion = this.ruta === "#nueva-sancion";
    const esPagosPendientes = this.ruta === "#pagos-pendientes";
    const esCrearTemporada = this.ruta === "#crear-temporada";
    const esStaff =
      this.ruta === "#staff" ||
      esNuevaSancion ||
      esPagosPendientes ||
      esCrearTemporada;
    const esPlantilla = !esCatalogo && !esHucha && !esStaff && !jugadora;
    const gestor = this.usuarioStaff ? this.gestionar : undefined;
    const pagosPendientes =
      temporada?.multas.filter(({ estado }) => estado === "pago_declarado")
        .length ?? 0;

    return html`
      <crg-header
        .temporadas=${this.temporadas}
        .seleccionada=${this.temporadaElegida ?? temporada?.id ?? ""}
        .usuarioStaff=${this.usuarioStaff}
        .enStaff=${esStaff}
        .pagosPendientes=${pagosPendientes}
        @temporada-cambiada=${this.cambiarTemporada}
      ></crg-header>
      <main class="contenido">
        ${this.error
          ? html`<p class="estado-carga" role="status">
              ${this.error}<button type="button" @click=${this.cargarDatos}>
                Reintentar
              </button>
            </p>`
          : nothing}
        ${!temporada && this.cargando && !esCatalogo
          ? html`<p class="estado-carga" role="status">Cargando temporada…</p>`
          : nothing}
        ${this.avisoOperacion
          ? html`<p class="estado-carga" role="status">
              ${this.avisoOperacion}
            </p>`
          : nothing}
        ${esCatalogo ? html`<crg-catalogo></crg-catalogo>` : nothing}
        ${this.avisoStaff
          ? html`<p class="estado-carga" role="status">
              ${this.avisoStaff}
              ${!esStaff ? html`<a href="#staff">Abrir Staff</a>` : nothing}
            </p>`
          : nothing}
        ${temporada
          ? html`
              ${mostrarInicio ? this.tarjetaHucha(temporada) : nothing}
              <div ?hidden=${!esPlantilla}>
                <crg-jugadoras
                  .temporada=${temporada}
                  .hoy=${this.hoy}
                ></crg-jugadoras>
              </div>
              ${jugadora
                ? html`
                    <crg-detalle
                      .jugadora=${jugadora}
                      .hoy=${this.hoy}
                      .declarar=${this.declarar}
                      .gestionar=${gestor}
                      .multas=${temporada.multas.filter(
                        ({ jugadora_id }) => jugadora_id === jugadora.id,
                      )}
                    ></crg-detalle>
                  `
                : nothing}
              ${esHucha
                ? html`<crg-hucha
                    .temporada=${temporada}
                    .gestionar=${gestor}
                  ></crg-hucha>`
                : nothing}
              ${esStaff && (this.ruta === "#staff" || !gestor)
                ? html`
                    <crg-acceso
                      .acceso=${this.acceso}
                      .temporada=${this.temporadas.find(({ activa }) => activa)
                        ?.nombre ?? temporada.nombre}
                      .sesion=${this.usuarioStaff}
                      .pagosPendientes=${pagosPendientes}
                      @cerrar-acceso-staff=${this.cerrarSesion}
                    ></crg-acceso>
                  `
                : nothing}
              ${esNuevaSancion && this.usuarioStaff
                ? temporada.activa
                  ? html`
                      <crg-nueva-sancion
                        .temporada=${temporada}
                        .guardar=${this.guardarMulta}
                      ></crg-nueva-sancion>
                    `
                  : html`<p class="estado-carga">
                      El registro de multas se hace en la temporada activa.
                      <button
                        type="button"
                        @click=${this.mostrarTemporadaActiva}
                      >
                        Cambiar a la temporada activa
                      </button>
                    </p>`
                : nothing}
              ${esPagosPendientes && gestor
                ? html`<crg-pagos-pendientes
                    .temporada=${temporada}
                    .gestionar=${gestor}
                  ></crg-pagos-pendientes>`
                : nothing}
              ${esCrearTemporada && gestor
                ? temporada.activa
                  ? html`
                      <crg-crear-temporada
                        .temporada=${temporada}
                        .gestionar=${gestor}
                      ></crg-crear-temporada>
                    `
                  : html`<p class="estado-carga">
                      El importe propuesto procede de la hucha de la temporada
                      activa.
                      <button
                        type="button"
                        @click=${this.mostrarTemporadaActiva}
                      >
                        Cambiar a la temporada activa
                      </button>
                    </p>`
                : nothing}
            `
          : nothing}
      </main>
      <nav aria-label="Navegación principal">
        <div class="navegacion">
          <a href="#inicio" aria-current=${mostrarInicio ? "page" : nothing}
            ><span class="icono inicio" aria-hidden="true"></span>Inicio</a
          >
          <a
            href="#jugadoras"
            aria-current=${!mostrarInicio && (esPlantilla || jugadora)
              ? "page"
              : nothing}
            ><span class="icono personas" aria-hidden="true"></span>Jugadoras</a
          >
          <a href="#hucha" aria-current=${esHucha ? "page" : nothing}
            ><span class="icono bote" aria-hidden="true"></span>Hucha</a
          >
          <a href="#catalogo" aria-current=${esCatalogo ? "page" : nothing}
            ><span class="icono libro" aria-hidden="true"></span>Catálogo</a
          >
        </div>
      </nav>
    `;
  }
}

customElements.define("crg-app", CrgApp);
