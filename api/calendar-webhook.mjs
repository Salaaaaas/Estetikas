// Receptor de las notificaciones push de Google Calendar.
//
// Google avisa aquí cuando algo cambia en el calendario; la notificación no
// dice QUÉ cambió, solo que hubo cambios, así que se repasa la ventana
// reciente. El repaso vive en _lib/calendar-sync.mjs y lo comparte con el cron
// diario, que cubre las notificaciones que se pierdan.

import { syncCancellations } from './_lib/calendar-sync.mjs';

const VENTANA_MIN = 120;

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  // El token va en X-Goog-Channel-Token, puesto al registrar el canal.
  //
  // Falla CERRADO: si CALENDAR_WEBHOOK_TOKEN no está configurado, se rechaza
  // en vez de aceptar a cualquiera. Antes la comprobación se saltaba cuando la
  // variable faltaba, que es justo el caso en que el endpoint queda abierto.
  const expectedToken = process.env.CALENDAR_WEBHOOK_TOKEN;
  if (!expectedToken) {
    console.error('calendar_webhook_sin_token_configurado');
    return send(res, 500, { error: 'webhook_no_configurado' });
  }
  if (req.headers['x-goog-channel-token'] !== expectedToken) {
    return send(res, 403, { error: 'invalid_token' });
  }

  // Al registrar el canal, Google manda un 'sync' de cortesía: hay que
  // contestarlo 200 pero no significa que haya cambios.
  if (req.headers['x-goog-resource-state'] === 'sync') {
    return send(res, 200, { ok: true, sync: true });
  }

  try {
    const result = await syncCancellations(VENTANA_MIN, 'webhook');
    console.log('calendar_webhook_sync', result);
    return send(res, 200, { ok: true, ...result });
  } catch (err) {
    console.error('calendar_webhook_error', err?.message);
    return send(res, 500, { error: 'error_interno' });
  }
}
