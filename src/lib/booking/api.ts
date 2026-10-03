// Cliente de las funciones /api de reservas (Vercel). Cachea por sesión de página.
import type { Session } from './schedule';
import type { CartItem } from '../cart';
import type { CitaSede } from '../../../api/_lib/profesionales.mjs';

const monthCache = new Map<string, Record<string, string[]>>();
const citasDiaCache = new Map<string, CitaSede[]>();

/** Bloques de fecha publicados desde Google Calendar (vacío si falla). */
export async function fetchCalendarSchedule(): Promise<Session[]> {
  try {
    const res = await fetch('/api/get-schedule');
    const data = await res.json();
    return Array.isArray(data.schedule) ? data.schedule : [];
  } catch {
    return [];
  }
}

/** Horarios reservados del mes: { "2026-06-10": ["17:30", …] }. */
export async function fetchMonthAvailability(year: number, month: number): Promise<Record<string, string[]>> {
  const key = `${year}-${month}`;
  const cached = monthCache.get(key);
  if (cached) return cached;
  const res = await fetch(`/api/get-availability?year=${year}&month=${month}`);
  const grouped = (await res.json()) as Record<string, string[]>;
  monthCache.set(key, grouped);
  return grouped;
}

/** Horas ya reservadas en una fecha (vacío si falla). */
export async function fetchBookedTimes(date: string): Promise<Set<string>> {
  try {
    const res = await fetch(`/api/get-availability?date=${date}`);
    const data = await res.json();
    return new Set<string>(data.booked ?? []);
  } catch {
    return new Set();
  }
}

/**
 * Citas activas de una fecha (sede, hora y profesionales; sin datos
 * personales). Lista vacía si falla: el servidor revalida de todas formas.
 */
export async function fetchCitasDelDia(date: string): Promise<CitaSede[]> {
  const cached = citasDiaCache.get(date);
  if (cached) return cached;
  let citas: CitaSede[] = [];
  try {
    const res = await fetch(`/api/sede-for-date?date=${date}`);
    const data = await res.json();
    if (Array.isArray(data.citas)) citas = data.citas;
  } catch {
    citas = [];
  }
  citasDiaCache.set(date, citas);
  return citas;
}

export interface BookingPayload {
  nombre: string;
  telefono: string;
  sede: string;
  fecha: string;
  hora: string;
  servicios: { slug: string; name: string }[];
  notas: string | null;
  consentimiento_habeas_data: true;
  turnstile_token: string;
}

export function buildPayload(
  form: { name: string; phone: string; sede: string; date: string; time: string; notes: string },
  cart: CartItem[],
  turnstileToken: string,
): BookingPayload {
  return {
    nombre: form.name,
    telefono: form.phone,
    sede: form.sede,
    fecha: form.date,
    hora: form.time,
    servicios: cart.map((i) => ({ slug: i.id, name: i.name })),
    notas: form.notes || null,
    consentimiento_habeas_data: true,
    turnstile_token: turnstileToken,
  };
}

export type BookingResult = { ok: true } | { ok: false; message: string };

/** Envía la reserva y traduce los errores del backend a un mensaje para la paciente. */
export async function createBooking(payload: BookingPayload): Promise<BookingResult> {
  let res: Response;
  try {
    res = await fetch('/api/create-booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: 'Error de conexión. Verifica tu internet e intenta de nuevo.' };
  }
  if (res.ok) return { ok: true };

  const data: { mensaje?: string; detalles?: string[] } = await res.json().catch(() => ({}));
  if (res.status === 429) return { ok: false, message: 'Demasiados intentos. Por favor espera unos minutos.' };
  if (res.status === 409) return { ok: false, message: data.mensaje || 'Ese horario acaba de ser reservado. Elige otra hora.' };
  if (res.status === 400 && data.mensaje) return { ok: false, message: data.mensaje };
  if (res.status === 400 && data.detalles) return { ok: false, message: `Revisa los datos: ${data.detalles[0]}` };
  if (res.status === 403) return { ok: false, message: 'No pudimos verificar tu identidad. Recarga la página.' };
  return { ok: false, message: 'No pudimos guardar tu cita. Intenta de nuevo.' };
}
