import catalogo from './catalogo.json';
import { fechaEnMadrid, importeRegistro } from '../lib/reglas';

export type Jugadora = {
  id: string;
  nombre: string;
  dorsal: number;
  capitana?: boolean;
  activa?: boolean;
};

export type Tecnico = {
  tipo: 'tecnico';
  id: string;
  nombre: string;
  activo?: boolean;
};
export type Destinatario = Jugadora | Tecnico;
export type ReferenciaMulta = { jugadora_id: string; tecnico_id?: never } | { tecnico_id: string; jugadora_id?: never };

export type Multa = ReferenciaMulta & {
  id?: string;
  concepto_id: string;
  importe: number;
  importe_cobrado?: number | null;
  multiplicador?: number;
  fecha: string;
  estado: 'pendiente' | 'pago_declarado' | 'pagada' | 'anulada';
  declarada_en?: string;
  fecha_pago?: string;
};

export type AjusteHucha = {
  anterior: number;
  nuevo: number;
  motivo: string;
  fecha: string;
  usuario?: string;
  registrado_en: string;
};

export type Temporada = {
  id: string;
  nombre: string;
  activa: boolean;
  huchaInicial: number;
  jugadoras: readonly Jugadora[];
  tecnicos?: readonly Tecnico[];
  multas: readonly Multa[];
  gastos: readonly { motivo: string; fecha: string; importe: number }[];
  historialHuchaInicial?: readonly AjusteHucha[];
};

export type ResumenTemporada = Pick<Temporada, 'id' | 'nombre' | 'activa' | 'huchaInicial'>;

const elena = { id: 'elena', nombre: 'Elena', dorsal: 4, capitana: true };
const marta = { id: 'marta', nombre: 'Marta', dorsal: 12 };
const ana = { id: 'ana', nombre: 'Ana', dorsal: 9 };
const lucia = { id: 'lucia', nombre: 'Lucía', dorsal: 7 };
const carmen = { id: 'carmen', nombre: 'Carmen', dorsal: 2 };

export function crearTemporadasDemo(hoy: Date): readonly Temporada[] {
  const fecha = fechaEnMadrid(hoy);

  function haceDias(dias: number): string {
    const anterior = new Date(`${fecha}T00:00:00Z`);
    anterior.setUTCDate(anterior.getUTCDate() - dias);
    return anterior.toISOString().slice(0, 10);
  }

  function multa(jugadora: Jugadora, conceptoId: string, fechaMulta: string, estado: Multa['estado']): Multa {
    const concepto = catalogo.find(({ id }) => id === conceptoId)!;
    return {
      jugadora_id: jugadora.id,
      concepto_id: conceptoId,
      importe: importeRegistro(concepto, 1, Boolean(jugadora.capitana)),
      fecha: fechaMulta,
      estado,
    };
  }

  return [
    {
      id: '2026-27',
      nombre: '2026/27',
      activa: true,
      huchaInicial: 423.5,
      jugadoras: [elena, marta, ana, lucia, carmen],
      gastos: [{ motivo: 'Material de entrenamiento', fecha: haceDias(3), importe: 8 }],
      multas: [
        multa(elena, 'ent_falta_sin_aviso', haceDias(18), 'pendiente'),
        multa(elena, 'par_tarde', haceDias(16), 'pendiente'),
        multa(elena, 'ent_tarde', haceDias(5), 'pendiente'),
        {
          ...multa(elena, 'ent_falta_con_aviso', haceDias(21), 'pagada'),
          fecha_pago: haceDias(21),
        },
        {
          ...multa(elena, 'par_amarilla', haceDias(10), 'pagada'),
          fecha_pago: haceDias(8),
        },
        multa(marta, 'par_expulsion', haceDias(8), 'pendiente'),
        {
          ...multa(marta, 'ent_falta_sin_aviso', haceDias(9), 'pago_declarado'),
          declarada_en: haceDias(2),
        },
        multa(ana, 'par_amarilla', haceDias(2), 'pendiente'),
        {
          ...multa(lucia, 'ent_falta_con_aviso', haceDias(6), 'pagada'),
          fecha_pago: haceDias(6),
        },
        {
          ...multa(carmen, 'par_respeto', haceDias(12), 'pagada'),
          fecha_pago: haceDias(10),
        },
      ],
    },
    {
      id: '2025-26',
      nombre: '2025/26',
      activa: false,
      huchaInicial: 385,
      jugadoras: [marta, ana, carmen],
      gastos: [{ motivo: 'Agua para el equipo', fecha: '2026-05-09', importe: 6.5 }],
      multas: [
        {
          ...multa(marta, 'par_expulsion', '2026-05-05', 'pagada'),
          fecha_pago: '2026-05-08',
        },
        {
          ...multa(ana, 'par_amarilla', '2026-05-08', 'pagada'),
          fecha_pago: '2026-05-10',
        },
      ],
    },
  ];
}
