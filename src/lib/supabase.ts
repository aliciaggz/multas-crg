import type {
  AjusteHucha,
  Jugadora,
  Multa,
  ResumenTemporada,
  Temporada,
} from "../data/temporadas-demo";
import type { RegistroMulta } from "./registro-multas";

type FilaTemporada = Omit<ResumenTemporada, "huchaInicial"> & {
  hucha_inicial: number;
  historial_hucha_inicial: AjusteHucha[];
};
type FilaJugadora = Jugadora & { activa: boolean };
type FilaMulta = Omit<Multa, "declarada_en" | "fecha_pago"> & {
  declarada_en: string | null;
  fecha_pago: string | null;
};

type Tabla = "temporadas" | "jugadoras" | "multas" | "gastos_hucha";

export type CredencialesStaff = { usuario: string; pin: string };
export type RespuestaRpc<T extends object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type GestionStaff =
  | { funcion: "marcar_pagada"; multa_id: string; fecha_pago: string }
  | { funcion: "anular_multa"; multa_id: string; motivo: string }
  | {
      funcion: "verificar_pago";
      multa_id: string;
      aceptar: boolean;
      fecha_pago: string | null;
    }
  | {
      funcion: "registrar_gasto" | "editar_hucha_inicial";
      temporada_id: string;
      importe: number;
      motivo: string;
      fecha: string;
    }
  | {
      funcion: "crear_temporada";
      nombre: string;
      hucha_inicial: number | null;
    };

export type ResultadoGestion = RespuestaRpc<{ id?: string }>;
export type GestionarStaff = (
  operacion: GestionStaff,
) => Promise<ResultadoGestion>;
export type DeclararPago = (multaId: string) => Promise<ResultadoGestion>;

function configuracionSupabase() {
  const urlProyecto = import.meta.env.VITE_SUPABASE_URL?.trim();
  const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!urlProyecto || !clave?.startsWith("sb_publishable_")) {
    throw new Error("Revisa la URL y la clave publicable en .env.local.");
  }
  return { urlProyecto, clave };
}

export async function leer<T>(
  tabla: Tabla,
  columnas: string,
  filtros: Record<string, string> = {},
): Promise<T[]> {
  const { urlProyecto, clave } = configuracionSupabase();

  const url = new URL(`/rest/v1/${tabla}`, urlProyecto);
  const resultados: T[] = [];
  const limite = 500;

  for (let offset = 0; ; offset += limite) {
    url.search = new URLSearchParams({
      ...filtros,
      select: columnas,
      order: "id.asc",
      limit: String(limite),
      offset: String(offset),
    }).toString();

    const respuesta = await fetch(url, {
      headers: { apikey: clave },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => null);
      throw new Error(
        `${tabla}: HTTP ${respuesta.status} ${detalle?.code ?? ""} ${detalle?.message ?? ""}`.trim(),
      );
    }

    const pagina: T[] = await respuesta.json();
    resultados.push(...pagina);
    if (pagina.length < limite) return resultados;
  }
}

export async function leerDatosPublicos(idElegida?: string) {
  const filas = await leer<FilaTemporada>(
    "temporadas",
    "id,nombre,activa,hucha_inicial,historial_hucha_inicial",
  );
  const temporadas = filas.map(
    ({ hucha_inicial, historial_hucha_inicial, ...fila }) => ({
      ...fila,
      huchaInicial: hucha_inicial,
      historialHuchaInicial: historial_hucha_inicial ?? [],
    }),
  );
  temporadas.sort(
    (a, b) =>
      Number(b.activa) - Number(a.activa) ||
      b.nombre.localeCompare(a.nombre, "es"),
  );

  const elegida =
    temporadas.find(({ id }) => id === idElegida) ??
    temporadas.find(({ activa }) => activa);
  if (!elegida) throw new Error("No hay una temporada activa en Supabase.");

  const filtro = { temporada_id: `eq.${elegida.id}` };
  const [jugadoras, multas, gastos] = await Promise.all([
    leer<FilaJugadora>("jugadoras", "id,nombre,dorsal,capitana,activa"),
    leer<FilaMulta>(
      "multas",
      "id,jugadora_id,concepto_id,importe,importe_cobrado,multiplicador,fecha,estado,declarada_en,fecha_pago",
      filtro,
    ),
    leer<Temporada["gastos"][number]>(
      "gastos_hucha",
      "id,fecha,importe,motivo",
      filtro,
    ),
  ]);

  // La tabla jugadoras es común. Conserva también las bajas con historial en la temporada.
  const conHistorial = new Set(
    multas
      .filter(({ estado }) => estado !== "anulada")
      .map(({ jugadora_id }) => jugadora_id),
  );
  const temporada: Temporada = {
    ...elegida,
    jugadoras: jugadoras
      .filter(({ activa, id }) => activa || conHistorial.has(id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    multas: multas.map(({ declarada_en, fecha_pago, ...multa }) => ({
      ...multa,
      declarada_en: declarada_en ?? undefined,
      fecha_pago: fecha_pago ?? undefined,
    })),
    gastos,
  };

  return { temporadas, temporada };
}

type FuncionRpc =
  | "login_staff"
  | "registrar_multa"
  | "declarar_pago"
  | GestionStaff["funcion"];

async function llamarRpc<T extends object>(
  funcion: FuncionRpc,
  parametros: object,
): Promise<RespuestaRpc<T>> {
  const { urlProyecto, clave } = configuracionSupabase();
  const respuesta = await fetch(
    new URL(`/rest/v1/rpc/${funcion}`, urlProyecto),
    {
      method: "POST",
      headers: { apikey: clave, "Content-Type": "application/json" },
      body: JSON.stringify(parametros),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!respuesta.ok) throw new Error(`Supabase: HTTP ${respuesta.status}`);
  return respuesta.json();
}

export function loginStaff(credenciales: CredencialesStaff) {
  return llamarRpc<{ usuario: string }>("login_staff", credenciales);
}

export function registrarMulta(
  credenciales: CredencialesStaff,
  multa: RegistroMulta,
) {
  return llamarRpc<{ id: string }>("registrar_multa", {
    ...credenciales,
    ...multa,
  });
}

export const declararPago: DeclararPago = (multaId) =>
  llamarRpc<{ id?: string }>("declarar_pago", { multa_id: multaId });

export function ejecutarGestionStaff(
  credenciales: CredencialesStaff,
  operacion: GestionStaff,
): Promise<ResultadoGestion> {
  const { funcion, ...parametros } = operacion;
  return llamarRpc<{ id?: string }>(funcion, {
    ...credenciales,
    ...parametros,
  });
}
