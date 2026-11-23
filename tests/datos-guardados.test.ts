import { expect, test } from "vitest";
import { crearTemporadasDemo } from "../src/data/temporadas-demo";
import { crearDatosGuardados } from "../src/lib/datos-guardados";

const temporadas = crearTemporadasDemo(new Date("2026-11-23T12:00:00Z"));
const [activa, anterior] = temporadas;

function almacenamientoPrueba() {
  const valores = new Map<string, string>();
  return {
    valores,
    getItem: (clave: string) => valores.get(clave) ?? null,
    setItem: (clave: string, valor: string) => valores.set(clave, valor),
  };
}

test("abre la temporada activa sin conexión y recupera solo las temporadas consultadas", () => {
  const memoria = almacenamientoPrueba();
  const guardados = crearDatosGuardados("https://club.example", memoria);
  guardados.guardar({ temporadas, temporada: activa });
  expect(guardados.leer().temporada?.id).toBe(activa.id);
  expect(guardados.leer(anterior.id).temporada).toBeUndefined();

  guardados.guardar({ temporadas, temporada: anterior });
  const trasRecarga = crearDatosGuardados("https://club.example/", memoria);
  expect(trasRecarga.leer(anterior.id).temporada?.multas).toHaveLength(2);
  expect(trasRecarga.leer().temporada?.id).toBe(activa.id);
  expect(
    crearDatosGuardados("https://otro.example", memoria).leer().temporada,
  ).toBeUndefined();
});

test("guarda una proyección pública y deja fuera credenciales y campos adicionales", () => {
  const memoria = almacenamientoPrueba();
  const guardados = crearDatosGuardados("https://club.example", memoria);
  const temporada = {
    ...activa,
    pin: "solo-prueba",
    jugadoras: [{ ...activa.jugadoras[0], contacto: "solo-prueba" }],
  };
  guardados.guardar({ temporadas, temporada });

  expect([...memoria.valores.values()].join()).not.toContain("solo-prueba");
  expect(guardados.leer().temporada?.jugadoras[0].nombre).toBe(
    activa.jugadoras[0].nombre,
  );
});

test("tolera almacenamiento no disponible o datos corruptos", () => {
  const sinPermiso = () => {
    throw new Error("Almacenamiento no disponible");
  };
  const bloqueado = crearDatosGuardados("https://club.example", {
    getItem: sinPermiso,
    setItem: sinPermiso,
  });
  expect(() =>
    bloqueado.guardar({ temporadas, temporada: activa }),
  ).not.toThrow();
  expect(bloqueado.leer().temporadas).toEqual([]);
  const corrupto = crearDatosGuardados("https://club.example", {
    getItem: () => "{",
    setItem: () => {},
  });
  expect(corrupto.leer().temporada).toBeUndefined();
});
