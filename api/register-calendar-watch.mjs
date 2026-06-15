import { getAccessToken } from './_lib/calendar.mjs';

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return send(res, 401, { error: 'unauthorized' });
  }

  try {
    const accessToken = await getAccessToken();
    const calendarId  = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
    const webhookUrl  = `${process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.WEBHOOK_BASE_URL}/api/calendar-webhook`;

    const channelId = `estetikas-watch-${Date.now()}`;

    const body = {
      id:      channelId,
      type:    'web_hook',
      address: webhookUrl,
      token:   process.env.CALENDAR_WEBHOOK_TOKEN ?? '',
    };

    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/watch`,
      {
        method:  'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body:    JSON.stringify(body),
      }
    );

    const data = await r.json();
    if (!r.ok) throw new Error('watch_error: ' + JSON.stringify(data));

    console.log('calendar_watch_registered', { channelId, expiration: data.expiration, webhookUrl });
    return send(res, 200, { ok: true, channelId, expiration: data.expiration });
  } catch (err) {
    console.error('register_watch_error', err?.message);
    return send(res, 500, { error: 'error_interno', detail: err?.message });
  }
}
