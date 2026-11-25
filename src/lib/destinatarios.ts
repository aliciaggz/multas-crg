import type { Destinatario, Multa, ReferenciaMulta, Tecnico, Temporada } from '../data/temporadas-demo';

export function esTecnico(persona: Destinatario): persona is Tecnico {
  return 'tipo' in persona && persona.tipo === 'tecnico';
}

export function estaActivo(persona: Destinatario): boolean {
  return esTecnico(persona) ? persona.activo !== false : persona.activa !== false;
}

export function aplicaDoble(persona?: Destinatario): boolean {
  return persona !== undefined && (esTecnico(persona) || persona.capitana === true);
}

export function referenciaDe(persona: Destinatario): ReferenciaMulta {
  return esTecnico(persona) ? { tecnico_id: persona.id } : { jugadora_id: persona.id };
}

export function multasDe(persona: Destinatario, multas: readonly Multa[]): Multa[] {
  return esTecnico(persona) ? multas.filter((multa) => multa.tecnico_id === persona.id)
    : multas.filter((multa) => multa.jugadora_id === persona.id);
}

export function destinatarioDe(multa: Multa, temporada: Temporada): Destinatario | undefined {
  return multa.tecnico_id !== undefined
    ? temporada.tecnicos?.find(({ id }) => id === multa.tecnico_id)
    : temporada.jugadoras.find(({ id }) => id === multa.jugadora_id);
}

export function etiquetaDestinatario(persona: Destinatario): string {
  return esTecnico(persona) ? persona.nombre : `#${persona.dorsal} ${persona.nombre}`;
}

export function enlaceFicha(persona: Destinatario): string {
  return `#${esTecnico(persona) ? 'tecnico' : 'jugadora'}/${persona.id}`;
}
