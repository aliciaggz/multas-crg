type Temporada = {
  id: string;
  nombre: string;
  activa: boolean;
  hucha_inicial: number;
};

type Tabla = "temporadas" | "jugadoras" | "multas" | "gastos_hucha";

async function leer<T>(
  tabla: Tabla,
  columnas: string,
  filtros: Record<string, string> = {},
): Promise<T[]> {
  const urlProyecto = import.meta.env.VITE_SUPABASE_URL?.trim();
  const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!urlProyecto || !clave?.startsWith("sb_publishable_")) {
    throw new Error("Revisa la URL y la clave publicable en .env.local.");
  }

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

export async function leerTemporadaActiva() {
  const temporadas = await leer<Temporada>(
    "temporadas",
    "id,nombre,activa,hucha_inicial",
  );
  const activa = temporadas.find((temporada) => temporada.activa);
  if (!activa) throw new Error("No hay ninguna temporada activa en Supabase.");

  const porTemporada = { temporada_id: `eq.${activa.id}` };
  const [jugadoras, multas, gastos] = await Promise.all([
    leer("jugadoras", "id,nombre,dorsal,capitana,activa"),
    leer(
      "multas",
      "id,jugadora_id,concepto_id,importe,importe_cobrado,fecha,estado,declarada_en,fecha_pago",
      porTemporada,
    ),
    leer("gastos_hucha", "id,fecha,importe,motivo", porTemporada),
  ]);

  return { temporadas, activa, jugadoras, multas, gastos };
}
