import catalogo from '../data/catalogo.json';

const moneda = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const formatoFecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const euros = (importe: number) => moneda.format(importe);

export const fechaCorta = (fecha: string) => formatoFecha.format(new Date(`${fecha}T00:00:00Z`));

export const nombreConcepto = (id: string) =>
  catalogo.find((concepto) => concepto.id === id)?.nombre ?? (id === 'ajuste_manual' ? 'Ajuste manual' : id);
