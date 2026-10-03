import { isIP } from 'node:net';
import { createHash, timingSafeEqual } from 'node:crypto';
import { supabase } from './supabase.mjs';

// ---------------------------------------------------------------------
// Rate limit por IP+endpoint usando la función SQL bump_rate_limit
// ---------------------------------------------------------------------
export async function checkRateLimit(ip, endpoint, { maxPerWindow = 5, windowMinutes = 10 } = {}) {
  // Fail-closed: sin una IP válida o con la BD caída no se deja pasar. Antes
  // ambos casos dejaban pasar, y una cabecera con una "IP" inválida rompía el
  // cast a inet de bump_rate_limit y desactivaba el límite.
  if (!ip || !isIP(ip)) {
    console.warn('rate_limit: IP ausente o inválida');
    return { ok: false, reason: 'sin_ip' };
  }

  try {
    const { data, error } = await supabase.rpc('bump_rate_limit', {
      p_ip: ip,
      p_endpoint: endpoint,
      p_window_minutes: windowMinutes
    });

    if (error) {
      console.error('rate_limit_error', JSON.stringify(error));
      return { ok: false, reason: 'rate_limit_db_error' };
    }

    if (data > maxPerWindow) {
      return { ok: false, reason: 'rate_limit_exceeded', count: data };
    }

    return { ok: true, count: data };
  } catch (err) {
    console.error('rate_limit_exception', err.message);
    return { ok: false, reason: 'rate_limit_exception' };
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
      // Fail-closed, igual que el límite por IP.
      console.error('rate_limit_subject_error', JSON.stringify(error));
      return { ok: false, reason: 'rate_limit_db_error' };
    }

    if (data > maxPerWindow) {
      return { ok: false, reason: 'rate_limit_exceeded', count: data };
    }

    return { ok: true, count: data };
  } catch (err) {
    console.error('rate_limit_subject_exception', err.message);
    return { ok: false, reason: 'rate_limit_exception' };
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
    // El token debe haberse resuelto en nuestro propio sitio, no en otro
    // dominio que comparta la site key.
    if (!hostnamePermitido(json.hostname)) {
      return { ok: false, reason: 'turnstile_hostname', hostname: json.hostname };
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
// IP del cliente
//
// Solo se leen cabeceras que Vercel fija y sobrescribe en su borde
// (x-real-ip y el primer salto de x-forwarded-for). Antes se leía primero
// x-nf-client-connection-ip, que es de Netlify: en Vercel la manda el
// cliente y permitía elegir la IP con que se contaba el rate limit.
// Devuelve null si el valor no es una IP válida.
// ---------------------------------------------------------------------
export function getClientIp(req) {
  const h = name => {
    const v = req.headers?.get ? req.headers.get(name) : req.headers?.[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const real = h('x-real-ip');
  const xff  = h('x-forwarded-for');
  const ip = real ? String(real).trim() : xff ? String(xff).split(',')[0].trim() : req.socket?.remoteAddress ?? null;
  return ip && isIP(ip) ? ip : null;
}

// ---------------------------------------------------------------------
// Comparación de secretos en tiempo constante (Bearer de cron/admin,
// token del webhook). Un secreto ausente nunca coincide.
// ---------------------------------------------------------------------
export function secretoCoincide(recibido, esperado) {
  if (!esperado || typeof recibido !== 'string') return false;
  const a = createHash('sha256').update(recibido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

export function bearerCoincide(authorization, secreto) {
  return !!secreto && secretoCoincide(String(authorization ?? ''), `Bearer ${secreto}`);
}

// ---------------------------------------------------------------------
// Origin allowlist (anti-CSRF para endpoints públicos)
// ---------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'https://estetikascr.com',
  'https://www.estetikascr.com',
]);

const DEV_ORIGINS = new Set([
  'http://localhost:4321',
  'http://localhost:3000',
  'http://localhost:8888'
]);

// Solo los previews de este proyecto (estetikas-<hash|git-rama>-estetikas-projects.vercel.app).
// Antes se aceptaba cualquier *.vercel.app, y cualquiera puede publicar ahí.
const PREVIEW_ORIGIN = /^https:\/\/estetikas-[a-z0-9-]+-estetikas-projects\.vercel\.app$/;

export function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.VERCEL_ENV === 'production') return false;
  return PREVIEW_ORIGIN.test(origin) || DEV_ORIGINS.has(origin);
}

function hostnamePermitido(hostname) {
  if (!hostname) return false;
  if (isOriginAllowed(`https://${hostname}`)) return true;
  return process.env.VERCEL_ENV !== 'production' && hostname === 'localhost';
}
