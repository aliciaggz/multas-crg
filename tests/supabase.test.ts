import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  declararPago,
  ejecutarGestionStaff,
  leerDatosPublicos,
  loginStaff,
  registrarMulta,
  type GestionStaff,
} from "../src/lib/supabase";

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

test("envía el acceso y el alta de multa mediante POST a sus RPC", async () => {
  const fetchPrueba = vi.fn(async (url: URL, _opciones: RequestInit) =>
    Response.json(
      url.pathname.endsWith("login_staff")
        ? { ok: true, usuario: "pruebas" }
        : { ok: true, id: "multa" },
    ),
  );
  vi.stubGlobal("fetch", fetchPrueba);

  const credenciales = { usuario: "pruebas", pin: "0000" };
  expect(await loginStaff(credenciales)).toEqual({
    ok: true,
    usuario: "pruebas",
  });
  const multa = {
    jugadora_id: "jugadora",
    concepto_id: "ent_tarde",
    importe: 4,
    multiplicador: 2 as const,
    cantidad: 1,
    fecha: "2026-11-22",
    observacion: null,
    pagada_ahora: false,
  };
  expect(await registrarMulta(credenciales, multa)).toEqual({
    ok: true,
    id: "multa",
  });

  for (const [indice, ruta, datos] of [
    [0, "/rest/v1/rpc/login_staff", credenciales],
    [1, "/rest/v1/rpc/registrar_multa", { ...credenciales, ...multa }],
  ] as const) {
    const [url, opciones] = fetchPrueba.mock.calls[indice];
    expect(url.pathname).toBe(ruta);
    expect(url.search).toBe("");
    expect(opciones).toMatchObject({
      method: "POST",
      headers: { apikey: "sb_publishable_prueba" },
    });
    expect(JSON.parse(String(opciones.body))).toEqual(datos);
  }
});

test("declara públicamente y envía cada operación de gestión con su firma de Supabase", async () => {
  const fetchPrueba = vi.fn(async (_url: URL, _opciones: RequestInit) =>
    Response.json({ ok: true }),
  );
  vi.stubGlobal("fetch", fetchPrueba);
  const staff = { usuario: "prueba", pin: "0000" };
  const fecha = "2026-11-22";
  const operaciones: GestionStaff[] = [
    { funcion: "marcar_pagada", multa_id: "m1", fecha_pago: fecha },
    { funcion: "anular_multa", multa_id: "m1", motivo: "Duplicada" },
    {
      funcion: "verificar_pago",
      multa_id: "m1",
      aceptar: true,
      fecha_pago: fecha,
    },
    {
      funcion: "verificar_pago",
      multa_id: "m1",
      aceptar: false,
      fecha_pago: null,
    },
    {
      funcion: "registrar_gasto",
      temporada_id: "t1",
      importe: 2.5,
      motivo: "Agua",
      fecha,
    },
    {
      funcion: "editar_hucha_inicial",
      temporada_id: "t1",
      importe: 100,
      motivo: "Corrección",
      fecha,
    },
    { funcion: "crear_temporada", nombre: "2027/28", hucha_inicial: null },
  ];

  expect(await declararPago("m1")).toEqual({ ok: true });
  for (const operacion of operaciones) {
    expect(await ejecutarGestionStaff(staff, operacion)).toEqual({ ok: true });
  }
  const llamadas = fetchPrueba.mock.calls.map(([url, opciones]) => ({
    ruta: url.pathname,
    cuerpo: JSON.parse(String(opciones.body)),
  }));
  expect(llamadas).toEqual([
    { ruta: "/rest/v1/rpc/declarar_pago", cuerpo: { multa_id: "m1" } },
    ...operaciones.map(({ funcion, ...datos }) => ({
      ruta: `/rest/v1/rpc/${funcion}`,
      cuerpo: { ...staff, ...datos },
    })),
  ]);
});
