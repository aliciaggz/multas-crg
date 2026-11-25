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
    {
      tipo: 'ingreso',
      concepto: 'Falta de respeto a entrenador, árbitro o rival',
      dorsal: 2,
      fecha: '2026-11-11',
      importe: 5,
    },
  ]);
  expect(resumirHucha(anterior)).toMatchObject({ saldo: 393.5, ingresado: 400, gastado: 6.5 });
});

test('la hucha contabiliza el importe efectivamente cobrado', () => {
  const [temporada] = crearTemporadasDemo(new Date('2026-11-21T12:00:00Z'));
  const multas = temporada.multas.map((multa) =>
    multa.estado === 'pagada' && multa.concepto_id === 'par_amarilla' ? { ...multa, importe_cobrado: 20 } : multa,
  );

  const resumen = resumirHucha({ ...temporada, multas });
  expect(resumen).toMatchObject({ saldo: 440.5, ingresado: 448.5, gastado: 8 });
  expect(resumen.movimientos.find(({ concepto }) => concepto === 'Amarilla por protestar')?.importe).toBe(20);
});

test('un pago del cuerpo técnico solo entra en la hucha cuando se confirma', () => {
  const [temporada] = crearTemporadasDemo(new Date('2026-11-21T12:00:00Z'));
  const tecnico = { id: 'jaime', nombre: 'Jaime', tipo: 'tecnico' as const };
  const multa = {
    tecnico_id: tecnico.id,
    concepto_id: 'ent_tarde',
    importe: 4,
    fecha: '2026-11-01',
    estado: 'pago_declarado' as const,
  };
  const datos = { ...temporada, tecnicos: [tecnico] };
  expect(resumirHucha({ ...datos, multas: [multa] }).saldo).toBe(temporada.huchaInicial - 8);
  const confirmado = resumirHucha({
    ...datos,
    multas: [{ ...multa, estado: 'pagada', fecha_pago: '2026-11-21', importe_cobrado: 8 }],
  });
  expect(confirmado.saldo).toBe(temporada.huchaInicial);
  expect(confirmado.movimientos[0]).toMatchObject({ nombreTecnico: 'Jaime', importe: 8, tipo: 'ingreso' });
});
