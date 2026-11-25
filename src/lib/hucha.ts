import type { Temporada } from '../data/temporadas-demo';
import { importeAbonado, nombreConcepto } from './presentacion';
import { destinatarioDe, esTecnico } from './destinatarios';
import { saldoHucha } from './reglas';

export function leerImporteHucha(texto: string): number | undefined {
  const normalizado = texto.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalizado)) return;
  const importe = Number(normalizado);
  return Math.abs(importe) <= 999_999.99 ? importe : undefined;
}

type Movimiento = {
  tipo: 'ingreso' | 'gasto';
  concepto: string;
  fecha: string;
  importe: number;
  dorsal?: number;
  nombreTecnico?: string;
};

export function resumirHucha(temporada: Temporada) {
  const cobros: Movimiento[] = temporada.multas
    .filter((multa) => multa.estado === 'pagada' && importeAbonado(multa) > 0)
    .map((multa) => {
      const persona = destinatarioDe(multa, temporada);
      return {
        tipo: 'ingreso',
        concepto: nombreConcepto(multa.concepto_id),
        fecha: multa.fecha_pago ?? multa.fecha,
        importe: importeAbonado(multa),
        ...(persona ? (esTecnico(persona) ? { nombreTecnico: persona.nombre } : { dorsal: persona.dorsal }) : {}),
      };
    });
  const gastos: Movimiento[] = temporada.gastos.map(({ motivo, fecha, importe }) => ({
    tipo: 'gasto',
    concepto: motivo,
    fecha,
    importe,
  }));
  const ingresado = saldoHucha(
    temporada.huchaInicial,
    cobros.map(({ importe }) => importe),
  );
  const gastado = saldoHucha(
    0,
    gastos.map(({ importe }) => importe),
  );

  return {
    saldo: saldoHucha(ingresado, [-gastado]),
    ingresado,
    gastado,
    movimientos: [...cobros, ...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}
