import { expect, test } from 'vitest';
import { crearTemporadasDemo } from '../src/data/temporadas-demo';
import { resumirHucha } from '../src/lib/hucha';

test('resume solo cobros confirmados y gastos de la temporada', () => {
  const [actual, anterior] = crearTemporadasDemo(new Date('2026-11-21T12:00:00Z'));
  const resumen = resumirHucha(actual);

  expect(resumen).toMatchObject({ saldo: 430.5, ingresado: 438.5, gastado: 8 });
  expect(resumen.movimientos).toEqual([
    { tipo: 'gasto', concepto: 'Material de entrenamiento', fecha: '2026-11-18', importe: 8 },
    { tipo: 'ingreso', concepto: 'Amarilla por protestar', dorsal: 4, fecha: '2026-11-13', importe: 10 },
    { tipo: 'ingreso', concepto: 'Falta de respeto a entrenador, árbitro o rival', dorsal: 2, fecha: '2026-11-11', importe: 5 },
  ]);
  expect(resumirHucha(anterior)).toMatchObject({ saldo: 393.5, ingresado: 400, gastado: 6.5 });
});
