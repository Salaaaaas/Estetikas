import { supabase } from './_lib/supabase.mjs';
import { getBookedFromCalendar } from './_lib/calendar.mjs';

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

function mergeGrouped(a, b) {
  const result = { ...a };
  for (const [date, hours] of Object.entries(b)) {
    const existing = new Set(result[date] ?? []);
    for (const h of hours) existing.add(h);
    result[date] = [...existing];
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });

  const url   = new URL(req.url, 'https://placeholder.local');
  const date  = url.searchParams.get('date');
  const year  = url.searchParams.get('year');
  const month = url.searchParams.get('month');

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'fecha_invalida' });

    const [dbResult, calResult] = await Promise.allSettled([
      supabase.from('citas').select('hora').eq('fecha', date).neq('estado', 'cancelada'),
      getBookedFromCalendar(`${date}T00:00:00-06:00`, `${date}T23:59:59-06:00`),
    ]);

    if (dbResult.status === 'rejected') return send(res, 500, { error: 'error_interno' });
    if (dbResult.value.error)           return send(res, 500, { error: 'error_interno' });

    const dbBooked  = dbResult.value.data.map(r => r.hora);
    const calBooked = calResult.status === 'fulfilled' ? (calResult.value[date] ?? []) : [];
    const booked    = [...new Set([...dbBooked, ...calBooked])];

    return send(res, 200, { booked });
  }

  if (year && month) {
    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) {
      return send(res, 400, { error: 'parametros_invalidos' });
    }
    const y = parseInt(year);
    const m = parseInt(month);
    const lastDay   = new Date(y, m, 0).getDate();
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate   = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const [dbResult, calResult] = await Promise.allSettled([
      supabase.from('citas').select('fecha, hora').gte('fecha', startDate).lte('fecha', endDate).neq('estado', 'cancelada'),
      getBookedFromCalendar(`${startDate}T00:00:00-06:00`, `${endDate}T23:59:59-06:00`),
    ]);

    if (dbResult.status === 'rejected') return send(res, 500, { error: 'error_interno' });
    if (dbResult.value.error)           return send(res, 500, { error: 'error_interno' });

    const dbGrouped = {};
    for (const row of dbResult.value.data) {
      if (!dbGrouped[row.fecha]) dbGrouped[row.fecha] = [];
      dbGrouped[row.fecha].push(row.hora);
    }

    const calGrouped = calResult.status === 'fulfilled' ? calResult.value : {};
    return send(res, 200, mergeGrouped(dbGrouped, calGrouped));
  }

  return send(res, 400, { error: 'parametros_requeridos' });
}
