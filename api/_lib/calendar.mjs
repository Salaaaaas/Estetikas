async function getAccessToken() {
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
 * @param {{ nombre: string, servicios: {nombre:string}[], fecha: string, hora: string, notas?: string, sede: string }} cita
 */
export async function createCalendarEvent(cita) {
  const accessToken = await getAccessToken();

  const serviciosStr = cita.servicios.map(s => s.nombre).join(', ');
  const description  = [
    `Sede: ${cita.sede}`,
    `Servicios: ${serviciosStr}`,
    cita.notas ? `Notas: ${cita.notas}` : null,
  ].filter(Boolean).join('\n');

  const startStr = `${cita.fecha}T${cita.hora}:00`;
  const startDt  = new Date(startStr);
  const endDt    = new Date(startDt.getTime() + 60 * 60 * 1000);
  const endStr   = endDt.toISOString().slice(0, 19);

  const event = {
    summary:     `Cita — ${cita.nombre}`,
    description,
    start: { dateTime: `${startStr}-05:00`, timeZone: 'America/Bogota' },
    end:   { dateTime: `${endStr}-05:00`,   timeZone: 'America/Bogota' },
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
