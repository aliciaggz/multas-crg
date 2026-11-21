import { expect, test } from 'vitest';
import { crearAccesoDemo } from '../src/lib/acceso-demo';

test('bloquea durante un minuto a partir del quinto fallo', () => {
  const acceso = crearAccesoDemo();
  const incorrecto = acceso.pin === '0000' ? '9999' : '0000';
  for (let intento = 0; intento < 4; intento++) {
    expect(acceso.intentar(acceso.usuario, incorrecto, 0)).toBe('incorrecto');
  }

  expect(acceso.intentar(acceso.usuario, incorrecto, 0)).toBe('bloqueado');
  expect(acceso.segundosRestantes(0)).toBe(60);
  expect(acceso.intentar(acceso.usuario, acceso.pin, 59_999)).toBe('bloqueado');
  expect(acceso.segundosRestantes(60_000)).toBe(0);
  expect(acceso.intentar(acceso.usuario, acceso.pin, 60_000)).toBe('correcto');
});

test('rechaza un usuario incorrecto y reinicia los fallos tras un acierto', () => {
  const acceso = crearAccesoDemo();
  const incorrecto = 'otra-cuenta';
  for (let intento = 0; intento < 4; intento++) {
    expect(acceso.intentar(incorrecto, acceso.pin, 0)).toBe('incorrecto');
  }

  expect(acceso.intentar(acceso.usuario, acceso.pin, 1)).toBe('correcto');
  expect(acceso.intentar(incorrecto, acceso.pin, 2)).toBe('incorrecto');
  expect(acceso.segundosRestantes(2)).toBe(0);
});
