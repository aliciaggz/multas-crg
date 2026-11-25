import { expect, test } from 'vitest';
import { leerImporteHucha } from '../src/lib/hucha';

test('normaliza euros con céntimos y admite saldos iniciales negativos', () => {
  expect(leerImporteHucha('12,50')).toBe(12.5);
  expect(leerImporteHucha('-3.75')).toBe(-3.75);
  expect(leerImporteHucha('0')).toBe(0);
});

test.each(['', 'abc', '1,001', '1000000', '9e3'])('rechaza un importe inválido %s', (valor) => {
  expect(leerImporteHucha(valor)).toBeUndefined();
});
