import { supabase } from './_lib/supabase.mjs';
import { getAgendaFromCalendar } from './_lib/calendar.mjs';
import { horasOfrecidas } from './_lib/horarios.mjs';
import { ocupadosDeCitas, turnoOcupado } from './_lib/agenda.mjs';
import { ciudadDeSede } from './_lib/profesionales.mjs';

// Turnos ya ocupados, por día o por mes: { booked: ["HH:MM"] } o
// { "YYYY-MM-DD": ["HH:MM"] }.
//
// Un turno está ocupado si su hora (60 min) se cruza con una cita de la BD o
// con cualquier evento del Calendar que no sea un bloque de disponibilidad:
// citas, eventos personales de Katherine, días completos. Las reglas de qué
// cuenta como ocupado viven en _lib/agenda.mjs.
//
// Se evalúan todos los turnos que el formulario puede ofrecer ese día
// (horarios fijos + bloques del Calendar, para cualquier tratamiento), más la
// hora exacta de cada cita de la BD por compatibilidad.
//
// El parámetro `sede` es opcional y retrocompatible: sin él cuenta lo ocupado
// en cualquier sede (lo que usa el sitio web). Con él, solo lo de esa CIUDAD
// (los dos locales de Guápiles comparten profesional), igual que el índice
// citas_slot_ciudad_unico_idx; lo usa la app. Un evento del Calendar sin sede
// identificable bloquea todas las ciudades.

const SEDES_VALIDAS = new Set([
  'Bataan (Clínica ODONTOBATAAN)',
  'Guápiles (Clínica Medical Numancia)',
  'Guápiles (Eco Clinic)',
]);

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

/** Turnos ocupados de un día. */
function horasOcupadas(fecha, citasDia, bloques, ocupadosCal, sede) {
  const ciudad = sede ? ciudadDeSede(sede) : null;
  const citas = citasDia.filter((c) => !ciudad || ciudadDeSede(c.sede) === ciudad);
  const ocupados = [...ocupadosDeCitas(citas), ...ocupadosCal];

  const candidatas = horasOfrecidas(fecha, sede, [], bloques);
  for (const c of citas) candidatas.add(c.hora);

  return [...candidatas].filter((hora) => turnoOcupado(fecha, hora, sede, ocupados)).sort();
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
      supabase.from('citas').select('fecha, hora, sede').eq('fecha', date).neq('estado', 'cancelada'),
      getAgendaFromCalendar(`${date}T00:00:00-06:00`, `${date}T23:59:59-06:00`),
    ]);

    if (dbResult.status === 'rejected') return send(res, 500, { error: 'error_interno' });
    if (dbResult.value.error)           return send(res, 500, { error: 'error_interno' });

    // Si Google falla se responde solo con la BD: create-booking revalida
    // contra el Calendar y rechaza la reserva si no puede consultarlo.
    const { bloques, ocupados } = calResult.status === 'fulfilled'
      ? calResult.value : { bloques: [], ocupados: [] };

    return send(res, 200, { booked: horasOcupadas(date, dbResult.value.data, bloques, ocupados, sede) });
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
      getAgendaFromCalendar(`${startDate}T00:00:00-06:00`, `${endDate}T23:59:59-06:00`),
    ]);

    if (dbResult.status === 'rejected') return send(res, 500, { error: 'error_interno' });
    if (dbResult.value.error)           return send(res, 500, { error: 'error_interno' });

    const dbByDate = {};
    for (const row of dbResult.value.data) {
      (dbByDate[row.fecha] ??= []).push(row);
    }
    const { bloques, ocupados } = calResult.status === 'fulfilled'
      ? calResult.value : { bloques: [], ocupados: [] };

    const out = {};
    for (let d = 1; d <= lastDay; d++) {
      const fecha = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const horas = horasOcupadas(fecha, dbByDate[fecha] ?? [], bloques, ocupados, sede);
      if (horas.length > 0) out[fecha] = horas;
    }

    return send(res, 200, out);
  }

  return send(res, 400, { error: 'parametros_requeridos' });
}
