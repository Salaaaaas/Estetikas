import { getRecentlyChangedEvents } from './_lib/calendar.mjs';
import { supabase } from './_lib/supabase.mjs';
import { audit } from './_lib/security.mjs';

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  // Verify optional token in X-Goog-Channel-Token header (set during watch registration)
  const channelToken = req.headers['x-goog-channel-token'];
  const expectedToken = process.env.CALENDAR_WEBHOOK_TOKEN;
  if (expectedToken && channelToken !== expectedToken) {
    return send(res, 403, { error: 'invalid_token' });
  }

  // Google sends a 'sync' state when the watch is first registered — acknowledge it
  const resourceState = req.headers['x-goog-resource-state'];
  if (resourceState === 'sync') {
    return send(res, 200, { ok: true });
  }

  try {
    // Fetch events changed in the last 2 hours with deleted ones included
    const events = await getRecentlyChangedEvents(120);
    const cancelled = events.filter(e => e.status === 'cancelled');

    let count = 0;
    for (const event of cancelled) {
      const { data: updated, error } = await supabase
        .from('citas')
        .update({ estado: 'cancelada' })
        .eq('google_event_id', event.id)
        .neq('estado', 'cancelada')
        .select('id');

      if (!error && updated?.length) {
        count += updated.length;
        await audit({
          actor:      'system',
          action:     'cancel_from_calendar',
          resourceId: updated[0].id,
          metadata:   { google_event_id: event.id },
          ip:         null,
        });
      }
    }

    console.log('calendar_webhook_sync', { cancelled: cancelled.length, updated: count });
    return send(res, 200, { ok: true, cancelled: count });
  } catch (err) {
    console.error('calendar_webhook_error', err?.message);
    return send(res, 500, { error: 'error_interno' });
  }
}
