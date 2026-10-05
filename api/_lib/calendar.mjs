import { clasificarEventos } from './agenda.mjs';

export async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('google_token_error: ' + JSON.stringify(data));
  return data.access_token;
}

/**
 * @param {{ nombre: string, telefono: string, servicios: {name:string}[], fecha: string, hora: string, notas?: string, sede: string }} cita
 * hora is "HH:MM" in 24h format, e.g. "17:30"
 */
export async function createCalendarEvent(cita) {
  const accessToken = await getAccessToken();

  const serviciosStr = cita.servicios.map(s => s.name).join(', ');
  const description  = [
    `📞 ${cita.telefono}`,
    `📍 Sede: ${cita.sede}`,
    `💆 Servicios: ${serviciosStr}`,
    cita.notas ? `📝 Notas: ${cita.notas}` : null,
  ].filter(Boolean).join('\n');

  if (!/^\d{2}:\d{2}$/.test(cita.hora)) throw new Error('hora_invalida: ' + cita.hora);

  const [h, m]  = cita.hora.split(':').map(Number);
  // La cita dura 1h. Si empieza a las 23:xx, sumar una hora daría "24:00"
  // (inválido); en ese caso topamos el fin a las 23:59 del mismo día.
  let endH = h + 1;
  let endM = m;
  if (endH >= 24) { endH = 23; endM = 59; }
  const endHour = String(endH).padStart(2, '0');
  const endMin  = String(endM).padStart(2, '0');
  const startDT = `${cita.fecha}T${cita.hora}:00-06:00`;
  const endDT   = `${cita.fecha}T${endHour}:${endMin}:00-06:00`;

  const event = {
    summary:     `Cita — ${cita.nombre}`,
    description,
    start: { dateTime: startDT, timeZone: 'America/Costa_Rica' },
    end:   { dateTime: endDT,   timeZone: 'America/Costa_Rica' },
  };

  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method:  'POST',
      headers: {
        'authorization': `Bearer ${accessToken}`,
        'content-type':  'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error('google_calendar_error: ' + JSON.stringify(data));
  return data.id;
}

/**
 * Todos los eventos que se cruzan con [timeMin, timeMax), con paginación
 * (antes se leía una sola página y un mes cargado podía perder eventos).
 */
async function listEvents(params) {
  const accessToken = await getAccessToken();
  const calendarId  = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
  const items = [];
  let pageToken;
  do {
    const qs = new URLSearchParams({ ...params, maxResults: '250' });
    if (pageToken) qs.set('pageToken', pageToken);
    const res  = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${qs}`,
      { headers: { authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error('google_calendar_error: ' + JSON.stringify(data));
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

/**
 * Bloques de disponibilidad e intervalos ocupados del calendario entre
 * timeMin y timeMax (ISO con zona). Reglas en _lib/agenda.mjs.
 */
export async function getAgendaFromCalendar(timeMin, timeMax) {
  const events = await listEvents({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime' });
  return clasificarEventos(events);
}

/** Solo los bloques de disponibilidad (lo que publica /api/get-schedule). */
export async function getScheduleFromCalendar(timeMin, timeMax) {
  return (await getAgendaFromCalendar(timeMin, timeMax)).bloques;
}

/** Eventos creados, editados o borrados en los últimos `minutesBack` minutos. */
export async function getRecentlyChangedEvents(minutesBack = 120) {
  const updatedMin = new Date(Date.now() - minutesBack * 60 * 1000).toISOString();
  return listEvents({ updatedMin, showDeleted: 'true', singleEvents: 'true' });
}
