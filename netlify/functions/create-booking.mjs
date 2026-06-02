import { supabase } from './_lib/supabase.mjs';
import { encryptPII } from './_lib/crypto.mjs';
import { validateBookingInput, safeUserAgent } from './_lib/validate.mjs';
import {
  checkRateLimit, verifyTurnstile, audit,
  getClientIp, isOriginAllowed
} from './_lib/security.mjs';

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

export default async (req) => {
  // -----------------------------------------------------------------
  // 1. Método y origen
  // -----------------------------------------------------------------
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const origin = req.headers.get('origin');
  if (!isOriginAllowed(origin)) {
    return json(403, { error: 'origin_not_allowed' });
  }

  const ip = getClientIp(req.headers);
  const ua = safeUserAgent(req.headers.get('user-agent'));

  // -----------------------------------------------------------------
  // 2. Rate limit (5 intentos por IP cada 10 minutos)
  // -----------------------------------------------------------------
  const rl = await checkRateLimit(ip, 'create-booking', { maxPerWindow: 20, windowMinutes: 10 });
  if (!rl.ok) {
    await audit({ actor: 'public', action: 'rate_limited', metadata: { endpoint: 'create-booking', reason: rl.reason }, ip });
    return json(429, { error: 'demasiados_intentos', mensaje: 'Por favor espera unos minutos antes de intentar de nuevo.' });
  }

  // -----------------------------------------------------------------
  // 3. Parseo + validación
  // -----------------------------------------------------------------
  let payload;
  try {
    const text = await req.text();
    if (text.length > 8_000) return json(413, { error: 'payload_demasiado_grande' });
    payload = JSON.parse(text);
  } catch {
    return json(400, { error: 'json_invalido' });
  }

  const v = validateBookingInput(payload);
  if (!v.ok) return json(400, { error: 'validacion_fallida', detalles: v.errors });

  // -----------------------------------------------------------------
  // 4. CAPTCHA Turnstile
  // -----------------------------------------------------------------
  const ts = await verifyTurnstile(v.data.turnstile_token, ip);
  if (!ts.ok) {
    await audit({ actor: 'public', action: 'turnstile_failed', metadata: { reason: ts.reason }, ip });
    return json(403, { error: 'verificacion_humana_fallida' });
  }

  // -----------------------------------------------------------------
  // 5. Cifrado de PII e inserción
  // -----------------------------------------------------------------
  let telefonoEnc, emailEnc;
  try {
    telefonoEnc = encryptPII(v.data.telefono);
    emailEnc    = v.data.email ? encryptPII(v.data.email) : null;
  } catch (err) {
    console.error('encrypt_error', err);
    return json(500, { error: 'error_interno' });
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
    console.error('insert_error', error);
    await audit({ actor: 'public', action: 'create_cita_failed', metadata: { code: error.code }, ip });
    return json(500, { error: 'no_se_pudo_guardar_la_cita' });
  }

  await audit({
    actor:      'public',
    action:     'create_cita',
    resourceId: data.id,
    metadata:   { sede: v.data.sede, fecha: v.data.fecha, servicios: v.data.servicios.map(s => s.slug) },
    ip
  });

  // -----------------------------------------------------------------
  // 6. Respuesta mínima (no devolvemos PII)
  // -----------------------------------------------------------------
  return json(201, {
    ok: true,
    cita: {
      id:     data.id,
      fecha:  data.fecha,
      hora:   data.hora,
      estado: data.estado
    }
  });
};
