import { expect, test } from 'vitest';
import { prepararRegistro, proponerEscalon } from '../src/lib/registro-multas';
import type { Multa } from '../src/data/temporadas-demo';

const jugadora = { id: 'jugadora', nombre: 'Capitana de prueba', dorsal: 4, capitana: true };
const hoy = '2026-11-22';
const entrada = { destinatario: jugadora, conceptoId: 'par_equipacion', cantidad: '2', minutos: '', importeManual: '',
  fecha: hoy, observacion: '', pagadaAhora: false };

test('calcula por prenda y duplica para capitanas', () => {
  expect(prepararRegistro(entrada, hoy)).toMatchObject({
    ok: true, total: 12, multa: { importe: 12, cantidad: 2, multiplicador: 2 },
  });
});

test.each([[5, null, 0], [6, 'par_tarde', 6], [19, 'par_tarde', 6], [20, 'par_tarde_20', 14]])(
  'clasifica %i minutos de tardanza a partido', (minutos, concepto_id, importe) => {
    const resultado = prepararRegistro({ ...entrada, conceptoId: 'par_tarde', minutos: String(minutos) }, hoy);
    if (!concepto_id) expect(resultado).toMatchObject({ ok: false });
    else expect(resultado).toMatchObject({ ok: true, multa: { concepto_id, importe, cantidad: 1 } });
  },
);

test('el ajuste manual exige un motivo y conserva su importe', () => {
  const ajuste = { ...entrada, conceptoId: 'ajuste_manual', importeManual: '12,50' };
  expect(prepararRegistro(ajuste, hoy)).toMatchObject({ ok: false });
  expect(prepararRegistro({ ...ajuste, observacion: 'Motivo de prueba' }, hoy)).toMatchObject({
    ok: true, multa: { importe: 12.5, multiplicador: 1, cantidad: 1, observacion: 'Motivo de prueba' },
  });
});

test('la vista previa de pagar ahora muestra el doble si ya venció, sin alterar el importe de registro', () => {
  expect(prepararRegistro({ ...entrada, fecha: '2026-11-06', pagadaAhora: true }, hoy)).toMatchObject({
    ok: true, total: 24, multa: { importe: 12, pagada_ahora: true },
  });
});

test('propone solo la diferencia del nuevo escalón con el multiplicador de capitana', () => {
  const falta: Multa = { jugadora_id: jugadora.id, concepto_id: 'ent_falta_con_aviso', importe: 0, fecha: hoy, estado: 'pagada' };
  const registrado: Multa = { ...falta, concepto_id: 'esc_3', importe: 8, multiplicador: 2 };
  expect(proponerEscalon(jugadora, [registrado, ...Array.from({ length: 6 }, () => falta)], hoy))
    .toMatchObject({ faltas: 6, multa: { concepto_id: 'esc_6', importe: 4, multiplicador: 2, pagada_ahora: false } });
});

test('el entrenador recibe el multiplicador de catálogo, con la excepción del ajuste manual', () => {
  const tecnico = { id: 'jaime', nombre: 'Jaime', tipo: 'tecnico' as const };
  expect(prepararRegistro({ ...entrada, destinatario: tecnico }, hoy)).toMatchObject({
    ok: true, total: 12, multa: { tecnico_id: tecnico.id, importe: 12, cantidad: 2, multiplicador: 2 },
  });
  expect(prepararRegistro({ ...entrada, destinatario: tecnico, conceptoId: 'ajuste_manual',
    importeManual: '3,50', observacion: 'Ajuste' }, hoy)).toMatchObject({
    ok: true, total: 3.5, multa: { tecnico_id: tecnico.id, importe: 3.5, multiplicador: 1 },
  });
});

test('el escalón del entrenador usa solo sus faltas, incluso si hay una jugadora con el mismo ID', () => {
  const tecnico = { id: jugadora.id, nombre: 'Jaime', tipo: 'tecnico' as const };
  const falta = { concepto_id: 'ent_falta_con_aviso', importe: 0, fecha: hoy, estado: 'pagada' as const };
  const faltaJugadora = { ...falta, jugadora_id: jugadora.id };
  const faltaTecnico = { ...falta, tecnico_id: tecnico.id };
  expect(proponerEscalon(tecnico, [faltaJugadora, faltaJugadora, faltaTecnico], hoy)).toBeUndefined();
  expect(proponerEscalon(tecnico, [faltaJugadora, faltaTecnico, faltaTecnico, faltaTecnico], hoy))
    .toMatchObject({ faltas: 3, multa: { tecnico_id: tecnico.id, importe: 8, multiplicador: 2 } });
});
