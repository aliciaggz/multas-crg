import type { ResumenTemporada, Temporada } from "../data/temporadas-demo";

type Lectura = {
  temporadas: readonly ResumenTemporada[];
  temporada: Temporada;
};
type Almacen = Pick<Storage, "getItem" | "setItem">;
type Copia = { temporadas: ResumenTemporada[]; lecturas: Temporada[] };

function almacenamientoLocal(): Almacen | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function claveProyecto(url?: string): string | undefined {
  if (!url) return;
  try {
    return `multas-crg:lecturas-publicas:v1:${new URL(url).origin}`;
  } catch {
    return undefined;
  }
}

function resumen({
  id,
  nombre,
  activa,
  huchaInicial,
}: ResumenTemporada): ResumenTemporada {
  return { id, nombre, activa, huchaInicial };
}

function proyeccionPublica(temporada: Temporada): Temporada {
  return {
    ...resumen(temporada),
    jugadoras: temporada.jugadoras.map(
      ({ id, nombre, dorsal, capitana, activa }) => ({
        id,
        nombre,
        dorsal,
        capitana,
        activa,
      }),
    ),
    multas: temporada.multas.map(
      ({
        id,
        jugadora_id,
        concepto_id,
        importe,
        importe_cobrado,
        multiplicador,
        fecha,
        estado,
        declarada_en,
        fecha_pago,
      }) => ({
        id,
        jugadora_id,
        concepto_id,
        importe,
        importe_cobrado,
        multiplicador,
        fecha,
        estado,
        declarada_en,
        fecha_pago,
      }),
    ),
    gastos: temporada.gastos.map(({ motivo, fecha, importe }) => ({
      motivo,
      fecha,
      importe,
    })),
    historialHuchaInicial: temporada.historialHuchaInicial?.map(
      ({ anterior, nuevo, motivo, fecha, registrado_en }) => ({
        anterior,
        nuevo,
        motivo,
        fecha,
        registrado_en,
      }),
    ),
  };
}

export function crearDatosGuardados(
  url?: string,
  almacen = almacenamientoLocal(),
) {
  const clave = claveProyecto(url);

  function recuperar(): Copia | undefined {
    if (!almacen || !clave) return;
    try {
      const texto = almacen.getItem(clave);
      if (!texto) return;
      const datos = JSON.parse(texto) as Partial<Copia> | null;
      if (!Array.isArray(datos?.temporadas) || !Array.isArray(datos.lecturas))
        return;
      if (
        !datos.lecturas.every(
          (t) =>
            t &&
            typeof t.id === "string" &&
            Array.isArray(t.jugadoras) &&
            Array.isArray(t.multas) &&
            Array.isArray(t.gastos),
        )
      )
        return;
      if (
        !datos.temporadas.every(
          (t) => t && typeof t.id === "string" && typeof t.nombre === "string",
        )
      )
        return;
      return { temporadas: datos.temporadas, lecturas: datos.lecturas };
    } catch {
      return undefined;
    }
  }

  return {
    guardar({ temporadas, temporada }: Lectura) {
      if (!almacen || !clave) return;
      const anteriores = recuperar()?.lecturas ?? [];
      const lecturas = anteriores.filter(
        ({ id }) => id !== temporada.id && temporadas.some((t) => t.id === id),
      );
      lecturas.push(proyeccionPublica(temporada));
      try {
        almacen.setItem(
          clave,
          JSON.stringify({ temporadas: temporadas.map(resumen), lecturas }),
        );
      } catch {
        /* Sin cuota o permiso. */
      }
    },
    leer(idElegida?: string) {
      const copia = recuperar();
      const temporadas = copia?.temporadas ?? [];
      const elegida = idElegida
        ? temporadas.find(({ id }) => id === idElegida)
        : temporadas.find(({ activa }) => activa);
      const guardada = copia?.lecturas.find(({ id }) => id === elegida?.id);
      return {
        temporadas,
        temporada:
          guardada && elegida ? { ...guardada, ...elegida } : undefined,
      };
    },
  };
}
