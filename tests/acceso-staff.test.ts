import { expect, test, vi } from "vitest";
import { crearAccesoStaff } from "../src/lib/acceso-staff";

test("avisa al quinto rechazo del servidor y no hace otra llamada durante el minuto de espera", async () => {
  let ahora = 0;
  const verificar = vi
    .fn()
    .mockResolvedValue({ ok: false, error: "No autorizado" });
  const acceso = crearAccesoStaff(verificar, () => ahora);
  for (let intento = 0; intento < 4; intento++) {
    expect(await acceso.intentar(" Entrenador ", "0000")).toMatchObject({
      estado: "incorrecto",
    });
  }
  expect(await acceso.intentar("entrenador", "0000")).toMatchObject({
    estado: "bloqueado",
  });
  expect(acceso.segundosRestantes("entrenador")).toBe(60);
  ahora = 59_999;
  expect(await acceso.intentar("entrenador", "1111")).toMatchObject({
    estado: "bloqueado",
  });
  expect(verificar).toHaveBeenCalledTimes(5);
  ahora = 60_000;
  verificar.mockResolvedValueOnce({ ok: true, usuario: "entrenador" });
  expect(await acceso.intentar("entrenador", "1111")).toEqual({
    estado: "correcto",
    usuario: "entrenador",
  });
});

test("un error de red no cuenta como PIN incorrecto", async () => {
  const verificar = vi
    .fn()
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValue({ ok: false, error: "No autorizado" });
  const acceso = crearAccesoStaff(verificar, () => 0);
  await expect(acceso.intentar("staff", "0000")).rejects.toThrow(
    "Sin conexión",
  );
  for (let intento = 0; intento < 4; intento++)
    await acceso.intentar("staff", "0000");
  expect(acceso.segundosRestantes("staff")).toBe(0);
});
