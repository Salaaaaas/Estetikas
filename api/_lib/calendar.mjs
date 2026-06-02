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

// Parses "5:30 PM" or "9:00 AM" → "17:30" / "09:00"
function parseTime12(str) {
  const m = str.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = m[2];
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

// hora field comes as "Limpiezas Faciales · 5:30 PM – 7:30 PM"
// Returns { startTime: "17:30", endTime: "19:30" }
function parseHoraField(hora) {
  const hoursPart = hora.includes(' · ') ? hora.split(' · ')[1] : hora;
  const parts = hoursPart.split(' – ');
  const startTime = parseTime12(parts[0]);
  const endTime   = parts[1] ? parseTime12(parts[1]) : null;
  return { startTime, endTime };
}

/**
 * @param {{ nombre: string, servicios: {name:string}[], fecha: string, hora: string, notas?: string, sede: string }} cita
 */
export async function createCalendarEvent(cita) {
  const accessToken = await getAccessToken();

  const serviciosStr = cita.servicios.map(s => s.name).join(', ');
  const description  = [
    `Sede: ${cita.sede}`,
    `Servicios: ${serviciosStr}`,
    cita.notas ? `Notas: ${cita.notas}` : null,
  ].filter(Boolean).join('\n');

  const { startTime, endTime } = parseHoraField(cita.hora);
  if (!startTime) throw new Error('hora_parse_error: ' + cita.hora);

  const fallbackEnd = (() => {
    const [h, m] = startTime.split(':').map(Number);
    return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  })();

  const startDT = `${cita.fecha}T${startTime}:00-05:00`;
  const endDT   = `${cita.fecha}T${endTime ?? fallbackEnd}:00-05:00`;

  const event = {
    summary:     `Cita — ${cita.nombre}`,
    description,
    start: { dateTime: startDT, timeZone: 'America/Bogota' },
    end:   { dateTime: endDT,   timeZone: 'America/Bogota' },
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
