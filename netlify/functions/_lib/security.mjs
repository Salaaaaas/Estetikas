import { supabase } from './supabase.mjs';

// ---------------------------------------------------------------------
// Rate limit por IP+endpoint usando la función SQL bump_rate_limit
// ---------------------------------------------------------------------
export async function checkRateLimit(ip, endpoint, { maxPerWindow = 5, windowMinutes = 10 } = {}) {
  if (!ip) return { ok: false, reason: 'no_ip' };

  const { data, error } = await supabase.rpc('bump_rate_limit', {
    p_ip: ip,
    p_endpoint: endpoint,
    p_window_minutes: windowMinutes
  });

  if (error) {
    // Fail-closed: si la BD falla, no permitir
    console.error('rate_limit_error', error);
    return { ok: false, reason: 'rate_limit_db_error' };
  }

  if (data > maxPerWindow) {
    return { ok: false, reason: 'rate_limit_exceeded', count: data };
  }

  return { ok: true, count: data };
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
  const nf  = h('x-nf-client-connection-ip');
  const xff = h('x-forwarded-for');
  if (nf) return nf.trim();
  if (xff) return xff.split(',')[0].trim();
  return null;
}

// ---------------------------------------------------------------------
// Origin allowlist (anti-CSRF para endpoints públicos)
// ---------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'https://estetikas.netlify.app',
  'http://localhost:4321',
  'http://localhost:8888'
]);

export function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}
