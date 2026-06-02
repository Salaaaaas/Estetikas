import { supabase } from './_lib/supabase.mjs';
import { encryptPII } from './_lib/crypto.mjs';
import { validateBookingInput, safeUserAgent } from './_lib/validate.mjs';
import { checkRateLimit, verifyTurnstile, audit } from './_lib/security.mjs';

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
    'https://estetikas.netlify.app',
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

  const rl = await checkRateLimit(ip, 'create-booking', { maxPerWindow: 20, windowMinutes: 10 });
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
    return send(res, 500, { error: 'no_se_pudo_guardar_la_cita' });
  }

  await audit({
    actor:      'public',
    action:     'create_cita',
    resourceId: data.id,
    metadata:   { sede: v.data.sede, fecha: v.data.fecha, servicios: v.data.servicios.map(s => s.slug) },
    ip
  });

  return send(res, 201, {
    ok: true,
    cita: { id: data.id, fecha: data.fecha, hora: data.hora, estado: data.estado }
  });
}
