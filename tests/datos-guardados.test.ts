import { expect, test } from 'vitest';
import { crearTemporadasDemo } from '../src/data/temporadas-demo';
import { crearDatosGuardados } from '../src/lib/datos-guardados';

const temporadas = crearTemporadasDemo(new Date('2026-11-23T12:00:00Z'));
const [activa, anterior] = temporadas;

function almacenamientoPrueba() {
  const valores = new Map<string, string>();
  return {
    valores,
    getItem: (clave: string) => valores.get(clave) ?? null,
    setItem: (clave: string, valor: string) => valores.set(clave, valor),
  };
}

test('abre la temporada activa sin conexión y recupera solo las temporadas consultadas', () => {
  const memoria = almacenamientoPrueba();
  const guardados = crearDatosGuardados('https://club.example', memoria);
  guardados.guardar({ temporadas, temporada: activa });
  expect(guardados.leer().temporada?.id).toBe(activa.id);
  expect(guardados.leer(anterior.id).temporada).toBeUndefined();

  guardados.guardar({ temporadas, temporada: anterior });
  const trasRecarga = crearDatosGuardados('https://club.example/', memoria);
  expect(trasRecarga.leer(anterior.id).temporada?.multas).toHaveLength(2);
  expect(trasRecarga.leer().temporada?.id).toBe(activa.id);
  expect(crearDatosGuardados('https://otro.example', memoria).leer().temporada).toBeUndefined();
});

test('guarda una proyección pública y deja fuera credenciales y campos adicionales', () => {
  const memoria = almacenamientoPrueba();
  const guardados = crearDatosGuardados('https://club.example', memoria);
  const temporada = { ...activa, pin: 'solo-prueba', jugadoras: [{ ...activa.jugadoras[0], contacto: 'solo-prueba' }] };
  guardados.guardar({ temporadas, temporada });

  expect([...memoria.valores.values()].join()).not.toContain('solo-prueba');
  expect(guardados.leer().temporada?.jugadoras[0].nombre).toBe(activa.jugadoras[0].nombre);
});

test('tolera almacenamiento no disponible o datos corruptos', () => {
  const sinPermiso = () => {
    throw new Error('Almacenamiento no disponible');
  };
  const bloqueado = crearDatosGuardados('https://club.example', { getItem: sinPermiso, setItem: sinPermiso });
  expect(() => bloqueado.guardar({ temporadas, temporada: activa })).not.toThrow();
  expect(bloqueado.leer().temporadas).toEqual([]);
  const corrupto = crearDatosGuardados('https://club.example', { getItem: () => '{', setItem: () => {} });
  expect(corrupto.leer().temporada).toBeUndefined();
});

test('conserva la fecha de la última lectura correcta por temporada', () => {
  const memoria = almacenamientoPrueba();
  const guardados = crearDatosGuardados('https://club.example', memoria);
  const primera = '2026-11-23T17:30:00.000Z';
  const segunda = '2026-11-24T18:30:00.000Z';
  const tercera = '2026-11-25T19:30:00.000Z';
  guardados.guardar({ temporadas, temporada: activa }, primera);
  guardados.guardar({ temporadas, temporada: anterior }, segunda);
  guardados.guardar({ temporadas, temporada: activa }, tercera);

  const trasRecarga = crearDatosGuardados('https://club.example', memoria);
  expect(trasRecarga.leer().actualizadaEn).toBe(tercera);
  expect(trasRecarga.leer(anterior.id).actualizadaEn).toBe(segunda);
});

test('recupera las copias anteriores aunque carezcan de una fecha válida', () => {
  const memoria = almacenamientoPrueba();
  const guardados = crearDatosGuardados('https://club.example', memoria);
  guardados.guardar({ temporadas, temporada: activa });
  const [clave, texto] = [...memoria.valores][0];
  const copia = JSON.parse(texto);
  delete copia.lecturas[0].actualizadaEn;
  memoria.setItem(clave, JSON.stringify(copia));
  expect(guardados.leer().temporada?.id).toBe(activa.id);
  expect(guardados.leer().actualizadaEn).toBeUndefined();

  copia.lecturas[0].actualizadaEn = 'fecha corrupta';
  memoria.setItem(clave, JSON.stringify(copia));
  expect(guardados.leer().temporada?.id).toBe(activa.id);
  expect(guardados.leer().actualizadaEn).toBeUndefined();
});

test('conserva las fichas y multas del cuerpo técnico en la copia pública', () => {
  const memoria = almacenamientoPrueba();
  const guardados = crearDatosGuardados('https://club.example', memoria);
  const tecnico = { id: 'nacho', nombre: 'Nacho', tipo: 'tecnico' as const, activo: true, cuenta: 'privada' };
  const multa = {
    tecnico_id: tecnico.id,
    concepto_id: 'ent_tarde',
    importe: 4,
    fecha: '2026-11-23',
    estado: 'pendiente' as const,
  };
  guardados.guardar({ temporadas, temporada: { ...activa, tecnicos: [tecnico], multas: [multa] } });
  expect(guardados.leer().temporada?.tecnicos).toEqual([
    { id: tecnico.id, nombre: 'Nacho', tipo: 'tecnico', activo: true },
  ]);
  expect(guardados.leer().temporada?.multas).toMatchObject([multa]);
});
