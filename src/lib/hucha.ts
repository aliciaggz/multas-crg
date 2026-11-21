import type { Temporada } from '../data/temporadas-demo';
import { nombreConcepto } from './presentacion';
import { saldoHucha } from './reglas';

type Movimiento = {
  tipo: 'ingreso' | 'gasto';
  concepto: string;
  fecha: string;
  importe: number;
  dorsal?: number;
};

export function resumirHucha(temporada: Temporada) {
  const cobros: Movimiento[] = temporada.multas
    .filter(({ estado, importe }) => estado === 'pagada' && importe > 0)
    .map((multa) => ({
      tipo: 'ingreso', concepto: nombreConcepto(multa.concepto_id),
      fecha: multa.fecha_pago ?? multa.fecha, importe: multa.importe,
      dorsal: temporada.jugadoras.find(({ id }) => id === multa.jugadora_id)?.dorsal,
    }));
  const gastos: Movimiento[] = temporada.gastos.map(({ motivo, fecha, importe }) => ({
    tipo: 'gasto', concepto: motivo, fecha, importe,
  }));
  const ingresado = saldoHucha(temporada.huchaInicial, cobros.map(({ importe }) => importe));
  const gastado = saldoHucha(0, gastos.map(({ importe }) => importe));

  return {
    saldo: saldoHucha(ingresado, [-gastado]), ingresado, gastado,
    movimientos: [...cobros, ...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}
