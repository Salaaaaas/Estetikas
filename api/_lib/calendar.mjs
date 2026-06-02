import { google } from 'googleapis';

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth/callback'
  );
}

/**
 * @param {{ nombre: string, servicios: {nombre:string}[], fecha: string, hora: string, notas?: string, sede: string }} cita
 */
export async function createCalendarEvent(cita) {
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  const calendar = google.calendar({ version: 'v3', auth });

  const [year, month, day] = cita.fecha.split('-').map(Number);
  const [hour, minute]     = cita.hora.split(':').map(Number);

  const start = new Date(year, month - 1, day, hour, minute);
  const end   = new Date(start.getTime() + 60 * 60 * 1000); // +1 hora

  const serviciosStr = cita.servicios.map(s => s.nombre).join(', ');
  const description  = [
    `Sede: ${cita.sede}`,
    `Servicios: ${serviciosStr}`,
    cita.notas ? `Notas: ${cita.notas}` : null,
  ].filter(Boolean).join('\n');

  const event = {
    summary:     `Cita — ${cita.nombre}`,
    description,
    start: { dateTime: start.toISOString(), timeZone: 'America/Bogota' },
    end:   { dateTime: end.toISOString(),   timeZone: 'America/Bogota' },
  };

  const { data } = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: event,
  });

  return data.id;
}
