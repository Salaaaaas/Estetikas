// Agenda: qué significa cada evento del Google Calendar de la clínica y qué
// turnos quedan libres. Funciones puras (sin red ni BD), probadas en
// scripts/test-agenda.mjs.
//
// Modelo: todo se compara como INTERVALOS de tiempo [inicio, fin), en
// milisegundos absolutos. Antes se comparaba solo la hora de inicio exacta
// ("17:30" === "17:30"), así que un evento personal de 5:00 a 6:00 no
// bloqueaba el turno de 5:30, uno de 5:30 a 7:30 solo bloqueaba el primero y
// los eventos de día completo no bloqueaban nada.
//
// Cada evento del calendario es una de tres cosas:
//
//   'bloque'  — abre horario: tiene sede en "Ubicación", lo creó la cuenta de
//               la clínica, tiene hora (no es de día completo) y su título no
//               empieza con "Cita".
//   'ocupado' — todo lo demás: citas del sitio, citas a mano, eventos
//               personales, días completos (vacaciones), invitaciones
//               aceptadas o pendientes. Bloquea todos los turnos con los que
//               se cruce, aunque sea un minuto.
//   'ignorar' — eventos cancelados e invitaciones que Katherine rechazó.
//
// Un 'ocupado' bloquea solo su ciudad si se sabe la sede (ubicación del
// evento, o la línea "📍 Sede:" que escriben las citas del sitio); si no se
// sabe, bloquea TODAS las sedes: ante la duda, no se ofrece el hueco.

import { ciudadDeSede } from './profesionales.mjs';

export const DURACION_CITA_MIN = 60;
const MIN = 60_000;
const DIA = 24 * 60 * MIN;
// Costa Rica es UTC-6 todo el año (sin horario de verano).
const OFFSET_CR = '-06:00';
const OFFSET_CR_MS = -6 * 60 * MIN;

/** "YYYY-MM-DD" + "HH:MM" en hora de Costa Rica → ms absolutos. */
export function instanteCR(fecha, hora = '00:00') {
  return Date.parse(`${fecha}T${hora}:00${OFFSET_CR}`);
}

