import catalogo from '../data/catalogo.json';

type EstadoRegistrado = 'pendiente' | 'pago_declarado' | 'pagada' | 'anulada';

type MultaAsistencia = {
  concepto_id: string;
  estado: EstadoRegistrado;
};

type MultaConFecha = {
  estado: EstadoRegistrado;
  fecha: string;
  declarada_en?: string | null;
};

type MultaConImporte = MultaConFecha & { importe: number };

const formatoFechaMadrid = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const conceptosAsistencia = new Set(
  catalogo.filter(({ cuenta_asistencia }) => cuenta_asistencia).map(({ id }) => id),
);

const escalones = [
  { faltas: 9, id: 'esc_9' },
  { faltas: 6, id: 'esc_6' },
  { faltas: 3, id: 'esc_3' },
];

function conceptoCatalogo(idConcepto: string) {
  const concepto = catalogo.find(({ id }) => id === idConcepto);
  if (!concepto) {
    throw new Error(`Falta el concepto ${idConcepto} en el catálogo de multas.`);
  }
  return concepto;
}

/** Devuelve la multa en euros según los minutos desde la hora de convocatoria. */
export function calcularTardanzaPartido(minutos: number): number {
  if (minutos <= 5) {
    return 0;
  }

  const idConcepto = minutos < 20 ? 'par_tarde' : 'par_tarde_20';
  return conceptoCatalogo(idConcepto).importe;
}

/** Cuenta las faltas de una jugadora en una sola temporada. */
export function contarFaltas(multas: readonly MultaAsistencia[]): number {
  return multas.filter(({ concepto_id, estado }) =>
    estado !== 'anulada' && conceptosAsistencia.has(concepto_id),
  ).length;
}

/** Los importes base registrados excluyen los multiplicadores de capitana y vencimiento. */
export function escalonesPendientes(
  faltas: number,
  registrados: readonly (MultaAsistencia & { importeBase: number })[],
): { concepto_id: string; importe: number }[] {
  const escalon = escalones.find((nivel) => faltas >= nivel.faltas);
  if (!escalon) {
    return [];
  }

  const importeRegistrado = registrados
    .filter(({ concepto_id, estado }) =>
      estado !== 'anulada' && escalones.some(({ id }) => id === concepto_id),
    )
    .reduce((total, { importeBase }) => total + importeBase, 0);
  const importe = conceptoCatalogo(escalon.id).importe - importeRegistrado;

  return importe > 0 ? [{ concepto_id: escalon.id, importe }] : [];
}

export function importeRegistro(
  concepto: { id: string; tipo: string; importe: number },
  cantidad: number,
  capitana: boolean,
): number {
  if (concepto.id === 'ajuste_manual') {
    return concepto.importe;
  }

  const unidades = concepto.tipo === 'por_prenda' ? cantidad : 1;
  return concepto.importe * unidades * (capitana ? 2 : 1);
}

export function fechaEnMadrid(fecha: string | Date): string {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }

  const instante = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const partes = Object.fromEntries(formatoFechaMadrid.formatToParts(instante).map(
    ({ type, value }) => [type, value],
  ));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export function diasHastaVencimiento(fecha: string, hoy: string | Date): number {
  const origen = Date.parse(`${fecha}T00:00:00Z`);
  const referencia = Date.parse(`${fechaEnMadrid(hoy)}T00:00:00Z`);
  return 15 - (referencia - origen) / 86_400_000;
}

/** La fecha de la multa y el día 15 son fechas de calendario en Madrid. */
export function estaVencida(multa: MultaConFecha, hoy: string | Date): boolean {
  const referencia = multa.estado === 'pago_declarado'
    ? multa.declarada_en
    : multa.estado === 'pendiente' ? hoy : null;
  if (referencia == null) {
    return false;
  }

  return diasHastaVencimiento(multa.fecha, referencia) < 0;
}

export function estadoMulta(multa: MultaConFecha, hoy: string | Date): EstadoRegistrado | 'vencida' {
  return estaVencida(multa, hoy) ? 'vencida' : multa.estado;
}

export function importeActual(multa: MultaConImporte, hoy: string | Date): number {
  return estaVencida(multa, hoy) ? multa.importe * 2 : multa.importe;
}

export function noConvocable(multas: readonly MultaConFecha[], hoy: string | Date): boolean {
  return multas.some((multa) => estaVencida(multa, hoy));
}

function sumarImportes(inicial: number, importes: readonly number[]): number {
  const centimos = importes.reduce(
    (total, importe) => total + Math.round(importe * 100),
    Math.round(inicial * 100),
  );
  return centimos / 100;
}

/** Calcula la deuda de una jugadora con las multas de una sola temporada. */
export function saldoJugadora(multas: readonly MultaConImporte[], hoy: string | Date): number {
  const importes = multas
    .filter(({ estado }) => estado === 'pendiente' || estado === 'pago_declarado')
    .map((multa) => importeActual(multa, hoy));
  return sumarImportes(0, importes);
}

/** Recibe los cobros confirmados en positivo y los gastos en negativo. */
export function saldoHucha(inicial: number, movimientos: readonly number[]): number {
  return sumarImportes(inicial, movimientos);
}
