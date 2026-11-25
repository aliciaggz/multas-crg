import catalogo from '../data/catalogo.json';
import type { Destinatario, Multa, ReferenciaMulta, Temporada } from '../data/temporadas-demo';
import { aplicaDoble, estaActivo, multasDe, referenciaDe } from './destinatarios';
import { conceptoTardanzaPartido, contarFaltas, diasHastaVencimiento, escalonesPendientes, fechaEnMadrid, importeRegistro } from './reglas';

export type RegistroMulta = ReferenciaMulta & {
  concepto_id: string;
  importe: number;
  multiplicador: 1 | 2;
  cantidad: number;
  fecha: string;
  observacion: string | null;
  pagada_ahora: boolean;
};

export type ResultadoGuardado = { ok: true; temporada?: Temporada } | { ok: false; error: string };

type Borrador = {
  destinatario?: Destinatario;
  conceptoId: string;
  cantidad: string;
  minutos: string;
  importeManual: string;
  fecha: string;
  observacion: string;
  pagadaAhora: boolean;
};

type VistaPrevia =
  | { ok: true; multa: RegistroMulta; total: number; cuentaAsistencia: boolean }
  | { ok: false; mensaje: string };

export function prepararRegistro(datos: Borrador, hoy: string | Date): VistaPrevia {
  const { destinatario, fecha, pagadaAhora } = datos;
  if (!destinatario || !estaActivo(destinatario)) return { ok: false, mensaje: 'Selecciona a quién va dirigida la multa.' };
  if (!datos.conceptoId) return { ok: false, mensaje: 'Selecciona un concepto.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > fechaEnMadrid(hoy)) {
    return { ok: false, mensaje: 'Indica la fecha de la sanción, como máximo hoy.' };
  }

  const observacion = datos.observacion.trim() || null;
  let id = datos.conceptoId;
  if (id === 'par_tarde') {
    if (!/^\d+$/.test(datos.minutos) || !Number.isSafeInteger(Number(datos.minutos))) {
      return { ok: false, mensaje: 'Indica los minutos desde la hora de convocatoria.' };
    }
    const tardanza = conceptoTardanzaPartido(Number(datos.minutos));
    if (!tardanza) return { ok: false, mensaje: 'Hasta 5 minutos de retraso no generan multa.' };
    id = tardanza;
  }

  const manual = id === 'ajuste_manual';
  const concepto = catalogo.find((fila) => fila.id === id && fila.tipo !== 'escalon');
  if (!manual && !concepto) return { ok: false, mensaje: 'Selecciona un concepto válido.' };

  const porPrenda = concepto?.tipo === 'por_prenda';
  const cantidad = porPrenda ? Number(datos.cantidad) : 1;
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) return { ok: false, mensaje: 'Indica una cantidad de prendas válida.' };

  const importeManual = datos.importeManual.trim().replace(',', '.');
  if (manual && (!observacion || !/^\d+(\.\d{1,2})?$/.test(importeManual))) {
    return { ok: false, mensaje: 'Indica el importe y el motivo del ajuste manual.' };
  }

  const multiplicador = !manual && aplicaDoble(destinatario) ? 2 : 1;
  const importe = concepto ? importeRegistro(concepto, cantidad, aplicaDoble(destinatario)) : Number(importeManual);
  if (importe > 999999.99) return { ok: false, mensaje: 'El importe supera el máximo admitido.' };
  const total = pagadaAhora && diasHastaVencimiento(fecha, hoy) < 0 ? importe * 2 : importe;

  return {
    ok: true, total, cuentaAsistencia: concepto?.cuenta_asistencia ?? false,
    multa: { ...referenciaDe(destinatario), concepto_id: id, importe, multiplicador,
      cantidad, fecha, observacion, pagada_ahora: pagadaAhora },
  };
}

export function proponerEscalon(destinatario: Destinatario, multas: readonly Multa[], fecha: string) {
  const propias = multasDe(destinatario, multas);
  const faltas = contarFaltas(propias);
  const [propuesta] = escalonesPendientes(faltas, propias.map((multa) => ({
    ...multa, importeBase: multa.importe / (multa.multiplicador ?? 1),
  })));
  if (!propuesta) return;

  const multiplicador = aplicaDoble(destinatario) ? 2 : 1;
  const multa: RegistroMulta = {
    ...referenciaDe(destinatario), concepto_id: propuesta.concepto_id, importe: propuesta.importe * multiplicador,
    multiplicador, cantidad: 1, fecha, observacion: null, pagada_ahora: false,
  };
  return { faltas, multa };
}
