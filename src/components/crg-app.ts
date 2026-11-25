import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import type { ResumenTemporada, Temporada } from '../data/temporadas-demo';
import { crearAccesoStaff, crearAlmacenSesionStaff, type SesionGuardada } from '../lib/acceso-staff';
import { crearDatosGuardados } from '../lib/datos-guardados';
import {
  cerrarSesionStaff, declararPago, ejecutarGestionStaff, iniciarSesionStaff, leerDatosPublicos, registrarMulta, validarSesionStaff,
  type DeclararPago, type GestionarStaff, type RespuestaRpc,
} from '../lib/supabase';
import { resumirHucha } from '../lib/hucha';
import { euros } from '../lib/presentacion';
import { enlaceFicha, multasDe } from '../lib/destinatarios';
import type { RegistroMulta, ResultadoGuardado } from '../lib/registro-multas';
import './crg-acceso';
import './crg-catalogo';
import './crg-crear-temporada';
import './crg-detalle';
import './crg-header';
import './crg-hucha';
import './crg-jugadoras';
import './crg-nueva-sancion';
import './crg-pagos-pendientes';

type Perfil = 'jugadoras' | 'entrenadores';
type EstadoSesion = 'sin-sesion' | 'validando' | 'activa' | 'error' | 'cerrando' | 'cierre-pendiente';

const clavePerfil = 'multas-crg:perfil';
const esRutaFicha = (ruta: string) => ruta.startsWith('#jugadora/') || ruta.startsWith('#tecnico/');
const rutasEntrenadores = ['#staff', '#nueva-sancion', '#pagos-pendientes', '#gestionar-hucha', '#crear-temporada'];
const formatoCopia = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid',
});

function leerPerfil(): Perfil | undefined {
  try {
    const perfil = localStorage.getItem(clavePerfil);
    if (perfil === 'jugadoras' || perfil === 'entrenadores') return perfil;
  } catch { /* La elección funciona también sin almacenamiento. */ }
}

const confirmaciones = {
  marcar_pagada: 'Cobro registrado.', anular_multa: 'Multa anulada.', verificar_pago: 'Pago aceptado.',
  registrar_gasto: 'Gasto registrado.', editar_hucha_inicial: 'Importe inicial actualizado.',
  crear_temporada: 'Temporada creada y activada.',
};

class CrgApp extends LitElement {
  static properties = {
    ruta: { state: true }, temporada: { state: true }, temporadas: { state: true },
    temporadaElegida: { state: true }, cargando: { state: true }, error: { state: true },
    estadoSesion: { state: true }, avisoStaff: { state: true }, avisoOperacion: { state: true },
    sinConexion: { state: true }, perfil: { state: true }, actualizadaEn: { state: true },
  };

  private readonly controlAcceso = crearAccesoStaff(iniciarSesionStaff);
  private readonly almacenSesion = crearAlmacenSesionStaff(import.meta.env.VITE_SUPABASE_URL);
  private readonly datosGuardados = crearDatosGuardados(import.meta.env.VITE_SUPABASE_URL);
  private readonly acceso = {
    segundosRestantes: this.controlAcceso.segundosRestantes,
    intentar: (pin: string) => this.autenticar(pin),
  };
  #sesion?: SesionGuardada;
  private intentoAcceso = 0;
  private hoy = new Date();
  private consulta = 0;
  private intervalo?: number;
  private declare ruta: string;
  private declare perfil?: Perfil;
  private declare actualizadaEn?: string;
  private vueltaFicha = '#inicio';
  private declare temporada: Temporada | undefined;
  private declare temporadas: ResumenTemporada[];
  private declare temporadaElegida: string | undefined;
  private declare cargando: boolean;
  private declare error: string;
  private declare estadoSesion: EstadoSesion;
  private declare avisoStaff: string;
  private declare avisoOperacion: string;
  private declare sinConexion: boolean;

