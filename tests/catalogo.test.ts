import { expect, test } from 'vitest';
import catalogo from '../src/data/catalogo.json';

test('el catálogo contiene todos los conceptos e importes de la spec', () => {
  const importesEsperados = {
    ent_tarde: 2,
    ent_falta_sin_aviso: 5,
    ent_falta_menos_4h: 3,
    ent_falta_con_aviso: 0,
    ent_uniforme: 1,
    ent_respeto: 6,
    esc_3: 4,
    esc_6: 6,
    esc_9: 8,
    par_tarde: 3,
    par_tarde_20: 7,
    par_no_asiste_local: 5,
    par_falta: 20,
    par_convocatoria: 1,
    par_equipacion: 3,
    par_respeto: 5,
    par_amarilla: 5,
    par_expulsion: 10,
  };

  expect(catalogo).toHaveLength(Object.keys(importesEsperados).length);
  expect(Object.fromEntries(catalogo.map(({ id, importe }) => [id, importe]))).toEqual(importesEsperados);
});

test('identifica como bono la falta avisada con 4 horas o más', () => {
  expect(catalogo.find(({ id }) => id === 'ent_falta_con_aviso')?.nombre).toContain('(bono)');
});
