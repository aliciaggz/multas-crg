import catalogo from "../data/catalogo.json";
import type { Jugadora } from "../data/temporadas-demo";

const moneda = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});
const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const euros = (importe: number) => moneda.format(importe);

export const fechaCorta = (fecha: string) =>
  formatoFecha.format(new Date(`${fecha}T00:00:00Z`));

export function importeAbonado(multa: {
  importe: number;
  importe_cobrado?: number | null;
}): number {
  return multa.importe_cobrado ?? multa.importe;
}

export const nombreConcepto = (id: string) =>
  catalogo.find((concepto) => concepto.id === id)?.nombre ??
  (id === "ajuste_manual" ? "Ajuste manual" : id);

export function coincideBusquedaJugadora(
  { nombre, dorsal }: Jugadora,
  texto: string,
): boolean {
  const termino = texto.trim().toLowerCase();
  const normalizar = (valor: string) =>
    valor
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  return (
    normalizar(nombre).includes(normalizar(termino)) ||
    String(dorsal).toString() === termino
  );
}
