import { supabase } from './_lib/supabase.mjs';
import { getBookedDetailedFromCalendar } from './_lib/calendar.mjs';

// Horas ya ocupadas, por día o por mes.
//
// El parámetro `sede` es opcional y retrocompatible: sin él, la respuesta es la
// unión de todas las sedes, exactamente igual que antes. Con él, solo cuentan
// las citas de esa ciudad. El sitio web no lo envía; la app sí.
//
// Existe porque el candado de slot pasó a ser por ciudad: Katherine en Bataan y
// la Dra. Karen en Guápiles ya pueden atender a la misma hora, así que una
// parrilla que no distinga sede mostraría horas ocupadas que en realidad están
// libres.
//
// La comparación es por CIUDAD, no por sede exacta, igual que el índice
// citas_slot_ciudad_unico_idx: los dos locales de Guápiles comparten
// profesional, así que una cita en Eco Clinic sí ocupa esa hora en Numancia.
//
// Las citas creadas a mano en Google Calendar no llevan sede identificable y
// bloquean la hora en TODAS las sedes: ante la duda, no se ofrece el hueco.

const SEDES_VALIDAS = new Set([
  'Bataan (Clínica ODONTOBATAAN)',
  'Guápiles (Clínica Medical Numancia)',
  'Guápiles (Eco Clinic)',
]);

/** Espejo de la función SQL public.sede_ciudad. */
export function ciudadDeSede(sede) {
  return sede?.startsWith('Bataan') ? 'Bataan' : 'Guápiles';
}

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

/** Horas ocupadas de un día, filtrando por la ciudad de la sede si se pidió. */
function horasOcupadas(dbRows, calEntries, sede) {
  const ciudad = sede ? ciudadDeSede(sede) : null;
  const horas = new Set();
  for (const row of dbRows) {
    if (!ciudad || ciudadDeSede(row.sede) === ciudad) horas.add(row.hora);
  }
  for (const entry of calEntries) {
    // sede null = evento creado a mano, sin sede legible → bloquea todas.
    if (!ciudad || entry.sede === null || ciudadDeSede(entry.sede) === ciudad) {
      horas.add(entry.hora);
    }
  }
  return [...horas];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });

  const url   = new URL(req.url, 'https://placeholder.local');
  const date  = url.searchParams.get('date');
  const year  = url.searchParams.get('year');
  const month = url.searchParams.get('month');
  const sede  = url.searchParams.get('sede');

  if (sede !== null && !SEDES_VALIDAS.has(sede)) {
    return send(res, 400, { error: 'sede_invalida' });
  }

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'fecha_invalida' });

    const [dbResult, calResult] = await Promise.allSettled([
      supabase.from('citas').select('hora, sede').eq('fecha', date).neq('estado', 'cancelada'),
      getBookedDetailedFromCalendar(`${date}T00:00:00-06:00`, `${date}T23:59:59-06:00`),
    ]);

    if (dbResult.status === 'rejected') return send(res, 500, { error: 'error_interno' });
    if (dbResult.value.error)           return send(res, 500, { error: 'error_interno' });

    const calEntries = calResult.status === 'fulfilled' ? (calResult.value[date] ?? []) : [];

    return send(res, 200, { booked: horasOcupadas(dbResult.value.data, calEntries, sede) });
  }

  if (year && month) {
    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) {
      return send(res, 400, { error: 'parametros_invalidos' });
    }
    const y = parseInt(year);
    const m = parseInt(month);
    if (m < 1 || m > 12) return send(res, 400, { error: 'parametros_invalidos' });

    const lastDay   = new Date(y, m, 0).getDate();
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate   = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const [dbResult, calResult] = await Promise.allSettled([
      supabase.from('citas').select('fecha, hora, sede').gte('fecha', startDate).lte('fecha', endDate).neq('estado', 'cancelada'),
      getBookedDetailedFromCalendar(`${startDate}T00:00:00-06:00`, `${endDate}T23:59:59-06:00`),
    ]);

    if (dbResult.status === 'rejected') return send(res, 500, { error: 'error_interno' });
    if (dbResult.value.error)           return send(res, 500, { error: 'error_interno' });

    const dbByDate = {};
    for (const row of dbResult.value.data) {
      (dbByDate[row.fecha] ??= []).push(row);
    }
    const calByDate = calResult.status === 'fulfilled' ? calResult.value : {};

    const out = {};
    for (const fecha of new Set([...Object.keys(dbByDate), ...Object.keys(calByDate)])) {
      const horas = horasOcupadas(dbByDate[fecha] ?? [], calByDate[fecha] ?? [], sede);
      if (horas.length > 0) out[fecha] = horas;
    }

    return send(res, 200, out);
  }

  return send(res, 400, { error: 'parametros_requeridos' });
}
