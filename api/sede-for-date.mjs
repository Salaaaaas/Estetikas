import { supabase } from './_lib/supabase.mjs';
import { profesionalesDe } from './_lib/profesionales.mjs';

// Ocupación por profesional de una fecha, para que el formulario ofrezca solo
// sedes y horas compatibles (reglas en _lib/profesionales.mjs):
//   citas: [{ sede, hora, profesionales }]   — sin datos personales
//   sede:  sede de las limpiezas faciales del día o null (compatibilidad con
//          clientes anteriores)

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
    .select('sede, hora, servicios')
    .eq('fecha', date)
    .neq('estado', 'cancelada');

  if (error) return send(res, 500, { error: 'error_interno' });

  const citas = (data ?? []).map((c) => {
    const slugs = c.servicios.map((s) => s.slug);
    return { sede: c.sede, hora: c.hora, slugs, profesionales: [...profesionalesDe(slugs)] };
  });
  const limpieza = citas.find((c) => c.slugs.includes('limpieza-facial'));

  return send(res, 200, {
    sede: limpieza?.sede ?? null,
    citas: citas.map(({ sede, hora, profesionales }) => ({ sede, hora, profesionales })),
  });
}
