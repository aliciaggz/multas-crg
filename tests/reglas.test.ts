import { describe, expect, test } from 'vitest';
import {
  calcularTardanzaPartido,
  contarFaltas,
  diasHastaVencimiento,
  escalonesPendientes,
  estaVencida,
  estadoMulta,
  importeActual,
  importeRegistro,
  noConvocable,
  saldoHucha,
  saldoJugadora,
} from '../src/lib/reglas';

describe('calcularTardanzaPartido', () => {
  test.each([
    [0, 0],
    [5, 0],
    [6, 3],
    [19, 3],
    [20, 7],
    [45, 7],
  ])('con %i minutos desde la convocatoria, la multa es de %i €', (minutos, importe) => {
    expect(calcularTardanzaPartido(minutos)).toBe(importe);
  });
});

const multaPendiente = { fecha: '2026-03-14', importe: 5, estado: 'pendiente' } as const;

describe('importeRegistro', () => {
  test('multiplica por cantidad solo los conceptos por prenda y aplica el factor de capitana', () => {
    const equipacion = { id: 'par_equipacion', tipo: 'por_prenda', importe: 3 };
    expect(importeRegistro(equipacion, 3, false)).toBe(9);
    expect(importeRegistro(equipacion, 3, true)).toBe(18);
    expect(importeRegistro({ id: 'ent_tarde', tipo: 'fijo', importe: 2 }, 3, true)).toBe(4);
  });

  test('aplica el factor de capitana a la diferencia del escalón', () => {
    expect(importeRegistro({ id: 'esc_6', tipo: 'escalon', importe: 2 }, 1, true)).toBe(4);
  });

  test('respeta el ajuste manual y el importe de una falta avisada', () => {
    expect(importeRegistro({ id: 'ajuste_manual', tipo: 'fijo', importe: 5.5 }, 1, true)).toBe(5.5);
    expect(importeRegistro({ id: 'ent_falta_con_aviso', tipo: 'fijo', importe: 0 }, 1, true)).toBe(0);
  });
});

describe('vencimiento de multas', () => {
  test('cuenta los días que quedan hasta el vencimiento por fecha de Madrid', () => {
    expect(diasHastaVencimiento('2026-03-14', '2026-03-28')).toBe(1);
    expect(diasHastaVencimiento('2026-03-14', '2026-03-29T21:59:59Z')).toBe(0);
    expect(diasHastaVencimiento('2026-03-14', '2026-03-29T22:00:00Z')).toBe(-1);
  });
  test.each([
    { dias: 14, hoy: '2026-03-28', estado: 'pendiente', vencida: false },
    { dias: 15, hoy: '2026-03-29', estado: 'pendiente', vencida: false },
    { dias: 16, hoy: '2026-03-30', estado: 'vencida', vencida: true },
  ])('una multa pendiente al día $dias', ({ hoy, estado, vencida }) => {
    expect(estaVencida(multaPendiente, hoy)).toBe(vencida);
    expect(estadoMulta(multaPendiente, hoy)).toBe(estado);
    expect(importeActual(multaPendiente, hoy)).toBe(vencida ? 10 : 5);
  });

  test.each(['pagada', 'anulada'] as const)('una multa %s conserva su estado después del plazo', (estado) => {
    const multa = { ...multaPendiente, estado };
    expect(estaVencida(multa, '2026-04-03')).toBe(false);
    expect(estadoMulta(multa, '2026-04-03')).toBe(estado);
  });

  test('una multa de capitana vencida cuesta cuatro veces el importe de catálogo', () => {
    const importe = importeRegistro({ id: 'par_respeto', tipo: 'fijo', importe: 5 }, 1, true);
    expect(importeActual({ ...multaPendiente, importe }, '2026-03-30')).toBe(20);
  });

  test.each([
    { dias: 14, declarada_en: '2026-03-28T12:00:00Z', vencida: false },
    { dias: 15, declarada_en: '2026-03-29T21:59:59Z', vencida: false },
    { dias: 16, declarada_en: '2026-03-29T22:00:00Z', vencida: true },
  ])('pago declarado a los $dias días en Madrid, evaluado al día 20', ({ declarada_en, vencida }) => {
    const multa = { ...multaPendiente, estado: 'pago_declarado', declarada_en } as const;
    expect(estaVencida(multa, '2026-04-03')).toBe(vencida);
    expect(estadoMulta(multa, '2026-04-03')).toBe(vencida ? 'vencida' : 'pago_declarado');
    expect(importeActual(multa, '2026-04-03')).toBe(vencida ? 10 : 5);
  });

  test('un pago rechazado vuelve a vencer según la fecha original', () => {
    const rechazada = { ...multaPendiente, declarada_en: null };
    expect(estadoMulta(rechazada, '2026-04-03')).toBe('vencida');
  });

  test('una multa vencida hace a la jugadora no convocable hasta que se acepte el pago', () => {
    const hoy = new Date('2026-03-29T22:00:00Z');
    expect(noConvocable([], hoy)).toBe(false);
    expect(noConvocable([multaPendiente], hoy)).toBe(true);
    expect(noConvocable([{ ...multaPendiente, estado: 'pagada' }], hoy)).toBe(false);
  });
});

