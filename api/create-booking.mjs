import { supabase } from './_lib/supabase.mjs';
import { encryptPII, hashPhone } from './_lib/crypto.mjs';
import { validateBookingInput, safeUserAgent } from './_lib/validate.mjs';
import { checkRateLimit, checkSubjectRateLimit, verifyTurnstile, audit, isOriginAllowed } from './_lib/security.mjs';
import { requireMobileSession } from './_lib/mobile-auth.mjs';
import { createCalendarEvent, getScheduleFromCalendar } from './_lib/calendar.mjs';
import { conflictoDeSede, mensajeConflicto } from './_lib/profesionales.mjs';

const LIMPIEZA_SLUG = 'limpieza-facial';

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

  const ip = getClientIp(req);
  const ua = safeUserAgent(getHeader(req, 'user-agent'));

  // ------------------------------------------------------------------
  // Dos puertas de entrada, una sola lógica de negocio debajo.
  //
  // Web: se comprueba el header Origin (anti-CSRF, tiene sentido porque el
  // navegador lo pone y no se puede falsear desde otra página) y Turnstile.
  //
  // App: fetch desde React Native NO envía Origin, así que la comprobación de
  // Origin rechazaría toda reserva de la app; y Turnstile es un widget de
  // navegador que ahí no puede correr. En su lugar la app presenta el token de
  // sesión que obtuvo tras atestar el dispositivo con App Attest o Play
  // Integrity — una garantía más fuerte que un header que cualquiera puede
  // poner con curl.
  // ------------------------------------------------------------------
  const authorization = getHeader(req, 'authorization');
  const isMobile = !!authorization;

  let device = null;

  if (isMobile) {
    const session = await requireMobileSession(authorization);
    if (!session.ok) {
      await audit({ actor: 'mobile', action: 'session_rejected', metadata: { reason: session.reason }, ip });
      return send(res, 401, { error: 'sesion_invalida', mensaje: 'Volvé a abrir la app para reintentar.' });
    }
    device = session;

    // Límite por dispositivo: en móvil miles de abonados comparten la IP del
    // NAT de la operadora, así que limitar por IP castiga a clientas legítimas.
    const rl = await checkSubjectRateLimit(device.deviceId, 'create-booking', {
      maxPerWindow: 5,
      windowMinutes: 10,
    });
    if (!rl.ok) {
      await audit({ actor: 'mobile', action: 'rate_limited', metadata: { reason: rl.reason }, ip });
      return send(res, 429, { error: 'demasiados_intentos', mensaje: 'Por favor espera unos minutos.' });
    }

    // Techo global por IP, mucho más holgado: no bloquea a una clienta detrás
    // de un NAT compartido, pero sí a quien intente inundar desde un servidor.
    const ipCeiling = await checkRateLimit(ip, 'create-booking-mobile-ip', {
      maxPerWindow: 60,
      windowMinutes: 10,
    });
    if (!ipCeiling.ok) {
      await audit({ actor: 'mobile', action: 'rate_limited_ip', metadata: { reason: ipCeiling.reason }, ip });
      return send(res, 429, { error: 'demasiados_intentos', mensaje: 'Por favor espera unos minutos.' });
    }
  } else {
    const origin = getHeader(req, 'origin');
    if (!isOriginAllowed(origin)) return send(res, 403, { error: 'origin_not_allowed' });

    const rl = await checkRateLimit(ip, 'create-booking', { maxPerWindow: 5, windowMinutes: 10 });
    if (!rl.ok) {
      await audit({ actor: 'public', action: 'rate_limited', metadata: { reason: rl.reason }, ip });
      return send(res, 429, { error: 'demasiados_intentos', mensaje: 'Por favor espera unos minutos.' });
    }
  }

  const actor = isMobile ? 'mobile' : 'public';

  let payload;
  try {
    const text = await readBody(req);
    if (text.length > 8_000) return send(res, 413, { error: 'payload_demasiado_grande' });
    payload = JSON.parse(text);
  } catch {
    return send(res, 400, { error: 'json_invalido' });
  }

  const v = validateBookingInput(payload, { requireTurnstile: !isMobile });
  if (!v.ok) return send(res, 400, { error: 'validacion_fallida', detalles: v.errors });

  // ------------------------------------------------------------------
  // Reglas de sede. El modelo anterior anclaba TODO el día a una sola
  // sede; ahora Katherine (limpiezas, Bataan) y la Dra. Karen (medicina
  // estética, Guápiles) pueden atender en paralelo el mismo día.
  // ------------------------------------------------------------------
  const slugs       = v.data.servicios.map(s => s.slug);
  const otros       = slugs.filter(s => s !== LIMPIEZA_SLUG);

  // Regla 1: cada profesional atiende en una sola ciudad por día; dentro de
  // Guápiles la Dra. Karen puede cambiar de local con 2 horas de margen
  // (reglas en _lib/profesionales.mjs). El trigger citas_profesional_sede en
  // la BD respalda esta verificación contra carreras.
  const { data: delDia, error: errDia } = await supabase
    .from('citas')
    .select('sede, hora, servicios')
    .eq('fecha', v.data.fecha)
    .neq('estado', 'cancelada');
  if (errDia) {
    console.error('select_dia_error', JSON.stringify(errDia));
    return send(res, 500, { error: 'error_interno' });
  }
  const conflicto = conflictoDeSede(
    { sede: v.data.sede, hora: v.data.hora, slugs },
    delDia.map(c => ({ sede: c.sede, hora: c.hora, slugs: c.servicios.map(s => s.slug) }))
  );
  if (conflicto) {
    return send(res, 400, { error: 'sede_no_disponible', mensaje: mensajeConflicto(conflicto) });
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

  // La app ya demostró su legitimidad al atestar el dispositivo; Turnstile
  // solo aplica a la ruta web.
  const skipTurnstile =
    isMobile || (v.data.turnstile_token === 'BYPASS_DEV' && process.env.TURNSTILE_BYPASS === '1');
  if (!skipTurnstile) {
    const ts = await verifyTurnstile(v.data.turnstile_token, ip);
    if (!ts.ok) {
      await audit({ actor: 'public', action: 'turnstile_failed', metadata: { reason: ts.reason }, ip });
      return send(res, 403, { error: 'verificacion_humana_fallida' });
    }
  }

  let telefonoEnc, emailEnc, telefonoHash;
  try {
    telefonoEnc = encryptPII(v.data.telefono);
    emailEnc    = v.data.email ? encryptPII(v.data.email) : null;
    // Índice determinista para poder listar las citas de una clienta sin
    // descifrar toda la tabla. Ver hashPhone en _lib/crypto.mjs.
    telefonoHash = hashPhone(v.data.telefono_e164);
  } catch (err) {
    console.error('encrypt_error', err);
    return send(res, 500, { error: 'error_interno' });
  }

  const { data, error } = await supabase
    .from('citas')
    .insert({
      nombre:                     v.data.nombre,
      telefono_enc:               telefonoEnc,
      telefono_hash:              telefonoHash,
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
    await audit({ actor, action: 'create_cita_failed', metadata: { code: error.code }, ip });
    // 23505 = unique_violation → el índice citas_slot_ciudad_unico_idx bloqueó
    // una doble reserva a la misma hora en la misma ciudad (los dos locales de
    // Guápiles comparten profesional).
    if (error.code === '23505') {
      return send(res, 409, {
        error: 'slot_no_disponible',
        mensaje: 'Ese horario acaba de ser reservado. Por favor elige otra hora.'
      });
    }
    // Trigger citas_profesional_sede: otra reserva de la misma profesional
    // en otra sede entró entre nuestra verificación y el insert.
    if (/(profesional|limpieza)_sede_conflict/.test(String(error.message || ''))) {
      return send(res, 409, {
        error: 'sede_no_disponible',
        mensaje: 'Ese horario acaba de quedar ocupado en otra sede. Por favor elige otra hora o fecha.'
      });
    }
    return send(res, 500, { error: 'no_se_pudo_guardar_la_cita' });
  }

  await audit({
    actor,
    action:     'create_cita',
    resourceId: data.id,
    metadata:   {
      sede:      v.data.sede,
      fecha:     v.data.fecha,
      servicios: v.data.servicios.map(s => s.slug),
      ...(device ? { device_id: device.deviceId, platform: device.platform } : {})
    },
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
