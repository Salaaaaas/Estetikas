// Horarios de atención: datos y funciones puras compartidas por el frontend
// (src/lib/booking/schedule.ts los reexporta) y por create-booking, que
// revalida en el servidor que la hora pedida sea un turno realmente ofrecido.
// Antes solo el navegador generaba los turnos, y la API aceptaba cualquier
// "HH:MM" (09:01, 03:00, 99:99...).

export const LIMPIEZA_ID = 'limpieza-facial';
const SLOT_DURATION_MIN = 60;

export const SCHEDULE_WEEKLY = [
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
export const SCHEDULE_DATES = [
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
      'rejuvenecimiento-facial-premium', 'onicomicosis-picolaser', 'terapia-capilar',
    ],
    sede: 'Bataan (Clínica ODONTOBATAAN)',
  },
];

function parseTime12ToMin(str) {
  const m = str.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

const minToTime24 = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

function minToTime12(total) {
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "5:30 PM – 7:30 PM" → turnos de 60 min: 5:30 PM, 6:30 PM */
export function generateSlots(hours) {
  const parts = hours.split(' – ');
  if (parts.length !== 2) return [];
  const start = parseTime12ToMin(parts[0]);
  const end = parseTime12ToMin(parts[1]);
  if (start === null || end === null) return [];
  const slots = [];
  for (let t = start; t + SLOT_DURATION_MIN <= end; t += SLOT_DURATION_MIN) {
    slots.push({ label: minToTime12(t), time24: minToTime24(t) });
  }
  return slots;
}

/** Sesiones que cubren al menos uno de los tratamientos del carrito (todas si está vacío). */
export function getApplicableSchedules(schedule, cartIds) {
  if (cartIds.length === 0) return schedule;
  return schedule.filter((s) => s.forIds.includes('*') || s.forIds.some((id) => cartIds.includes(id)));
}

export function getSessionsForDate(dateStr, schedules) {
  const dow = new Date(`${dateStr}T00:00:00`).getDay();
  return schedules.filter((s) => (s.type === 'date' ? s.date === dateStr : s.weekdays.includes(dow)));
}

/** Los bloques con sede fija solo aplican a su propia sede. */
export function sessionsForSede(sessions, sede) {
  if (!sede) return sessions;
  return sessions.filter((s) => !s.sede || s.sede === sede);
}

/**
 * Horas "HH:MM" que el formulario ofrece para esa fecha, sede y tratamientos,
 * con las mismas reglas que BookingForm. `calendarSessions` son los bloques
 * de getScheduleFromCalendar.
 */
export function horasOfrecidas(fecha, sede, slugs, calendarSessions = []) {
  const todas = [...SCHEDULE_WEEKLY, ...SCHEDULE_DATES, ...calendarSessions];
  const sesiones = sessionsForSede(getSessionsForDate(fecha, getApplicableSchedules(todas, slugs)), sede);
  return new Set(sesiones.flatMap((s) => generateSlots(s.hours).map((x) => x.time24)));
}
