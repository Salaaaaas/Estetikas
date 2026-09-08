import { supabase } from './supabase.mjs';

// ---------------------------------------------------------------------
// Rate limit por IP+endpoint usando la función SQL bump_rate_limit
// ---------------------------------------------------------------------
export async function checkRateLimit(ip, endpoint, { maxPerWindow = 5, windowMinutes = 10 } = {}) {
  // Sin IP: permitir pero loguear (no bloquear al usuario)
  if (!ip) {
    console.warn('rate_limit: no IP detected, skipping');
    return { ok: true, reason: 'no_ip' };
  }

  try {
    const { data, error } = await supabase.rpc('bump_rate_limit', {
      p_ip: ip,
      p_endpoint: endpoint,
      p_window_minutes: windowMinutes
    });

    if (error) {
      // Fail-open: si la BD falla, loguear pero no bloquear
      console.error('rate_limit_error', JSON.stringify(error));
      return { ok: true, reason: 'rate_limit_db_error' };
    }

    if (data > maxPerWindow) {
      return { ok: false, reason: 'rate_limit_exceeded', count: data };
    }

    return { ok: true, count: data };
  } catch (err) {
    console.error('rate_limit_exception', err.message);
    return { ok: true, reason: 'rate_limit_exception' };
  }
}

// ---------------------------------------------------------------------
// Rate limit por sujeto arbitrario (en la práctica: device_id de la app)
//
// El límite por IP funciona en web pero castiga al tráfico móvil: las
// operadoras celulares meten miles de abonados detrás de un mismo NAT, así que
// cinco intentos por IP y ventana pueden bloquear a una clienta legítima
// porque otra persona de la misma red reservó antes. La ruta móvil limita por
// dispositivo atestado, que es un sujeto mucho más preciso.
// ---------------------------------------------------------------------
export async function checkSubjectRateLimit(subject, endpoint, { maxPerWindow = 5, windowMinutes = 10 } = {}) {
  // A diferencia del límite por IP, aquí NO se falla abierto ante un sujeto
  // ausente: si no hay dispositivo, quien llama no debería haber llegado.
  if (!subject) return { ok: false, reason: 'sin_sujeto' };

  try {
    const { data, error } = await supabase.rpc('bump_rate_limit_subject', {
      p_subject: String(subject).slice(0, 200),
      p_endpoint: endpoint,
      p_window_minutes: windowMinutes
    });

    if (error) {
      // Fail-open igual que el límite por IP: una caída de la BD no debe
      // impedir reservar. El techo por IP sigue en pie por debajo.
      console.error('rate_limit_subject_error', JSON.stringify(error));
      return { ok: true, reason: 'rate_limit_db_error' };
    }

    if (data > maxPerWindow) {
      return { ok: false, reason: 'rate_limit_exceeded', count: data };
    }

    return { ok: true, count: data };
  } catch (err) {
    console.error('rate_limit_subject_exception', err.message);
    return { ok: true, reason: 'rate_limit_exception' };
  }
}

// ---------------------------------------------------------------------
// Verificación de Cloudflare Turnstile (CAPTCHA invisible)
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// ---------------------------------------------------------------------
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('Falta TURNSTILE_SECRET_KEY');
    return { ok: false, reason: 'turnstile_misconfigured' };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body
    });
    const json = await res.json();
    if (!json.success) {
      return { ok: false, reason: 'turnstile_failed', codes: json['error-codes'] };
    }
    return { ok: true };
  } catch (err) {
    console.error('turnstile_fetch_error', err);
    return { ok: false, reason: 'turnstile_network_error' };
  }
}

// ---------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------
export async function audit({ actor, action, resourceId = null, metadata = null, ip = null }) {
  const { error } = await supabase.from('audit_log').insert({
    actor, action, resource_id: resourceId, metadata, ip
  });
  if (error) console.error('audit_error', error);
}

// ---------------------------------------------------------------------
// Extracción segura de IP del cliente
// Netlify pone la IP real en x-nf-client-connection-ip
// ---------------------------------------------------------------------
export function getClientIp(headers) {
  const h = name => headers.get ? headers.get(name) : headers[name];
  // Vercel usa x-forwarded-for, Netlify usa x-nf-client-connection-ip
  const nf  = h('x-nf-client-connection-ip');
  const xff = h('x-forwarded-for');
  const real = h('x-real-ip');
  if (nf)   return nf.trim();
  if (real) return real.trim();
  if (xff)  return xff.split(',')[0].trim();
  return null;
}

// ---------------------------------------------------------------------
// Origin allowlist (anti-CSRF para endpoints públicos)
// ---------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'https://estetikas.vercel.app',
  'http://localhost:4321',
  'http://localhost:3000',
  'http://localhost:8888'
]);

export function isOriginAllowed(origin) {
  if (!origin) return false;
  // Permite cualquier subdominio de vercel.app para previews
  if (origin.endsWith('.vercel.app')) return true;
  return ALLOWED_ORIGINS.has(origin);
}
