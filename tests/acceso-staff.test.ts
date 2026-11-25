import { expect, test, vi } from 'vitest';
import { crearAccesoStaff, crearAlmacenSesionStaff } from '../src/lib/acceso-staff';

const token = 'a'.repeat(64);
const tokenNuevo = 'b'.repeat(64);

test('respeta la espera indicada por Supabase desde el primer intento de esta pestaña', async () => {
  let ahora = 0;
  const verificar = vi.fn()
    .mockResolvedValueOnce({ ok: false, error: 'No autorizado', reintentar_en: 12 })
    .mockResolvedValueOnce({ ok: true, usuario: 'nacho', token });
  const acceso = crearAccesoStaff(verificar, () => ahora);
  expect(await acceso.intentar('0000')).toEqual({ estado: 'bloqueado' });
  expect(acceso.segundosRestantes()).toBe(12);
  ahora = 11_999;
  expect(await acceso.intentar('1111')).toEqual({ estado: 'bloqueado' });
  expect(verificar).toHaveBeenCalledTimes(1);
  ahora = 12_000;
  expect(await acceso.intentar('1111')).toEqual({ estado: 'correcto', usuario: 'nacho', token });
  expect(verificar.mock.calls).toEqual([['0000'], ['1111']]);
});

test('un fallo de red y un PIN rechazado sin espera no activan un bloqueo local', async () => {
  const verificar = vi.fn().mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValue({ ok: false, error: 'No autorizado' });
  const acceso = crearAccesoStaff(verificar, () => 0);
  await expect(acceso.intentar('0000')).rejects.toThrow('Sin conexión');
  for (let intento = 0; intento < 5; intento++) {
    expect(await acceso.intentar('0000')).toEqual({ estado: 'incorrecto' });
  }
  expect(acceso.segundosRestantes()).toBe(0);
});

test('rechaza un supuesto acceso exitoso que no entrega una credencial válida', async () => {
  const acceso = crearAccesoStaff(async () => ({ ok: true, usuario: 'nacho', token: '' }));
  await expect(acceso.intentar('0000')).rejects.toThrow('respuesta de acceso');
});

test('recupera el cierre pendiente por proyecto y deja fuera cualquier PIN o nombre', () => {
  const valores = new Map<string, string>();
  const memoria = {
    getItem: (clave: string) => valores.get(clave) ?? null,
    setItem: (clave: string, valor: string) => valores.set(clave, valor),
    removeItem: (clave: string) => valores.delete(clave),
  };
  const acceso = crearAlmacenSesionStaff('https://multas.example.test/', memoria);
  const sesion = { token, cierrePendiente: true as const, pin: '0001', usuario: 'nacho' };
  acceso.guardar(sesion);

  expect([...valores.values()]).toEqual([JSON.stringify({ token, cierrePendiente: true })]);
  expect(crearAlmacenSesionStaff('https://multas.example.test', memoria).leer()).toEqual({ token, cierrePendiente: true });
  expect(crearAlmacenSesionStaff('https://otro.example.test', memoria).leer()).toBeUndefined();

  acceso.guardar({ token: tokenNuevo });
  acceso.quitar(token);
  expect(acceso.leer()).toEqual({ token: tokenNuevo });
  acceso.quitar(tokenNuevo);
  expect(acceso.leer()).toBeUndefined();
});
