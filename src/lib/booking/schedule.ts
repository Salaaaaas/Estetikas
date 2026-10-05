// Horarios de atención y reglas de sede para /reservar. Funciones puras.
//
// CÓMO HABILITAR UN DÍA DE LA DRA. EN BATAAN (o Guápiles), SIN TOCAR CÓDIGO:
// crear en el Google Calendar de la clínica un evento con horario (no de día
// completo) cuyo campo "Ubicación" contenga "Bataan", "Guápiles" o
// "Eco Clinic". /api/get-schedule lo publica automáticamente, el calendario
// de reservas habilita esa fecha para todos los tratamientos y el formulario
// fija la sede a la del evento. El backend revalida contra el mismo
// calendario, así que no hay que hacer deploy. SCHEDULE_DATES es el
// mecanismo alternativo hardcodeado.
// El evento debe crearlo la cuenta de la clínica (las invitaciones de otras
// personas no se publican) y su título no puede empezar con "Cita": así se
// distinguen los bloques de las citas de pacientes. Cualquier otro evento del
// calendario (personal, de día completo, una cita a mano) ocupa los turnos con
// los que se cruza. Reglas completas en api/_lib/agenda.mjs.

import { conflictoDeSede, mensajeConflicto, type CitaSede } from '../../../api/_lib/profesionales.mjs';

export {
  LIMPIEZA_ID, SCHEDULE_WEEKLY, SCHEDULE_DATES,
  generateSlots, getApplicableSchedules, getSessionsForDate, sessionsForSede,
} from '../../../api/_lib/horarios.mjs';
export type { WeeklySession, DateSession, Session, Slot } from '../../../api/_lib/horarios.mjs';
import { LIMPIEZA_ID, generateSlots, getSessionsForDate } from '../../../api/_lib/horarios.mjs';
import type { Session } from '../../../api/_lib/horarios.mjs';

export const SEDE_OPTIONS = [
  { value: 'Bataan (Clínica ODONTOBATAAN)', label: 'Bataan — Clínica ODONTOBATAAN' },
  { value: 'Guápiles (Clínica Medical Numancia)', label: 'Guápiles — Clínica Medical Numancia' },
  { value: 'Guápiles (Eco Clinic)', label: 'Guápiles — Eco Clinic' },
];

export function sedeLabel(value: string): string {
  return SEDE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Fechas con sesión en los próximos 90 días (desde hoy). */
export function buildAvailableSet(schedules: Session[]): Set<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const set = new Set<string>();
  for (const s of schedules) {
    if (s.type === 'date') {
      if (new Date(`${s.date}T00:00:00`) >= today) set.add(s.date);
    } else {
      for (let i = 1; i < 90; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (s.weekdays.includes(d.getDay())) set.add(d.toISOString().split('T')[0]);
      }
    }
  }
  return set;
}

export interface SedeRules {
  allowed: Set<string>;
  hint: string;
}

/**
 * Reglas de sede para una fecha. Cada profesional atiende en una sola ciudad
 * por día, y Katherine y la Dra. Mónica en una sola sede; la Dra. Karen puede
 * cambiar de local en Guápiles con 2 horas de margen, lo que se resuelve por
 * hora en `slotBloqueado` (reglas en api/_lib/profesionales.mjs).
 */
export function computeSedeRules(
  sessions: Session[],
  cartIds: string[],
  citasDelDia: CitaSede[],
): SedeRules {
  const allSedes = SEDE_OPTIONS.map((o) => o.value);
  const otros = cartIds.filter((id) => id !== LIMPIEZA_ID);

  let allowed: Set<string>;
  let hint = '';

  if (otros.length > 0) {
    allowed = new Set(
      sessions
        .filter((s) => s.sede && (s.forIds.includes('*') || otros.some((id) => s.forIds.includes(id))))
        .map((s) => s.sede as string),
    );
    if (allowed.size === 1) hint = `Este día los tratamientos se atienden en ${sedeLabel([...allowed][0])}.`;
  } else {
    allowed = new Set();
    sessions.forEach((s) => { if (s.sede) allowed.add(s.sede); });
    if (sessions.some((s) => !s.sede)) allSedes.forEach((x) => allowed.add(x));
  }

  // Quita las sedes donde la profesional no puede estar a ninguna hora:
  // otra ciudad, u otro local para quien no cambia de local. La hora exacta
  // no importa para esos motivos, así que basta con probar la primera cita.
  if (cartIds.length > 0 && citasDelDia.length > 0) {
    let motivo: string | null = null;
    for (const sede of [...allowed]) {
      const c = citasDelDia
        .map((cita) => conflictoDeSede({ sede, hora: cita.hora, slugs: cartIds }, [cita]))
        .find((r) => r && r.motivo !== 'margen');
      if (c) {
        allowed.delete(sede);
        motivo = mensajeConflicto(c);
      }
    }
    if (motivo && allowed.size > 0) hint = motivo;
  }

  if (allowed.size === 0) {
    hint = 'No hay sede disponible para tus tratamientos en esta fecha. Por favor elige otro día.';
  }
  return { allowed, hint };
}

/** La hora choca con otra cita de la misma profesional en otro local (margen de 2 h). */
export function slotBloqueado(sede: string, hora: string, cartIds: string[], citasDelDia: CitaSede[]): boolean {
  if (!sede || cartIds.length === 0) return false;
  return conflictoDeSede({ sede, hora, slugs: cartIds }, citasDelDia) !== null;
}

/** Días de la lista disponible en los que todos sus turnos están ocupados. */
export function computeFullDays(
  availableSet: Set<string>,
  schedules: Session[],
  bookedByDate: Record<string, string[]>,
): Set<string> {
  const full = new Set<string>();
  availableSet.forEach((dateStr) => {
    // Se compara turno por turno: la lista de ocupados trae también horas de
    // otros tratamientos y sedes, así que contar no basta.
    const turnos = getSessionsForDate(dateStr, schedules).flatMap((s) => generateSlots(s.hours).map((x) => x.time24));
    const booked = new Set(bookedByDate[dateStr] ?? []);
    if (turnos.length > 0 && turnos.every((t) => booked.has(t))) full.add(dateStr);
  });
  return full;
}
