import { supabase } from './_lib/supabase.mjs';

// Devuelve la sede donde quedaron ancladas las LIMPIEZAS FACIALES de una
// fecha, o null si aún no hay ninguna. Katherine realiza las limpiezas y no
// puede estar en dos localidades el mismo día: la primera reserva con
// limpieza facial fija la sede de limpiezas de ese día. El resto de
// tratamientos (Dra. Karen) no se ven afectados por este candado.

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });

  const url  = new URL(req.url, 'https://placeholder.local');
  const date = url.searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return send(res, 400, { error: 'fecha_invalida' });
  }

  const { data, error } = await supabase
    .from('citas')
    .select('sede')
    .eq('fecha', date)
    .neq('estado', 'cancelada')
    .contains('servicios', JSON.stringify([{ slug: 'limpieza-facial' }]))
    .limit(1);

  if (error) return send(res, 500, { error: 'error_interno' });

  return send(res, 200, { sede: data?.[0]?.sede ?? null });
}
