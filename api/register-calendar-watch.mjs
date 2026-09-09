// Renueva el canal de notificaciones push de Google Calendar.
//
// Los canales caducan —una semana como mucho— y hasta ahora nada los renovaba:
// se registraba uno a mano y días después el sitio dejaba de enterarse de las
// cancelaciones hechas en el calendario, en silencio. Ahora lo llama un cron
// diario (ver vercel.json).
//
// Además de renovar, repasa una ventana de 26 horas de cambios. Ese repaso es
// la red de seguridad: la entrega de un push no está garantizada, así que si
// una notificación se pierde, el cron del día siguiente igual aplica la
// cancelación. Sin él, una notificación perdida deja esa hora bloqueada para
// siempre.

import { getAccessToken } from './_lib/calendar.mjs';
import { syncCancellations } from './_lib/calendar-sync.mjs';
import { supabase } from './_lib/supabase.mjs';

// 26 horas: la ventana del cron diario, con dos horas de solape para que un
// retraso en la ejecución no abra un hueco.
const VENTANA_REPASO_MIN = 26 * 60;

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

/** Cierra el canal anterior para que no siga notificando en paralelo. */
async function stopChannel(accessToken, { channel_id, resource_id }) {
  const r = await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id: channel_id, resourceId: resource_id }),
  });
  // 404 = ya había caducado por su cuenta. No es un fallo.
  if (!r.ok && r.status !== 404) {
    console.error('stop_channel_error', { status: r.status, body: await r.text() });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  // GET es lo que manda Vercel Cron; POST queda para dispararlo a mano.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return send(res, 405, { error: 'method_not_allowed' });
  }

  // Se acepta CRON_SECRET (el cron) o CALENDAR_WEBHOOK_TOKEN (a mano). Ambos
  // tienen que estar configurados para valer: sin secreto no hay comparación
  // que hacer y el endpoint quedaría abierto.
  const authHeader = req.headers['authorization'];
  const aceptados = [process.env.CRON_SECRET, process.env.CALENDAR_WEBHOOK_TOKEN]
    .filter(Boolean)
    .map((s) => `Bearer ${s}`);
  if (aceptados.length === 0) return send(res, 500, { error: 'secretos_no_configurados' });
  if (!aceptados.includes(authHeader)) return send(res, 401, { error: 'unauthorized' });

  const webhookToken = process.env.CALENDAR_WEBHOOK_TOKEN;
  if (!webhookToken) {
    // Sin este token el receptor rechaza todo, así que registrar un canal que
    // apunta a él no serviría de nada.
    return send(res, 500, { error: 'falta_calendar_webhook_token' });
  }

  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.WEBHOOK_BASE_URL;
  if (!base) return send(res, 500, { error: 'falta_webhook_base_url' });

  const webhookUrl = `${base}/api/calendar-webhook`;
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);

  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error('register_watch_token_error', err?.message);
    return send(res, 500, { error: 'google_auth_fallo' });
  }

  // 1. Repaso primero. Si el registro del canal falla, al menos las
  //    cancelaciones del último día ya quedaron aplicadas.
  let repaso = null;
  try {
    repaso = await syncCancellations(VENTANA_REPASO_MIN, 'cron');
  } catch (err) {
    console.error('register_watch_sync_error', err?.message);
  }

  // 2. Cerrar el canal vigente, si lo hay.
  const { data: anterior } = await supabase
    .from('calendar_watch')
    .select('channel_id, resource_id')
    .eq('id', 'current')
    .maybeSingle();

  if (anterior) await stopChannel(accessToken, anterior);

  // 3. Registrar el nuevo.
  const channelId = `estetikas-watch-${Date.now()}`;
  let data;
  try {
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/watch`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: webhookToken,
        }),
      }
    );
    data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
  } catch (err) {
    // El error más habitual aquí es que el dominio del webhook no esté
    // verificado en Google Cloud. Se propaga tal cual: es lo único que
    // permite distinguirlo desde los logs.
    console.error('register_watch_error', err?.message);
    return send(res, 500, { error: 'no_se_pudo_registrar_el_canal', detail: err?.message, repaso });
  }

  const expiration = data.expiration ? new Date(Number(data.expiration)).toISOString() : null;

  const { error: upErr } = await supabase.from('calendar_watch').upsert(
    {
      id: 'current',
      channel_id: channelId,
      resource_id: data.resourceId,
      webhook_url: webhookUrl,
      expiration,
      renewed_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (upErr) console.error('calendar_watch_upsert_error', upErr.message);

  console.log('calendar_watch_registered', { channelId, expiration, webhookUrl });
  return send(res, 200, { ok: true, channelId, expiration, webhookUrl, repaso });
}
