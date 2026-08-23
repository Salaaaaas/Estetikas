import { supabase } from './_lib/supabase.mjs';
import { encryptPII } from './_lib/crypto.mjs';
import { validateBookingInput, safeUserAgent } from './_lib/validate.mjs';
import { checkRateLimit, verifyTurnstile, audit } from './_lib/security.mjs';
import { createCalendarEvent, getScheduleFromCalendar } from './_lib/calendar.mjs';

const LIMPIEZA_SLUG = 'limpieza-facial';

function sedeCorta(sede) {
  return sede.includes('Bataan') ? 'Bataan' : 'Guápiles';
}

function getHeader(req, name) {
  return req.headers[name.toLowerCase()] ?? null;
}

function getClientIp(req) {
  const nf  = getHeader(req, 'x-nf-client-connection-ip');
  const real = getHeader(req, 'x-real-ip');
  const xff = getHeader(req, 'x-forwarded-for');
  if (nf)    return String(nf).trim();
  if (real)  return String(real).trim();
  if (xff)   return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress ?? null;
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (String(origin).endsWith('.vercel.app')) return true;
  const allowed = new Set([
    'https://estetikas.vercel.app',
    'http://localhost:4321',
    'http://localhost:3000',
    'http://localhost:8888'
  ]);
  return allowed.has(origin);
}

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const origin = getHeader(req, 'origin');
  if (!isOriginAllowed(origin)) return send(res, 403, { error: 'origin_not_allowed' });

  const ip = getClientIp(req);
  const ua = safeUserAgent(getHeader(req, 'user-agent'));

  const rl = await checkRateLimit(ip, 'create-booking', { maxPerWindow: 5, windowMinutes: 10 });
  if (!rl.ok) {
    await audit({ actor: 'public', action: 'rate_limited', metadata: { reason: rl.reason }, ip });
    return send(res, 429, { error: 'demasiados_intentos', mensaje: 'Por favor espera unos minutos.' });
  }

  let payload;
  try {
    const text = await readBody(req);
    if (text.length > 8_000) return send(res, 413, { error: 'payload_demasiado_grande' });
    payload = JSON.parse(text);
  } catch {
    return send(res, 400, { error: 'json_invalido' });
  }

  const v = validateBookingInput(payload);
  if (!v.ok) return send(res, 400, { error: 'validacion_fallida', detalles: v.errors });

  // ------------------------------------------------------------------
  // Reglas de sede. El modelo anterior anclaba TODO el día a una sola
  // sede; ahora Katherine (limpiezas, Bataan) y la Dra. Karen (medicina
  // estética, Guápiles) pueden atender en paralelo el mismo día.
  // ------------------------------------------------------------------
  const slugs       = v.data.servicios.map(s => s.slug);
  const hasLimpieza = slugs.includes(LIMPIEZA_SLUG);
  const otros       = slugs.filter(s => s !== LIMPIEZA_SLUG);

  // Regla 1: las limpiezas faciales solo se atienden en UNA sede por día
  // (Katherine no puede estar en dos localidades). La primera reserva con
  // limpieza fija la sede de limpiezas de esa fecha. El trigger
  // citas_limpieza_sede en la BD respalda esta verificación contra carreras.
  if (hasLimpieza) {
    const { data: lim } = await supabase
      .from('citas')
      .select('sede')
      .eq('fecha', v.data.fecha)
      .neq('estado', 'cancelada')
      .contains('servicios', JSON.stringify([{ slug: LIMPIEZA_SLUG }]))
      .limit(1);
    if (lim?.length && lim[0].sede !== v.data.sede) {
      return send(res, 400, {
        error:   'sede_no_disponible',
        mensaje: `Este día las limpiezas faciales se atienden en ${sedeCorta(lim[0].sede)}.`
      });
    }
  }

  // Regla 2: en Bataan solo se realizan limpiezas faciales, salvo los días
  // habilitados en que la Dra. Karen viaja a Bataan. Esos días se habilitan
  // creando en Google Calendar un bloque con location "Bataan" (get-schedule
  // ya los publica al frontend); aquí se revalida server-side.
  if (otros.length > 0 && v.data.sede.includes('Bataan')) {
    let draEnBatan = false;
    try {
      const schedule = await getScheduleFromCalendar(
        `${v.data.fecha}T00:00:00-06:00`,
        `${v.data.fecha}T23:59:59-06:00`
      );
      draEnBatan = schedule.some(s =>
        s.date === v.data.fecha &&
        s.sede.includes('Bataan') &&
        (s.forIds.includes('*') || otros.every(id => s.forIds.includes(id)))
      );
    } catch (err) {
      // Fail-closed: sin calendario no podemos confirmar el día especial.
      console.error('schedule_check_error', err?.message);
    }
    if (!draEnBatan) {
      return send(res, 400, {
        error:   'sede_no_disponible',
        mensaje: 'En Bataan únicamente se realizan limpiezas faciales. Los demás tratamientos se atienden en Guápiles, o en Bataan solo en fechas especiales con la Dra.'
      });
    }
  }

  const skipTurnstile = v.data.turnstile_token === 'BYPASS_DEV' && process.env.TURNSTILE_BYPASS === '1';
  if (!skipTurnstile) {
    const ts = await verifyTurnstile(v.data.turnstile_token, ip);
    if (!ts.ok) {
      await audit({ actor: 'public', action: 'turnstile_failed', metadata: { reason: ts.reason }, ip });
      return send(res, 403, { error: 'verificacion_humana_fallida' });
    }
  }

  let telefonoEnc, emailEnc;
  try {
    telefonoEnc = encryptPII(v.data.telefono);
    emailEnc    = v.data.email ? encryptPII(v.data.email) : null;
  } catch (err) {
    console.error('encrypt_error', err);
    return send(res, 500, { error: 'error_interno' });
  }

  const { data, error } = await supabase
    .from('citas')
    .insert({
      nombre:                     v.data.nombre,
      telefono_enc:               telefonoEnc,
      email_enc:                  emailEnc,
      servicios:                  v.data.servicios,
      sede:                       v.data.sede,
      fecha:                      v.data.fecha,
      hora:                       v.data.hora,
      notas:                      v.data.notas,
      consentimiento_habeas_data: true,
      consentimiento_at:          new Date().toISOString(),
      ip_origen:                  ip,
      user_agent:                 ua
    })
    .select('id, fecha, hora, estado')
    .single();

  if (error) {
    console.error('insert_error', JSON.stringify(error));
    await audit({ actor: 'public', action: 'create_cita_failed', metadata: { code: error.code }, ip });
    // 23505 = unique_violation → el índice citas_slot_unico_idx bloqueó una
    // doble reserva en el mismo (fecha, hora).
    if (error.code === '23505') {
      return send(res, 409, {
        error: 'slot_no_disponible',
        mensaje: 'Ese horario acaba de ser reservado. Por favor elige otra hora.'
      });
    }
    // Trigger citas_limpieza_sede: otra limpieza ganó la sede de este día
    // entre nuestra verificación y el insert.
    if (String(error.message || '').includes('limpieza_sede_conflict')) {
      return send(res, 409, {
        error: 'sede_no_disponible',
        mensaje: 'Las limpiezas faciales de este día acaban de quedar asignadas a otra sede. Por favor elige otra fecha.'
      });
    }
    return send(res, 500, { error: 'no_se_pudo_guardar_la_cita' });
  }

  await audit({
    actor:      'public',
    action:     'create_cita',
    resourceId: data.id,
    metadata:   { sede: v.data.sede, fecha: v.data.fecha, servicios: v.data.servicios.map(s => s.slug) },
    ip
  });

  try {
    const calEventId = await createCalendarEvent({
      nombre:    v.data.nombre,
      telefono:  v.data.telefono,
      servicios: v.data.servicios,
      fecha:     v.data.fecha,
      hora:      v.data.hora,
      notas:     v.data.notas,
      sede:      v.data.sede,
    });
    if (calEventId) {
      await supabase.from('citas').update({ google_event_id: calEventId }).eq('id', data.id);
    }
  } catch (err) {
    console.error('calendar_error', JSON.stringify({ message: err?.message, stack: err?.stack }));
  }

  return send(res, 201, {
    ok: true,
    cita: { id: data.id, fecha: data.fecha, hora: data.hora, estado: data.estado }
  });
}