/** ms absolutos → { fecha: "YYYY-MM-DD", hora: "HH:MM" } en hora de Costa Rica. */
export function fechaHoraCR(ms) {
  const iso = new Date(ms + OFFSET_CR_MS).toISOString();
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/** Intervalo del turno que empieza en esa fecha y hora. */
export function intervaloTurno(fecha, hora, duracionMin = DURACION_CITA_MIN) {
  const inicio = instanteCR(fecha, hora);
  return { inicio, fin: inicio + duracionMin * MIN };
}

/** [a, b) y [c, d) comparten al menos un instante. Tocarse en el borde no cuenta. */
export function seSolapan(a, b) {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/** Sede canónica a partir de un texto libre ("Bataan", "Eco Clinic"...). */
export function sedeDeTexto(texto) {
  if (!texto) return null;
  const l = texto.toLowerCase();
  if (l.includes('bataan'))                                return 'Bataan (Clínica ODONTOBATAAN)';
  if (l.includes('eco clinic') || l.includes('eco-clinic')) return 'Guápiles (Eco Clinic)';
  if (l.includes('guápiles') || l.includes('guapiles'))     return 'Guápiles (Clínica Medical Numancia)';
  return null;
}

/** Sede de la línea "📍 Sede: ..." que createCalendarEvent escribe en la descripción. */
function sedeDeDescripcion(descripcion) {
  const m = /📍\s*Sede:\s*(.+)/.exec(descripcion ?? '');
  return m ? sedeDeTexto(m[1]) : null;
}

/**
 * Intervalo absoluto de un evento de Google Calendar. Los de día completo
 * cubren de las 00:00 del primer día a las 00:00 del día siguiente al último
 * (en Google, end.date ya es exclusivo). null si el evento no trae fechas.
 */
export function intervaloDeEvento(event) {
  const { start, end } = event;
  if (start?.dateTime) {
    const inicio = Date.parse(start.dateTime);
    const fin = end?.dateTime ? Date.parse(end.dateTime) : inicio + DURACION_CITA_MIN * MIN;
    return Number.isNaN(inicio) || Number.isNaN(fin) ? null : { inicio, fin, diaCompleto: false };
  }
  if (start?.date) {
    const inicio = instanteCR(start.date);
    const fin = end?.date ? instanteCR(end.date) : inicio + DIA;
    return Number.isNaN(inicio) || Number.isNaN(fin) ? null : { inicio, fin, diaCompleto: true };
  }
  return null;
}

/** @returns {'bloque' | 'ocupado' | 'ignorar'} */
export function tipoDeEvento(event) {
  if (event.status === 'cancelled') return 'ignorar';
  const yo = event.attendees?.find((a) => a.self);
  if (yo?.responseStatus === 'declined') return 'ignorar';

  const esBloque =
    sedeDeTexto(event.location) !== null &&
    event.organizer?.self === true &&
    Boolean(event.start?.dateTime) &&
    !/^\s*cita\b/i.test(event.summary ?? '');
  return esBloque ? 'bloque' : 'ocupado';
}

function toTime12(hora24) {
  let [h, m] = hora24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  else if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

function forIdsFromTitle(title) {
  const t = (title ?? '').toLowerCase();
  if (t.includes('masaje'))   return ['masajes', 'limpieza-facial'];
  if (t.includes('limpieza')) return ['limpieza-facial'];
  return ['*'];
}

/**
 * Separa los eventos en bloques de disponibilidad (formato Session de
 * horarios.mjs) e intervalos ocupados.
 *
 * @returns {{ bloques: import('./horarios.mjs').DateSession[],
 *             ocupados: { inicio: number, fin: number, sede: string|null }[] }}
 */
export function clasificarEventos(events) {
  const bloques = [];
  const ocupados = [];
  for (const event of events) {
    const tipo = tipoDeEvento(event);
    if (tipo === 'ignorar') continue;
    const iv = intervaloDeEvento(event);
    if (!iv || iv.fin <= iv.inicio) continue;

    if (tipo === 'bloque') {
      const ini = fechaHoraCR(iv.inicio);
      const fin = fechaHoraCR(iv.fin);
      // Un bloque que pasa de medianoche se corta a las 23:59 de su día.
      const horaFin = fin.fecha === ini.fecha ? fin.hora : '23:59';
      bloques.push({
        id:     `cal-${event.id}`,
        type:   'date',
        date:   ini.fecha,
        hours:  `${toTime12(ini.hora)} – ${toTime12(horaFin)}`,
        label:  event.summary ?? 'Disponible',
        forIds: forIdsFromTitle(event.summary),
        sede:   sedeDeTexto(event.location),
      });
    } else {
      ocupados.push({
        inicio: iv.inicio,
        fin:    iv.fin,
        sede:   sedeDeTexto(event.location) ?? sedeDeDescripcion(event.description),
      });
    }
  }
  return { bloques, ocupados };
}

/** Citas de la BD ({ fecha, hora, sede }) como intervalos ocupados. */
export function ocupadosDeCitas(citas) {
  return citas.map((c) => ({ ...intervaloTurno(c.fecha, c.hora), sede: c.sede }));
}

/**
 * El turno choca con algún intervalo ocupado de su ciudad. Sin sede (`null`),
 * cuenta cualquier ocupado: es lo que usa el sitio web, que pregunta por todas
 * las sedes juntas. Un ocupado sin sede conocida bloquea todas las ciudades.
 */
export function turnoOcupado(fecha, hora, sede, ocupados) {
  const turno = intervaloTurno(fecha, hora);
  const ciudad = sede ? ciudadDeSede(sede) : null;
  return ocupados.some((o) =>
    seSolapan(turno, o) &&
    (ciudad === null || o.sede === null || ciudadDeSede(o.sede) === ciudad));
}
