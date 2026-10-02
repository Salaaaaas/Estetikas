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

export interface WeeklySession {
  id: string;
  type: 'weekly';
  /** 0 = domingo … 6 = sábado */
  weekdays: number[];
  /** "5:30 PM – 7:30 PM" */
  hours: string;
  label: string;
  /** ids de tratamientos que cubre; '*' = todos */
  forIds: string[];
  sede?: string;
}

export interface DateSession {
  id: string;
  type: 'date';
  /** YYYY-MM-DD */
  date: string;
  hours: string;
  label: string;
  forIds: string[];
  sede?: string;
}

export type Session = WeeklySession | DateSession;

export interface Slot {
  label: string;
  time24: string;
}

export const LIMPIEZA_ID = 'limpieza-facial';
const SLOT_DURATION_MIN = 60;

export const SEDE_OPTIONS = [
  { value: 'Bataan (Clínica ODONTOBATAAN)', label: 'Bataan — Clínica ODONTOBATAAN' },
  { value: 'Guápiles (Clínica Medical Numancia)', label: 'Guápiles — Clínica Medical Numancia' },
  { value: 'Guápiles (Eco Clinic)', label: 'Guápiles — Eco Clinic' },
];

export const SCHEDULE_WEEKLY: WeeklySession[] = [
  {
    id: 'limpiezas-sem',
    type: 'weekly',
    weekdays: [2, 3, 4, 5],
    hours: '5:30 PM – 7:30 PM',
    label: 'Limpiezas Faciales',
    forIds: [LIMPIEZA_ID],
  },
];

/** Días puntuales de la Dra. Karen (tratamientos que requieren médico). */
export const SCHEDULE_DATES: DateSession[] = [
  {
    id: 'dra-karen-2026-07-18',
    type: 'date',
    date: '2026-07-18',
    hours: '8:00 AM – 5:00 PM',
    label: 'Dra. Karen — Medicina Estética',
    forIds: [
      'botox', 'bioestimuladores-colageno', 'depilacion',
      'dermaplaning-dermapen', 'eliminacion-lunares-verrugas',
      'enzimas-doble-menton', 'exosomas-polinucleotidos',
      'mesoterapia', 'peelings', 'reduccion',
      'rejuvenecimiento-facial-integral', 'rellenos',
      'sueroterapia', 'tratamiento-estrias',
    ],
    sede: 'Bataan (Clínica ODONTOBATAAN)',
  },
];

export function sedeLabel(value: string): string {
  return SEDE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function parseTime12ToMin(str: string): number | null {
  const m = str.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

const minToTime24 = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

function minToTime12(total: number): string {
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "5:30 PM – 7:30 PM" → turnos de 60 min: 5:30 PM, 6:30 PM */
export function generateSlots(hours: string): Slot[] {
  const parts = hours.split(' – ');
  if (parts.length !== 2) return [];
  const start = parseTime12ToMin(parts[0]);
  const end = parseTime12ToMin(parts[1]);
  if (start === null || end === null) return [];
  const slots: Slot[] = [];
  for (let t = start; t + SLOT_DURATION_MIN <= end; t += SLOT_DURATION_MIN) {
    slots.push({ label: minToTime12(t), time24: minToTime24(t) });
  }
  return slots;
}

/** Sesiones que cubren al menos uno de los tratamientos del carrito (todas si está vacío). */
export function getApplicableSchedules(schedule: Session[], cartIds: string[]): Session[] {
  if (cartIds.length === 0) return schedule;
  return schedule.filter((s) => s.forIds.includes('*') || s.forIds.some((id) => cartIds.includes(id)));
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

export function getSessionsForDate(dateStr: string, schedules: Session[]): Session[] {
  const dow = new Date(`${dateStr}T00:00:00`).getDay();
  return schedules.filter((s) => (s.type === 'date' ? s.date === dateStr : s.weekdays.includes(dow)));
}

/** Los bloques con sede fija solo aplican a su propia sede. */
export function sessionsForSede(sessions: Session[], sede: string): Session[] {
  if (!sede) return sessions;
  return sessions.filter((s) => !s.sede || s.sede === sede);
}

export interface SedeRules {
  allowed: Set<string>;
  hint: string;
}

/**
 * Reglas de sede para una fecha. Katherine (limpiezas) atiende en una sola
 * sede por día: la primera reserva con limpieza la fija (`lockedLimpiezaSede`).
 * La Dra. Karen atiende en la sede de su bloque del día.
 */
export function computeSedeRules(
  sessions: Session[],
  cartIds: string[],
  lockedLimpiezaSede: string | null,
): SedeRules {
  const allSedes = SEDE_OPTIONS.map((o) => o.value);
  const otros = cartIds.filter((id) => id !== LIMPIEZA_ID);
  const hasLimpieza = cartIds.includes(LIMPIEZA_ID);

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

  if (hasLimpieza && allowed.size > 0 && lockedLimpiezaSede) {
    allowed = new Set(allowed.has(lockedLimpiezaSede) ? [lockedLimpiezaSede] : []);
    if (allowed.size === 1) hint = `Este día las limpiezas faciales se atienden en ${sedeLabel(lockedLimpiezaSede)}.`;
  }

  if (allowed.size === 0) {
    hint = 'No hay sede disponible para tus tratamientos en esta fecha. Por favor elige otro día.';
  }
  return { allowed, hint };
}

/** Días de la lista disponible cuyos turnos ya están todos ocupados. */
export function computeFullDays(
  availableSet: Set<string>,
  schedules: Session[],
  bookedByDate: Record<string, string[]>,
): Set<string> {
  const full = new Set<string>();
  availableSet.forEach((dateStr) => {
    const total = getSessionsForDate(dateStr, schedules).reduce((sum, s) => sum + generateSlots(s.hours).length, 0);
    const booked = (bookedByDate[dateStr] ?? []).length;
    if (total > 0 && booked >= total) full.add(dateStr);
  });
  return full;
}
