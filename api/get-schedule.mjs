import { getScheduleFromCalendar } from './_lib/calendar.mjs';

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=1800, s-maxage=1800');
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });

  const now    = new Date();
  const future = new Date(now);
  future.setDate(now.getDate() + 90);

  try {
    const schedule = await getScheduleFromCalendar(now.toISOString(), future.toISOString());
    return send(res, 200, { schedule });
  } catch (err) {
    console.error('get_schedule_error', err?.message);
    return send(res, 500, { error: 'error_interno' });
  }
}
