import type { RespuestaInicioSesion } from './supabase';

type ResultadoAcceso = { estado: 'correcto'; usuario: string; token: string }
  | { estado: 'incorrecto' | 'bloqueado' };

export type AccesoStaff = {
  intentar(pin: string): Promise<ResultadoAcceso>;
  segundosRestantes(): number;
};

export type SesionGuardada = { token: string; cierrePendiente?: true };

export const tokenValido = (token: unknown): token is string =>
  typeof token === 'string' && /^[0-9a-f]{64}$/.test(token);

/** Supabase fija el bloqueo. La cuenta atrás evita solicitudes durante ese intervalo. */
export function crearAccesoStaff(
  verificar: (pin: string) => Promise<RespuestaInicioSesion>,
  ahora = () => Date.now(),
): AccesoStaff {
  let hasta = 0;
  const segundosRestantes = () => Math.max(0, Math.ceil((hasta - ahora()) / 1000));

  async function intentar(pin: string): Promise<ResultadoAcceso> {
    if (segundosRestantes()) return { estado: 'bloqueado' };
    const respuesta = await verificar(pin);
    if (respuesta.ok) {
      if (!tokenValido(respuesta.token) || typeof respuesta.usuario !== 'string' || !respuesta.usuario) {
        throw new Error('La respuesta de acceso no es válida.');
      }
      return { estado: 'correcto', usuario: respuesta.usuario, token: respuesta.token };
    }
    if (typeof respuesta.reintentar_en === 'number' && Number.isFinite(respuesta.reintentar_en) && respuesta.reintentar_en > 0) {
      hasta = ahora() + respuesta.reintentar_en * 1000;
    }
    return { estado: segundosRestantes() ? 'bloqueado' : 'incorrecto' };
  }

  return { intentar, segundosRestantes };
}

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function almacenamientoLocal(): Almacen | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function crearAlmacenSesionStaff(urlProyecto?: string, almacen = almacenamientoLocal()) {
  let clave: string | undefined;
  try {
    if (urlProyecto) clave = `multas-crg:sesion-staff:v1:${new URL(urlProyecto.trim()).origin}`;
  } catch { /* Sin proyecto válido, solo se usa la sesión en memoria. */ }

  function leer(): SesionGuardada | undefined {
    if (!clave || !almacen) return;
    try {
      const json = almacen.getItem(clave);
      const datos = json ? JSON.parse(json) as Partial<SesionGuardada> | null : null;
      if (tokenValido(datos?.token)) {
        return { token: datos.token, ...(datos.cierrePendiente === true ? { cierrePendiente: true } : {}) };
      }
    } catch { /* Un valor inválido no habilita una sesión. */ }
  }

  return {
    clave,
    leer,
    guardar(sesion: SesionGuardada) {
      if (!clave || !almacen) return;
      try {
        almacen.setItem(clave, JSON.stringify({
          token: sesion.token, ...(sesion.cierrePendiente ? { cierrePendiente: true } : {}),
        }));
      } catch { /* La sesión sigue disponible en memoria. */ }
    },
    quitar(token: string) {
      if (!clave || !almacen || leer()?.token !== token) return;
      try { almacen.removeItem(clave); } catch { /* Supabase ya ha invalidado ese token. */ }
    },
  };
}
