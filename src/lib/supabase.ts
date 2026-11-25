import type { AjusteHucha, Jugadora, Multa, ResumenTemporada, Tecnico, Temporada } from '../data/temporadas-demo';
import type { RegistroMulta } from './registro-multas';

type FilaTemporada = Omit<ResumenTemporada, 'huchaInicial'> & {
  hucha_inicial: number;
  historial_hucha_inicial: AjusteHucha[];
};
type FilaJugadora = Jugadora & { activa: boolean };
type FilaTecnico = Omit<Tecnico, 'tipo'>;
type FilaMulta = Omit<Multa, 'declarada_en' | 'fecha_pago' | 'jugadora_id' | 'tecnico_id'> & {
  jugadora_id: string | null;
  tecnico_id: string | null;
  declarada_en: string | null;
  fecha_pago: string | null;
};

type Tabla = 'temporadas' | 'jugadoras' | 'cuerpo_tecnico' | 'multas' | 'gastos_hucha';

export type RespuestaRpc<T extends object> = ({ ok: true } & T) | { ok: false; error: string };

export type RespuestaInicioSesion =
  { ok: true; usuario: string; token: string } | { ok: false; error: string; reintentar_en?: number };

export type GestionStaff =
  | { funcion: 'marcar_pagada'; multa_id: string; fecha_pago: string }
  | { funcion: 'anular_multa'; multa_id: string; motivo: string }
  | { funcion: 'verificar_pago'; multa_id: string; aceptar: boolean; fecha_pago: string | null }
  | {
      funcion: 'registrar_gasto' | 'editar_hucha_inicial';
      temporada_id: string;
      importe: number;
      motivo: string;
      fecha: string;
    }
  | { funcion: 'crear_temporada'; nombre: string; hucha_inicial: number | null };

export type ResultadoGestion = RespuestaRpc<{ id?: string }>;
export type GestionarStaff = (operacion: GestionStaff) => Promise<ResultadoGestion>;
export type DeclararPago = (multaId: string) => Promise<ResultadoGestion>;

function configuracionSupabase() {
  const urlProyecto = import.meta.env.VITE_SUPABASE_URL?.trim();
  const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!urlProyecto || !clave?.startsWith('sb_publishable_')) {
    throw new Error('Revisa la URL y la clave publicable en .env.local.');
  }
  return { urlProyecto, clave };
}

export async function leer<T>(tabla: Tabla, columnas: string, filtros: Record<string, string> = {}): Promise<T[]> {
  const { urlProyecto, clave } = configuracionSupabase();

  const url = new URL(`/rest/v1/${tabla}`, urlProyecto);
  const resultados: T[] = [];
  const limite = 500;

  for (let offset = 0; ; offset += limite) {
    url.search = new URLSearchParams({
      ...filtros,
      select: columnas,
      order: 'id.asc',
      limit: String(limite),
      offset: String(offset),
    }).toString();

    const respuesta = await fetch(url, {
      headers: { apikey: clave },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => null);
      throw new Error(`${tabla}: HTTP ${respuesta.status} ${detalle?.code ?? ''} ${detalle?.message ?? ''}`.trim());
    }

    const pagina: T[] = await respuesta.json();
    resultados.push(...pagina);
    if (pagina.length < limite) return resultados;
  }
}

