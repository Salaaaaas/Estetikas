import { supabase } from './_lib/supabase.mjs';

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });

  const url   = new URL(req.url, 'https://placeholder.local');
  const date  = url.searchParams.get('date');
  const year  = url.searchParams.get('year');
  const month = url.searchParams.get('month');

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'fecha_invalida' });

    const { data, error } = await supabase
      .from('citas')
      .select('hora')
      .eq('fecha', date)
      .neq('estado', 'cancelada');

    if (error) return send(res, 500, { error: 'error_interno' });
    return send(res, 200, { booked: data.map(r => r.hora) });
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

    const { data, error } = await supabase
      .from('citas')
      .select('fecha, hora')
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .neq('estado', 'cancelada');

    if (error) return send(res, 500, { error: 'error_interno' });

    const grouped = {};
    for (const row of data) {
      if (!grouped[row.fecha]) grouped[row.fecha] = [];
      grouped[row.fecha].push(row.hora);
    }
    return send(res, 200, grouped);
  }

  return send(res, 400, { error: 'parametros_requeridos' });
}
