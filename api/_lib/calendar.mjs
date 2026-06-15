function toTime12(isoDatetime) {
  const match = isoDatetime?.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = match[2];
  const period = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  else if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

function sedeFromLocation(location) {
  if (!location) return null;
  const l = location.toLowerCase();
  if (l.includes('bataan'))                              return 'Bataan (Clínica ODONTOBATAAN)';
  if (l.includes('eco clinic') || l.includes('eco-clinic')) return 'Guápiles (Eco Clinic)';
  if (l.includes('guápiles') || l.includes('guapiles')) return 'Guápiles (Clínica Medical Numancia)';
  return null;
}

function forIdsFromTitle(title) {
  if (!title) return ['*'];
  const t = title.toLowerCase();
  if (t.includes('masaje'))   return ['masajes', 'limpieza-facial'];
  if (t.includes('limpieza')) return ['limpieza-facial'];
  return ['*'];
}

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
  const endHour = String(h + 1).padStart(2, '0');
  const endMin  = String(m).padStart(2, '0');
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

export async function getScheduleFromCalendar(timeMin, timeMax) {
  const accessToken = await getAccessToken();
  const calendarId  = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '250',
  });

  const res  = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error('google_calendar_error: ' + JSON.stringify(data));

  const schedule = [];
  for (const event of data.items ?? []) {
    const sede = sedeFromLocation(event.location);
    if (!sede) continue;

    const dateStr = event.start?.date ?? event.start?.dateTime?.split('T')[0];
    if (!dateStr) continue;

    const start12 = toTime12(event.start?.dateTime);
    const end12   = toTime12(event.end?.dateTime);
    if (!start12 || !end12) continue; // skip all-day events

    schedule.push({
      id:     `cal-${event.id}`,
      type:   'date',
      date:   dateStr,
      hours:  `${start12} – ${end12}`,
      label:  event.summary ?? 'Disponible',
      forIds: forIdsFromTitle(event.summary),
      sede,
    });
  }

  return schedule;
}

export async function getRecentlyChangedEvents(minutesBack = 120) {
  const accessToken = await getAccessToken();
  const calendarId  = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
  const updatedMin  = new Date(Date.now() - minutesBack * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    updatedMin,
    showDeleted:  'true',
    singleEvents: 'true',
    maxResults:   '50',
  });

  const res  = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error('google_calendar_error: ' + JSON.stringify(data));
  return data.items ?? [];
}
