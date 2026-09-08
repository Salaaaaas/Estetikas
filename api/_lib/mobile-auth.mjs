// Retos y sesiones de la app móvil.
//
// Los dos son cadenas firmadas con HMAC-SHA256 y sin estado en base de datos:
// el servidor no guarda retos pendientes ni sesiones activas, solo comprueba
// la firma y la caducidad. Menos estado que expirar, menos que se pueda
// filtrar, y una función serverless no necesita memoria entre invocaciones.
//
// Lo único que sí vive en la BD es mobile_devices, para poder revocar un
// dispositivo: una sesión firmada sigue siendo válida criptográficamente, pero
// requireMobileSession comprueba que el dispositivo no esté revocado.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { supabase } from './supabase.mjs';

const CHALLENGE_TTL_MS = 5 * 60_000;         // suficiente para atestar
const SESSION_TTL_MS = 90 * 24 * 60 * 60_000; // 90 días

function secret(name) {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} ausente o demasiado corta (mínimo 32 chars).`);
  }
  return value;
}

function sign(secretName, data) {
  return createHmac('sha256', secret(secretName)).update(data).digest('base64url');
}

// Comparación en tiempo constante que no filtra la longitud por excepción.
function sameSignature(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* ----------------------------------------------------------------- reto -- */

/**
 * Reto de un solo uso para la atestación. Formato: `<random>.<exp>.<firma>`.
 * El cliente lo devuelve tal cual junto con la atestación.
 */
export function issueChallenge() {
  const nonce = randomBytes(16).toString('base64url');
  const exp = Date.now() + CHALLENGE_TTL_MS;
  const body = `${nonce}.${exp}`;
  return `${body}.${sign('MOBILE_SESSION_SECRET', body)}`;
}

/**
 * Comprueba un reto y devuelve los bytes que el dispositivo tuvo que firmar.
 * @returns {{ok:true, bytes:Buffer}|{ok:false, reason:string}}
 */
export function verifyChallenge(challenge) {
  if (typeof challenge !== 'string' || challenge.length > 300) {
    return { ok: false, reason: 'reto_invalido' };
  }

  const parts = challenge.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'reto_invalido' };

  const [nonce, exp, signature] = parts;
  if (!sameSignature(signature, sign('MOBILE_SESSION_SECRET', `${nonce}.${exp}`))) {
    return { ok: false, reason: 'reto_no_autentico' };
  }
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) {
    return { ok: false, reason: 'reto_caducado' };
  }

  // El dispositivo firma el reto completo, tal y como lo recibió.
  return { ok: true, bytes: Buffer.from(challenge, 'utf8') };
}

/* -------------------------------------------------------------- sesión -- */

/**
 * Token de sesión del dispositivo. Formato: `v1.<payload>.<firma>`.
 * El payload es JSON en base64url: no es secreto, solo infalsificable.
 */
export function issueSession({ deviceId, platform }) {
  const payload = Buffer.from(
    JSON.stringify({ d: deviceId, p: platform, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url');
  return `v1.${payload}.${sign('MOBILE_SESSION_SECRET', payload)}`;
}

/**
 * Verifica la firma y la caducidad de un token de sesión. No toca la BD.
 * @returns {{ok:true, deviceId:string, platform:string}|{ok:false, reason:string}}
 */
export function verifySession(token) {
  if (typeof token !== 'string' || token.length > 1024) {
    return { ok: false, reason: 'sesion_invalida' };
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'sesion_invalida' };

  const [, payload, signature] = parts;
  if (!sameSignature(signature, sign('MOBILE_SESSION_SECRET', payload))) {
    return { ok: false, reason: 'sesion_no_autentica' };
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'sesion_invalida' };
  }

  if (!claims?.d || !claims?.p) return { ok: false, reason: 'sesion_invalida' };
  if (!Number.isFinite(claims.exp) || claims.exp < Date.now()) {
    return { ok: false, reason: 'sesion_caducada' };
  }

  return { ok: true, deviceId: String(claims.d), platform: String(claims.p) };
}

/** Lee el token del header Authorization: Bearer <token>. */
export function bearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Verifica la sesión y además que el dispositivo siga activo. Es lo que deben
 * usar los endpoints: verifySession por sí sola no ve una revocación.
 *
 * Falla cerrado — si la consulta a la BD no responde, la petición se rechaza.
 * @returns {Promise<{ok:true, deviceId:string, platform:string}|{ok:false, reason:string}>}
 */
export async function requireMobileSession(authorizationHeader) {
  const token = bearerToken(authorizationHeader);
  if (!token) return { ok: false, reason: 'sesion_ausente' };

  const session = verifySession(token);
  if (!session.ok) return session;

  const { data, error } = await supabase
    .from('mobile_devices')
    .select('device_id, revoked_at')
    .eq('device_id', session.deviceId)
    .maybeSingle();

  if (error) {
    console.error('mobile_device_lookup_error', JSON.stringify(error));
    return { ok: false, reason: 'error_interno' };
  }
  if (!data) return { ok: false, reason: 'dispositivo_desconocido' };
  if (data.revoked_at) return { ok: false, reason: 'dispositivo_revocado' };

  // Best-effort: saber cuándo se vio por última vez ayuda a limpiar, pero no
  // justifica tumbar una reserva si falla.
  supabase
    .from('mobile_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('device_id', session.deviceId)
    .then(({ error: e }) => {
      if (e) console.error('mobile_device_touch_error', e.message);
    });

  return { ok: true, deviceId: session.deviceId, platform: session.platform };
}
