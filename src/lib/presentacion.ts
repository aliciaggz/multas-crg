import catalogo from '../data/catalogo.json';
import type { Destinatario, Multa } from '../data/temporadas-demo';

import { esTecnico } from './destinatarios';
import { importeActual } from './reglas';

const moneda = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const formatoFecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const euros = (importe: number) => moneda.format(importe);

export const fechaCorta = (fecha: string) => formatoFecha.format(new Date(`${fecha}T00:00:00Z`));

export function importeAbonado(multa: { importe: number; importe_cobrado?: number | null }): number {
  return multa.importe_cobrado ?? multa.importe;
}

export function importeVisible(multa: Multa, hoy: Date): number {
  return multa.estado === 'pagada' ? importeAbonado(multa) : importeActual(multa, hoy);
}

export const nombreConcepto = (id: string) =>
  catalogo.find((concepto) => concepto.id === id)?.nombre ?? (id === 'ajuste_manual' ? 'Ajuste manual' : id);

export function coincideBusquedaJugadora(persona: Destinatario, texto: string): boolean {
  const termino = texto.trim().replace(/^#/, '');
  const normalizar = (valor: string) =>
    valor
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  return (
    normalizar(persona.nombre).includes(normalizar(termino)) ||
    (!esTecnico(persona) && String(persona.dorsal).includes(termino))
  );
}