describe('contarFaltas', () => {
  test('una temporada sin multas tiene cero faltas', () => {
    expect(contarFaltas([])).toBe(0);
  });

  test('cuenta las tres clases de faltas a entrenamientos, incluida la de 0 €', () => {
    expect(
      contarFaltas([
        { concepto_id: 'ent_falta_sin_aviso', estado: 'pendiente' },
        { concepto_id: 'ent_falta_menos_4h', estado: 'pago_declarado' },
        { concepto_id: 'ent_falta_con_aviso', estado: 'pagada' },
        { concepto_id: 'ent_falta_sin_aviso', estado: 'anulada' },
        { concepto_id: 'ent_tarde', estado: 'pendiente' },
        { concepto_id: 'par_falta', estado: 'pendiente' },
        { concepto_id: 'esc_3', estado: 'pagada' },
      ]),
    ).toBe(3);
  });
});

describe('escalonesPendientes', () => {
  test.each([
    { faltas: 0, esperado: [] },
    { faltas: 2, esperado: [] },
    { faltas: 3, esperado: [{ concepto_id: 'esc_3', importe: 4 }] },
    { faltas: 4, esperado: [{ concepto_id: 'esc_3', importe: 4 }] },
    { faltas: 6, esperado: [{ concepto_id: 'esc_6', importe: 6 }] },
    { faltas: 7, esperado: [{ concepto_id: 'esc_6', importe: 6 }] },
    { faltas: 9, esperado: [{ concepto_id: 'esc_9', importe: 8 }] },
    { faltas: 12, esperado: [{ concepto_id: 'esc_9', importe: 8 }] },
  ])('con $faltas faltas y sin escalones registrados', ({ faltas, esperado }) => {
    expect(escalonesPendientes(faltas, [])).toEqual(esperado);
  });

  const registradoTres = { concepto_id: 'esc_3', importeBase: 4, estado: 'pendiente' } as const;
  const registradoSeis = { concepto_id: 'esc_6', importeBase: 2, estado: 'pagada' } as const;

  test('a las 6 faltas propone solo 2 € si ya hay 4 € registrados', () => {
    expect(escalonesPendientes(6, [registradoTres])).toEqual([{ concepto_id: 'esc_6', importe: 2 }]);
  });

  test('a las 9 faltas propone solo 2 € si ya hay 6 € registrados', () => {
    expect(escalonesPendientes(9, [registradoTres, registradoSeis])).toEqual([{ concepto_id: 'esc_9', importe: 2 }]);
  });

  test('a las 9 faltas resta 4 € si se omitió el escalón de 6', () => {
    expect(escalonesPendientes(9, [registradoTres])).toEqual([{ concepto_id: 'esc_9', importe: 4 }]);
  });

  test('descuenta solo escalones vigentes y no repite el importe ya registrado', () => {
    expect(escalonesPendientes(6, [registradoTres, registradoSeis])).toEqual([]);
    expect(escalonesPendientes(6, [{ ...registradoTres, estado: 'anulada' }])).toEqual([
      { concepto_id: 'esc_6', importe: 6 },
    ]);
  });
});

describe('saldoJugadora', () => {
  test('suma pendientes y pagos por verificar, con su importe actual', () => {
    const hoy = '2026-04-03';
    expect(
      saldoJugadora(
        [
          { ...multaPendiente, importe: 3, fecha: '2026-04-01' },
          { ...multaPendiente, importe: 4 },
          { ...multaPendiente, importe: 5, estado: 'pago_declarado', declarada_en: '2026-03-28T12:00:00Z' },
          { ...multaPendiente, importe: 6, estado: 'pago_declarado', declarada_en: '2026-03-30T12:00:00Z' },
          { ...multaPendiente, importe: 7, estado: 'pagada' },
          { ...multaPendiente, importe: 8, estado: 'anulada' },
        ],
        hoy,
      ),
    ).toBe(28);
  });

  test('una jugadora sin multas tiene saldo cero', () => {
    expect(saldoJugadora([], '2026-04-03')).toBe(0);
  });

  test('conserva los céntimos al sumar multas', () => {
    expect(
      saldoJugadora(
        [
          { ...multaPendiente, importe: 0.1 },
          { ...multaPendiente, importe: 0.2 },
        ],
        '2026-03-28',
      ),
    ).toBe(0.3);
  });
});

describe('saldoHucha', () => {
  test('parte del importe inicial, suma cobros y resta gastos', () => {
    expect(saldoHucha(20.1, [5, 8.2, -3.1, -1.05])).toBe(29.15);
  });

  test('puede dejar un saldo negativo y conserva el inicial sin movimientos', () => {
    expect(saldoHucha(2.25, [-3.5])).toBe(-1.25);
    expect(saldoHucha(2.25, [])).toBe(2.25);
  });
});
