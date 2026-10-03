// Retención de datos (privacidad: "se conservan como máximo 2 años desde la
// última cita y luego se eliminan de forma irreversible").
//
// Antes existía purge_old_citas() en SQL pero nada la llamaba, y aun así no
// tocaba las copias: el evento de Google Calendar (con nombre y teléfono en
// texto plano) ni las filas de audit_log. Esto corre a diario dentro del cron
// de register-calendar-watch (el plan Hobby de Vercel no admite más crons).

import { supabase } from './supabase.mjs';
import { getAccessToken } from './calendar.mjs';

const LOTE = 200;

function haceDosAnios() {
  const d = new Date(Date.now() - 6 * 3600_000); // fecha de Costa Rica
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

async function borrarEventoCalendar(accessToken, eventId) {
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } }
  );
  // 404/410: el evento ya no existe, que es justo lo que se quería.
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`calendar_delete_${r.status}`);
}

export async function aplicarRetencion() {
  const limite = haceDosAnios();
  const out = { citas: 0, eventos: 0, auditoria: 0, errores: 0 };

  const { data: viejas, error } = await supabase
    .from('citas')
    .select('id, google_event_id')
    .lt('fecha', limite)
    .limit(LOTE);
  if (error) throw new Error('retencion_select: ' + error.message);

  if (viejas.length) {
    const conEvento = viejas.filter(c => c.google_event_id);
    const borrables = new Set(viejas.filter(c => !c.google_event_id).map(c => c.id));
    if (conEvento.length) {
      const token = await getAccessToken();
      for (const c of conEvento) {
        try {
          await borrarEventoCalendar(token, c.google_event_id);
          out.eventos++;
          borrables.add(c.id);
        } catch (err) {
          // Si el evento no se pudo borrar, la cita se conserva para
          // reintentarlo mañana: no se pierde la referencia al evento.
          console.error('retencion_evento', c.id, err?.message);
          out.errores++;
        }
      }
    }
    if (borrables.size) {
      const { error: delErr, count } = await supabase
        .from('citas').delete({ count: 'exact' }).in('id', [...borrables]);
      if (delErr) throw new Error('retencion_delete: ' + delErr.message);
      out.citas = count ?? borrables.size;
    }
  }

  const { error: audErr, count: aud } = await supabase
    .from('audit_log').delete({ count: 'exact' }).lt('created_at', `${limite}T00:00:00-06:00`);
  if (audErr) console.error('retencion_audit', audErr.message);
  else out.auditoria = aud ?? 0;

  // Limpieza de tablas técnicas que nunca se vaciaban.
  await supabase.rpc('cleanup_rate_limits');
  await supabase.rpc('cleanup_rate_limits_subject');
  await supabase.from('mobile_challenges_used').delete().lt('expires_at', new Date().toISOString());

  return out;
}