export async function leerDatosPublicos(idElegida?: string) {
  const filas = await leer<FilaTemporada>('temporadas', 'id,nombre,activa,hucha_inicial,historial_hucha_inicial');
  const temporadas = filas.map(({ hucha_inicial, historial_hucha_inicial, ...fila }) => ({
    ...fila,
    huchaInicial: hucha_inicial,
    historialHuchaInicial: historial_hucha_inicial ?? [],
  }));
  temporadas.sort((a, b) => Number(b.activa) - Number(a.activa) || b.nombre.localeCompare(a.nombre, 'es'));

  const elegida = temporadas.find(({ id }) => id === idElegida) ?? temporadas.find(({ activa }) => activa);
  if (!elegida) throw new Error('No hay una temporada activa en Supabase.');

  const filtro = { temporada_id: `eq.${elegida.id}` };
  const [jugadoras, tecnicos, multas, gastos] = await Promise.all([
    leer<FilaJugadora>('jugadoras', 'id,nombre,dorsal,capitana,activa'),
    leer<FilaTecnico>('cuerpo_tecnico', 'id,nombre,activo'),
    leer<FilaMulta>(
      'multas',
      'id,jugadora_id,tecnico_id,concepto_id,importe,importe_cobrado,multiplicador,fecha,estado,declarada_en,fecha_pago',
      filtro,
    ),
    leer<Temporada['gastos'][number]>('gastos_hucha', 'id,fecha,importe,motivo', filtro),
  ]);

  // La tabla jugadoras es común. Conserva también las bajas con historial en la temporada.
  const conHistorial = new Set(
    multas.filter(({ estado }) => estado !== 'anulada').map(({ jugadora_id }) => jugadora_id),
  );
  const temporada: Temporada = {
    ...elegida,
    jugadoras: jugadoras
      .filter(({ activa, id }) => activa || conHistorial.has(id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    tecnicos: tecnicos
      .filter(({ activo, id }) => activo || multas.some(({ tecnico_id }) => tecnico_id === id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((tecnico) => ({ ...tecnico, tipo: 'tecnico' })),
    multas: multas.map(({ declarada_en, fecha_pago, tecnico_id, jugadora_id, ...multa }) => {
      const datos = { ...multa, declarada_en: declarada_en ?? undefined, fecha_pago: fecha_pago ?? undefined };
      if (tecnico_id) return { ...datos, tecnico_id };
      if (jugadora_id) return { ...datos, jugadora_id };
      throw new Error('Una multa no tiene destinatario.');
    }),
    gastos,
  };

  return { temporadas, temporada };
}

type FuncionRpc =
  | 'iniciar_sesion_staff'
  | 'validar_sesion_staff'
  | 'cerrar_sesion_staff'
  | 'registrar_multa_sesion'
  | 'registrar_multa_tecnico_sesion'
  | 'declarar_pago'
  | `${GestionStaff['funcion']}_sesion`;

async function llamarRpc<T extends object>(funcion: FuncionRpc, parametros: object): Promise<RespuestaRpc<T>> {
  const { urlProyecto, clave } = configuracionSupabase();
  const respuesta = await fetch(new URL(`/rest/v1/rpc/${funcion}`, urlProyecto), {
    method: 'POST',
    headers: { apikey: clave, 'Content-Type': 'application/json' },
    body: JSON.stringify(parametros),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!respuesta.ok) throw new Error(`Supabase: HTTP ${respuesta.status}`);
  return respuesta.json();
}

export function iniciarSesionStaff(pin: string): Promise<RespuestaInicioSesion> {
  return llamarRpc<{ usuario: string; token: string }>('iniciar_sesion_staff', { pin });
}

export function validarSesionStaff(token: string) {
  return llamarRpc<{ usuario: string }>('validar_sesion_staff', { token });
}

export function cerrarSesionStaff(token: string) {
  return llamarRpc('cerrar_sesion_staff', { token });
}

export function registrarMulta(token: string, multa: RegistroMulta) {
  const funcion = multa.tecnico_id ? 'registrar_multa_tecnico_sesion' : 'registrar_multa_sesion';
  return llamarRpc<{ id: string }>(funcion, { ...multa, token });
}

export const declararPago: DeclararPago = (multaId) =>
  llamarRpc<{ id?: string }>('declarar_pago', { multa_id: multaId });

export function ejecutarGestionStaff(token: string, operacion: GestionStaff): Promise<ResultadoGestion> {
  const { funcion, ...parametros } = operacion;
  return llamarRpc<{ id?: string }>(`${funcion}_sesion`, { ...parametros, token });
}
