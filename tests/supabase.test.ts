import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { leerDatosPublicos } from "../src/lib/supabase";

const temporadas = [
  { id: "anterior", nombre: "2025/26", activa: false, hucha_inicial: 60 },
  { id: "activa", nombre: "2026/27", activa: true, hucha_inicial: 100 },
];
const jugadoras = [
  { id: "ana", nombre: "Ana", dorsal: 9, capitana: false, activa: true },
  { id: "ines", nombre: "Inés", dorsal: 12, capitana: false, activa: false },
];
const multaHistorica = {
  jugadora_id: "ines",
  concepto_id: "ent_tarde",
  fecha: "2026-05-03",
  estado: "pagada",
  importe: 2,
  importe_cobrado: 4,
  fecha_pago: "2026-05-20",
  declarada_en: null,
};

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.example.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_prueba");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("elige la temporada activa y consulta solo las multas y gastos de la temporada seleccionada", async () => {
  const fetchPrueba = vi.fn(async (url: URL) => {
    const anterior = url.searchParams.get("temporada_id") === "eq.anterior";
    const filas = {
      "/rest/v1/temporadas": temporadas,
      "/rest/v1/jugadoras": jugadoras,
      "/rest/v1/multas": anterior ? [multaHistorica] : [],
      "/rest/v1/gastos_hucha": anterior
        ? [{ fecha: "2026-05-03", motivo: "Agua", importe: 2.5 }]
        : [],
    };
    return Response.json(filas[url.pathname as keyof typeof filas]);
  });
  vi.stubGlobal("fetch", fetchPrueba);

  const actual = await leerDatosPublicos();
  const anterior = await leerDatosPublicos("anterior");

  expect(actual.temporada).toMatchObject({
    id: "activa",
    huchaInicial: 100,
    jugadoras: [{ id: "ana" }],
    multas: [],
  });
  expect(anterior.temporada).toMatchObject({
    id: "anterior",
    huchaInicial: 60,
    jugadoras: [{ id: "ana" }, { id: "ines" }],
  });
  expect(anterior.temporada.multas[0]).toMatchObject({
    importe: 2,
    importe_cobrado: 4,
    declarada_en: undefined,
  });
  expect(anterior.temporada.gastos).toHaveLength(1);
  for (const tabla of ["multas", "gastos_hucha"]) {
    expect(
      fetchPrueba.mock.calls
        .filter(([url]) => url.pathname.endsWith(`/${tabla}`))
        .map(([url]) => url.searchParams.get("temporada_id")),
    ).toEqual(["eq.activa", "eq.anterior"]);
  }
});

test("un error de lectura se devuelve a la interfaz", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ code: "42501" }, { status: 403 })),
  );

  await expect(leerDatosPublicos()).rejects.toThrow(
    "temporadas: HTTP 403 42501",
  );
});