  constructor() {
    super();
    this.temporadas = [];
    this.ruta = window.location.hash;
    this.perfil = leerPerfil();
    this.cargando = true;
    this.error = '';
    this.estadoSesion = 'sin-sesion';
    this.avisoStaff = '';
    this.avisoOperacion = '';
    this.sinConexion = !navigator.onLine;
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
    .hucha.entrenadores { background: var(--color-granate, #67223c); }
    .inicio-entrenadores { margin-bottom: 1rem; }
    .inicio-entrenadores h2 { margin: 0 0 0.55rem; font-size: 1.1rem; }
    .accesos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem; }
    .accesos a, .volver-gestion, dialog button {
      display: inline-flex; align-items: center; justify-content: center; min-height: 44px;
      border: 1px solid var(--color-borde); border-radius: 0.75rem; padding: 0.4rem 0.7rem;
      background: var(--color-superficie); color: var(--color-primario);
      font: 800 0.83rem var(--fuente-texto); text-align: center; text-decoration: none;
    }
    .accesos .principal { background: #67223c; color: white; border-color: transparent; }
    .volver-gestion { margin-bottom: 0.75rem; }
    dialog {
      box-sizing: border-box; width: min(23rem, calc(100% - 2rem)); padding: 1.25rem;
      border: 1px solid var(--color-borde); border-radius: 1.25rem; color: var(--color-primario);
      background: var(--color-superficie); box-shadow: var(--sombra-tarjeta);
    }
    dialog::backdrop { background: rgb(15 23 42 / 52%); backdrop-filter: blur(3px); }
    dialog h2 { margin: 0 0 0.85rem; font-size: 1.25rem; }
    dialog .opciones { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem; }
    dialog button { cursor: pointer; }
    .hucha h1 { margin: 0; color: #e1e8f4; font: 600 0.8rem var(--fuente-etiqueta); text-transform: uppercase; letter-spacing: 0.035em; }
    .hucha strong { display: block; margin-top: 0.2rem; font: 700 clamp(1.85rem, 8.5vw, 2.85rem) var(--fuente-etiqueta); letter-spacing: -0.055em; white-space: nowrap; }
    .hucha p { margin: 0.65rem 0 0; color: #c4cde1; font-size: 0.69rem; font-weight: 600; line-height: 1.5; }
    .hucha img {
      position: absolute; right: 0.65rem; bottom: 0; z-index: -1; width: 6rem; height: 6rem;
      object-fit: contain;
    }
    .estado-carga { margin: 0 0 1rem; font-size: 0.88rem; color: var(--color-primario); }
    .estado-carga a { display: inline-flex; align-items: center; min-height: 44px; }
    .aviso-sin-conexion { padding: 0.65rem 0.8rem; border-radius: 0.75rem; background: var(--color-suave); font-weight: 700; }
    .estado-carga button {
      min-height: 44px; margin-inline-start: 0.5rem; border-radius: 0.6rem;
      padding-inline: 0.7rem; border: 1px solid var(--color-borde);
      background: var(--color-superficie); color: var(--color-primario); font: inherit; cursor: pointer;
    }
    nav {
      position: fixed; inset: auto 0 0; z-index: 2;
      border-top: 1px solid var(--color-borde); background: var(--color-superficie);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .navegacion { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: var(--ancho-contenido); margin: auto; }
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
    window.addEventListener('online', this.recargarAlCambiarConexion);
    window.addEventListener('offline', this.recargarAlCambiarConexion);
    window.addEventListener('storage', this.alCambiarAlmacen);
    window.addEventListener('pageshow', this.alMostrarPagina);
    if (this.perfil === 'entrenadores') this.recuperarSesion();
    document.addEventListener('visibilitychange', this.refrescarSiVisible);
    this.intervalo = window.setInterval(this.refrescarSiVisible, 60_000);
    void this.cargarDatos();
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.actualizarRuta);
    window.removeEventListener('online', this.recargarAlCambiarConexion);
    window.removeEventListener('offline', this.recargarAlCambiarConexion);
    window.removeEventListener('storage', this.alCambiarAlmacen);
    window.removeEventListener('pageshow', this.alMostrarPagina);
    document.removeEventListener('visibilitychange', this.refrescarSiVisible);
    window.clearInterval(this.intervalo);
    this.consulta++;
    this.limpiarSesion();
    super.disconnectedCallback();
  }

  private actualizarRuta = () => {
    const ruta = window.location.hash;
    if (this.ruta !== ruta) {
      if (esRutaFicha(ruta) && !esRutaFicha(this.ruta)) {
        this.vueltaFicha = this.ruta === '#pagos-pendientes' ? '#pagos-pendientes' : '#inicio';
      }
      this.intentoAcceso++;
      this.avisoOperacion = '';
      this.ruta = ruta;
    }
    if (this.perfil === 'jugadoras' && rutasEntrenadores.includes(ruta)) {
      this.guardarPerfil('entrenadores');
      this.recuperarSesion();
    }
  };

  private navegar(ruta: string) {
    if (window.location.hash !== ruta) window.location.hash = ruta;
    this.actualizarRuta();
  }

  private guardarPerfil(perfil: Perfil) {
    if (perfil === this.perfil) return;
    this.perfil = perfil;
    try { localStorage.setItem(clavePerfil, perfil); } catch { /* Se conserva en esta visita. */ }
  }

  private elegirPerfil(perfil: Perfil) {
    if (perfil === 'jugadoras' && this.#sesion) return;
    const primeraVisita = !this.perfil;
    this.intentoAcceso++;
    this.avisoOperacion = '';
    const esRutaDeGestion = rutasEntrenadores.includes(this.ruta);
    if (!primeraVisita || (perfil === 'entrenadores' && !esRutaDeGestion)
      || (perfil === 'jugadoras' && esRutaDeGestion)) {
      this.navegar('#inicio');
    }
    this.guardarPerfil(perfil);
    if (perfil === 'entrenadores') this.recuperarSesion();
  }

  protected updated(cambios: PropertyValues) {
    const dialogo = this.renderRoot.querySelector('dialog');
    if (!this.perfil && dialogo && !dialogo.open) dialogo.showModal();
    if (this.perfil && dialogo?.open) dialogo.close();
    if (cambios.has('estadoSesion') && this.estadoSesion === 'activa') this.enfocarContenido();
    if (cambios.has('ruta') || cambios.has('perfil')) {
      window.scrollTo(0, 0);
      if (this.perfil && (cambios.get('ruta') !== undefined || cambios.has('perfil'))) this.enfocarContenido();
    }
  }

  private enfocarContenido() {
    this.renderRoot.querySelector('main')?.focus({ preventScroll: true });
  }

  private recargarAlCambiarConexion = () => {
    if (!this.#sesion?.cierrePendiente) {
      if (this.estadoSesion === 'validando' && !navigator.onLine) {
        // Invalida la respuesta de validación que todavía esté en curso.
        this.#sesion = this.#sesion && { ...this.#sesion };
        this.estadoSesion = 'error';
      }
      if (navigator.onLine) void this.validarSesion();
    }
    void this.cargarDatos();
  };

  private alMostrarPagina = (evento: PageTransitionEvent) => {
    if (evento.persisted) {
      this.sincronizarAlmacen();
      void this.validarSesion();
    }
  };

  private alCambiarAlmacen = (evento: StorageEvent) => {
    if (evento.key === null || evento.key === this.almacenSesion.clave) this.sincronizarAlmacen();
  };

  private sincronizarAlmacen() {
    const guardada = this.almacenSesion.leer();
    const actual = this.#sesion;
    if (actual?.token === guardada?.token && actual?.cierrePendiente === guardada?.cierrePendiente) return;
    if (this.perfil !== 'entrenadores') return;

    this.limpiarSesion();
    if (guardada) this.recuperarSesion();
    else if (actual) this.elegirPerfil('jugadoras');
  }

  private refrescarSiVisible = () => {
    if (!document.hidden && !this.cargando && navigator.onLine) void this.cargarDatos();
  };

  private cargarCopia() {
    const { temporadas, temporada, actualizadaEn } = this.datosGuardados.leer(this.temporadaElegida);
    if (temporadas.length) this.temporadas = temporadas;
    if (temporada) {
      this.temporada = temporada;
      this.actualizadaEn = actualizadaEn;
    }
    this.hoy = new Date();
    return Boolean(this.temporada);
  }

  private async cargarDatos() {
    const consulta = ++this.consulta;
    this.cargando = true;
    this.error = '';

    try {
      if (!navigator.onLine) {
        this.sinConexion = true;
        if (!this.cargarCopia()) this.error = 'No hay datos guardados de esta temporada. Conéctate para cargarla.';
        return;
      }
      const lectura = await leerDatosPublicos(this.temporadaElegida);
      if (consulta !== this.consulta) return;
      const { temporadas, temporada } = lectura;
      this.actualizadaEn = new Date().toISOString();
      this.datosGuardados.guardar(lectura, this.actualizadaEn);
      this.sinConexion = false;

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
      if (this.temporadaElegida !== temporada.id) this.temporadaElegida = undefined;
      if (esRutaFicha(this.ruta) && !this.destinatarioEnRuta(temporada)) {
        this.navegar('#inicio');
      }
      return temporada;
    } catch (error) {
      if (consulta !== this.consulta) return;
      const hayCopia = this.cargarCopia();
      this.sinConexion = !navigator.onLine || hayCopia;
      this.error = hayCopia ? '' : 'No se pudieron cargar los datos de la temporada.';
      if (import.meta.env.DEV) console.error('[Supabase]', error);
    } finally {
      if (consulta === this.consulta) this.cargando = false;
    }
  }

  private cambiarTemporada(evento: CustomEvent<string>) {
    if (!this.temporadas.some(({ id }) => id === evento.detail)) return;
    this.avisoOperacion = '';
    this.temporadaElegida = evento.detail;
    this.temporada = undefined;
    void this.cargarDatos();
  }

  private mostrarTemporadaActiva() {
    this.temporadaElegida = undefined;
    this.temporada = undefined;
    void this.cargarDatos();
  }

  private recuperarSesion() {
    if (this.#sesion) return;
    const guardada = this.almacenSesion.leer();
    if (!guardada) return;
    this.#sesion = guardada;
    if (guardada.cierrePendiente) this.estadoSesion = 'cierre-pendiente';
    else void this.validarSesion();
  }

  private async validarSesion() {
    const sesion = this.#sesion;
    if (!sesion || sesion.cierrePendiente || this.estadoSesion === 'validando') return;
    if (!navigator.onLine) {
      this.estadoSesion = 'error';
      return;
    }

    this.estadoSesion = 'validando';
    try {
      const respuesta = await validarSesionStaff(sesion.token);
      if (this.#sesion !== sesion) return;
      if (respuesta.ok) {
        if (!respuesta.usuario) throw new Error('La respuesta de sesión no es válida.');
        this.estadoSesion = 'activa';
      } else if (respuesta.error === 'No autorizado') {
        this.invalidarSesion(sesion);
      } else {
        this.estadoSesion = 'error';
      }
    } catch {
      if (this.#sesion === sesion) this.estadoSesion = 'error';
    }
  }

  private async autenticar(pin: string) {
    if (this.sinConexion || !navigator.onLine || this.#sesion) throw new Error('Acceso no disponible.');
    const intento = ++this.intentoAcceso;
    this.avisoStaff = '';
    const resultado = await this.controlAcceso.intentar(pin);
    if (resultado.estado === 'correcto') {
      if (intento !== this.intentoAcceso || !this.isConnected) {
        // Se abandonó el formulario mientras el servidor emitía la sesión.
        void cerrarSesionStaff(resultado.token).catch(() => {});
        return resultado;
      }
      this.#sesion = { token: resultado.token };
      this.almacenSesion.guardar(this.#sesion);
      this.estadoSesion = 'activa';
    }
    return resultado;
  }

  private limpiarSesion() {
    this.intentoAcceso++;
    this.#sesion = undefined;
    this.estadoSesion = 'sin-sesion';
    this.avisoStaff = '';
    this.avisoOperacion = '';
  }

  private invalidarSesion(sesion: SesionGuardada) {
    this.almacenSesion.quitar(sesion.token);
    this.limpiarSesion();
    this.avisoStaff = 'La sesión ya no es válida. Vuelve a introducir tu PIN.';
  }

  private async cerrarSesion() {
    if (!this.#sesion || this.estadoSesion === 'cerrando') return;
    const sesion: SesionGuardada = { token: this.#sesion.token, cierrePendiente: true };
    this.#sesion = sesion;
    this.almacenSesion.guardar(sesion);
    this.avisoOperacion = '';
    this.estadoSesion = 'cerrando';

    try {
      if (!navigator.onLine) throw new Error('Sin conexión.');
      const respuesta = await cerrarSesionStaff(sesion.token);
      if (this.#sesion !== sesion) return;
      if (!respuesta.ok) throw new Error('No se confirmó el cierre.');
      this.almacenSesion.quitar(sesion.token);
      this.limpiarSesion();
      this.elegirPerfil('jugadoras');
    } catch {
      if (this.#sesion === sesion) this.estadoSesion = 'cierre-pendiente';
    }
  }

  private async solicitarStaff<T extends object>(
    ejecutar: (token: string) => Promise<RespuestaRpc<T>>,
  ): Promise<RespuestaRpc<T>> {
    const sesion = this.#sesion;
    if (this.sinConexion || !navigator.onLine) return { ok: false, error: 'Conéctate para continuar.' };
    if (this.perfil !== 'entrenadores' || this.estadoSesion !== 'activa' || !sesion) {
      return { ok: false, error: 'Inicia sesión para continuar.' };
    }
    const resultado = await ejecutar(sesion.token);
    if (!resultado.ok && resultado.error === 'No autorizado' && this.#sesion === sesion) this.invalidarSesion(sesion);
    return resultado;
  }

  private guardarMulta = async (multa: RegistroMulta, temporadaId: string): Promise<ResultadoGuardado> => {
    if (!this.temporada?.activa || this.temporada.id !== temporadaId) {
      return { ok: false, error: 'Selecciona la temporada activa para registrar la multa.' };
    }

    const resultado = await this.solicitarStaff((token) => registrarMulta(token, multa));
    if (!resultado.ok) return resultado;

    const temporada = await this.cargarDatos();
    return { ok: true, temporada: temporada?.id === temporadaId ? temporada : undefined };
  };

  private declarar: DeclararPago = async (multaId) => {
    if (this.sinConexion || !navigator.onLine) return { ok: false, error: 'Conéctate para declarar el pago.' };
    this.avisoOperacion = '';
    const resultado = await declararPago(multaId);
    if (resultado.ok) {
      const temporada = await this.cargarDatos();
      const multa = temporada?.multas.find(({ id }) => id === multaId);
      this.avisoOperacion = multa?.estado === 'pago_declarado'
        ? 'Pago declarado. El cuerpo técnico lo revisará.' : 'Solicitud enviada. Consulta el estado de la multa.';
    }
    return resultado;
  };

  private gestionar: GestionarStaff = async (operacion) => {
    this.avisoOperacion = '';
    const resultado = await this.solicitarStaff((token) => ejecutarGestionStaff(token, operacion));
    if (!resultado.ok) return resultado;

    if (operacion.funcion === 'crear_temporada') this.temporadaElegida = resultado.id;
    const temporada = await this.cargarDatos();
    const mensaje = operacion.funcion === 'verificar_pago' && !operacion.aceptar
      ? 'Declaración rechazada. La multa vuelve a estar pendiente.' : confirmaciones[operacion.funcion];
    this.avisoOperacion = temporada ? mensaje : `${mensaje} Actualiza la pantalla para ver el cambio.`;
    return resultado;
  };

  private tarjetaHucha(temporada: Temporada) {
    const pendientes = temporada.multas.filter(({ estado }) => estado === 'pendiente' || estado === 'pago_declarado');
    const { saldo } = resumirHucha(temporada);

    return html`
      <a class=${this.perfil === 'entrenadores' ? 'hucha entrenadores' : 'hucha'} href="#hucha">
        <div><h1>La hucha de Nacho</h1><strong>${euros(saldo)}</strong></div>
        <p>Temporada ${temporada.nombre}<br>Saldo disponible · ${pendientes.length}
          ${pendientes.length === 1 ? 'multa pendiente' : 'multas pendientes'}</p>
        <img src=${`${import.meta.env.BASE_URL}nacho-pig-1.png`} width="96" height="96" alt="">
      </a>
    `;
  }

  private accesosEntrenadores(pagosPendientes: number) {
    return html`<section class="inicio-entrenadores" aria-labelledby="titulo-gestion">
      <h2 id="titulo-gestion">Gestión del equipo</h2>
      <div class="accesos">
        <a class="principal" href="#nueva-sancion">Nueva multa</a>
        <a href="#pagos-pendientes">${pagosPendientes} ${pagosPendientes === 1 ? 'pago' : 'pagos'} por verificar</a>
        <!-- <a href="#gestionar-hucha">Gestionar hucha</a>
        <a href="#crear-temporada">Crear temporada</a> -->
      </div>
    </section>`;
  }

  private destinatarioEnRuta(temporada?: Temporada) {
    if (this.ruta.startsWith('#tecnico/')) {
      return temporada?.tecnicos?.find((tecnico) => enlaceFicha(tecnico) === this.ruta);
    }
    if (this.ruta.startsWith('#jugadora/')) {
      return temporada?.jugadoras.find((jugadora) => enlaceFicha(jugadora) === this.ruta);
    }
  }

  render() {
    const temporada = this.temporada;
    const destinatario = this.destinatarioEnRuta(temporada);
    const esCatalogo = this.ruta === '#catalogo';
    const esGestionHucha = this.ruta === '#gestionar-hucha';
    const esHucha = this.ruta === '#hucha' || esGestionHucha;
    const esNuevaSancion = this.ruta === '#nueva-sancion';
    const esPagosPendientes = this.ruta === '#pagos-pendientes';
    const esCrearTemporada = this.ruta === '#crear-temporada';
    const esEntrenadores = this.perfil === 'entrenadores';
    const esAccionProtegida = esNuevaSancion || esPagosPendientes || esCrearTemporada || esGestionHucha;
    const mostrarInicio = !esAccionProtegida && !esCatalogo && !esHucha && !esRutaFicha(this.ruta);
    const gestor = esEntrenadores && this.estadoSesion === 'activa' && !this.sinConexion ? this.gestionar : undefined;
    const pideAcceso = esEntrenadores && this.estadoSesion === 'sin-sesion' && (mostrarInicio || esAccionProtegida);
    const pagosPendientes = temporada?.multas.filter(({ estado }) => estado === 'pago_declarado').length ?? 0;
    const avisoCopia = this.actualizadaEn
      ? `Sin conexión. Mostrando datos guardados el ${formatoCopia.format(new Date(this.actualizadaEn))}.`
      : 'Sin conexión. Mostrando datos guardados.';

    return html`
      <dialog aria-labelledby="elegir-perfil" @cancel=${(evento: Event) => evento.preventDefault()}>
        <h2 id="elegir-perfil">¿Cómo quieres entrar?</h2>
        <div class="opciones">
          <button type="button" autofocus @click=${() => this.elegirPerfil('jugadoras')}>Jugadora</button>
          <button type="button" @click=${() => this.elegirPerfil('entrenadores')}>Entrenador</button>
        </div>
      </dialog>
      <crg-header .temporadas=${this.temporadas} .seleccionada=${this.temporadaElegida ?? temporada?.id ?? ''}
        .enEntrenadores=${esEntrenadores}
        .haySesion=${esEntrenadores && this.estadoSesion !== 'sin-sesion'}
        @acceder-entrenadores=${() => this.elegirPerfil('entrenadores')}
        @cerrar-sesion=${this.cerrarSesion} @temporada-cambiada=${this.cambiarTemporada}></crg-header>
      <main class="contenido" tabindex="-1">
        ${this.sinConexion && temporada ? html`<p class="estado-carga aviso-sin-conexion" role="status">${avisoCopia}</p>` : nothing}
        ${this.error ? html`<p class="estado-carga" role="status">
          ${this.error}<button type="button" @click=${this.cargarDatos}>Reintentar</button>
        </p>` : nothing}
        ${!temporada && this.cargando && !esCatalogo ? html`<p class="estado-carga" role="status">Cargando temporada…</p>` : nothing}
        ${esEntrenadores && this.sinConexion ? html`<p class="estado-carga" role="status">El acceso y las operaciones de Entrenadores requieren conexión.</p>` : nothing}
        ${this.avisoOperacion ? html`<p class="estado-carga" role="status">${this.avisoOperacion}</p>` : nothing}
        ${esCatalogo ? html`<crg-catalogo></crg-catalogo>` : nothing}
        ${esEntrenadores && this.avisoStaff ? html`<p class="estado-carga" role="status">${this.avisoStaff}
          ${!pideAcceso ? html`<a href="#staff">Acceso de entrenadores</a>` : nothing}</p>` : nothing}
        ${esEntrenadores && this.estadoSesion === 'validando' ? html`<p class="estado-carga" role="status">Comprobando sesión…</p>` : nothing}
        ${esEntrenadores && this.estadoSesion === 'error' ? html`<p class="estado-carga" role="status">
          No se pudo comprobar la sesión.<button type="button" @click=${this.validarSesion}>Reintentar</button>
        </p>` : nothing}
        ${esEntrenadores && this.estadoSesion === 'cerrando' ? html`<p class="estado-carga" role="status">Cerrando sesión…</p>` : nothing}
        ${esEntrenadores && this.estadoSesion === 'cierre-pendiente' ? html`<p class="estado-carga" role="status">
          El cierre de sesión está pendiente de confirmación. Conéctate para completarlo.
          <button type="button" @click=${this.cerrarSesion}>Reintentar cierre</button>
        </p>` : nothing}
        ${pideAcceso && !this.sinConexion ? html`
          <crg-acceso .acceso=${this.acceso} .temporada=${this.temporadas.find(({ activa }) => activa)?.nombre ?? temporada?.nombre ?? ''}
            @volver-a-jugadoras=${() => this.elegirPerfil('jugadoras')}></crg-acceso>
        ` : nothing}
        ${temporada ? html`
          ${mostrarInicio && (!pideAcceso || this.sinConexion) ? this.tarjetaHucha(temporada) : nothing}
          ${mostrarInicio && gestor ? this.accesosEntrenadores(pagosPendientes) : nothing}
          <div ?hidden=${!mostrarInicio || (pideAcceso && !this.sinConexion)}>
            <crg-jugadoras .temporada=${temporada} .hoy=${this.hoy} .enInicio=${true}></crg-jugadoras>
          </div>
          ${destinatario ? html`
            <crg-detalle .destinatario=${destinatario} .hoy=${this.hoy} .volverA=${gestor ? this.vueltaFicha : '#inicio'}
              .declarar=${this.sinConexion ? undefined : this.declarar} .gestionar=${gestor}
              .multas=${multasDe(destinatario, temporada.multas)}></crg-detalle>
          ` : nothing}
          ${esHucha && (!esGestionHucha || gestor) ? html`
            ${esGestionHucha ? html`<a class="volver-gestion" href="#inicio">← Volver a Inicio</a>` : nothing}
            <crg-hucha .temporada=${temporada} .gestionar=${gestor}></crg-hucha>
          ` : nothing}
          ${esNuevaSancion && gestor ? (temporada.activa ? html`
            <crg-nueva-sancion .temporada=${temporada} .guardar=${this.guardarMulta}></crg-nueva-sancion>
          ` : html`<a class="volver-gestion" href="#inicio">← Volver a Inicio</a>
            <p class="estado-carga">El registro de multas se hace en la temporada activa.
            <button type="button" @click=${this.mostrarTemporadaActiva}>Cambiar a la temporada activa</button></p>`) : nothing}
          ${esPagosPendientes && gestor ? html`<crg-pagos-pendientes .temporada=${temporada} .gestionar=${gestor}></crg-pagos-pendientes>` : nothing}
          ${esCrearTemporada && gestor ? (temporada.activa ? html`
            <crg-crear-temporada .temporada=${temporada} .gestionar=${gestor}></crg-crear-temporada>
          ` : html`<a class="volver-gestion" href="#inicio">← Volver a Inicio</a>
            <p class="estado-carga">El importe propuesto procede de la hucha de la temporada activa.
            <button type="button" @click=${this.mostrarTemporadaActiva}>Cambiar a la temporada activa</button></p>`) : nothing}
        ` : nothing}
      </main>
      <nav aria-label="Navegación principal">
        <div class="navegacion">
          <a href="#inicio" aria-current=${mostrarInicio ? 'page' : nothing}><span class="icono inicio" aria-hidden="true"></span>Inicio</a>
          <a href="#hucha" aria-current=${esHucha ? 'page' : nothing}><span class="icono bote" aria-hidden="true"></span>Hucha</a>
          <a href="#catalogo" aria-current=${esCatalogo ? 'page' : nothing}><span class="icono libro" aria-hidden="true"></span>Catálogo</a>
        </div>
      </nav>
    `;
  }
}

customElements.define('crg-app', CrgApp);
