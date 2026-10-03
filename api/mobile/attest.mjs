// Alta de dispositivo para la app móvil.
//
//   GET  /api/mobile/attest  → devuelve un reto de un solo uso
//   POST /api/mobile/attest  → recibe la atestación y emite el token de sesión
//
// Es el reemplazo de Turnstile para la app: en vez de pedirle a la persona que
// demuestre no ser un bot, el dispositivo demuestra ante Apple o Google que es
// una instalación legítima de la app. Se hace una sola vez por instalación; el
// token resultante dura 90 días y es lo que create-booking acepta en lugar de
// la comprobación de Origin.

import { supabase } from '../_lib/supabase.mjs';
import { verifyAppAttest, verifyPlayIntegrity } from '../_lib/attest.mjs';
import { issueChallenge, issueSession, verifyChallenge } from '../_lib/mobile-auth.mjs';
import { createHash } from 'node:crypto';
import { checkRateLimit, audit, getClientIp } from '../_lib/security.mjs';
import { safeUserAgent } from '../_lib/validate.mjs';

const RE_DEVICE_ID = /^[A-Za-z0-9_.:+/=-]{16,200}$/;
const MAX_BODY = 32_000; // una atestación de App Attest ronda los 6 KB

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

function getHeader(req, name) {
  return req.headers[name.toLowerCase()] ?? null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY) {
        req.destroy();
        reject(new Error('payload_demasiado_grande'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const ip = getClientIp(req);

  if (req.method === 'GET') {
    // El reto no revela nada y caduca en 5 minutos, pero se limita igual para
    // que nadie use el endpoint como oráculo de firmas.
    const rl = await checkRateLimit(ip, 'mobile-challenge', { maxPerWindow: 30, windowMinutes: 10 });
    if (!rl.ok) return send(res, 429, { error: 'demasiados_intentos' });
    return send(res, 200, { challenge: issueChallenge() });
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  // Atestar es caro y se hace una vez por instalación: un límite estrecho por
  // IP es suficiente y aquí sí es la señal correcta, porque todavía no hay
  // dispositivo de confianza por el que limitar.
  const rl = await checkRateLimit(ip, 'mobile-attest', { maxPerWindow: 10, windowMinutes: 10 });
  if (!rl.ok) {
    await audit({ actor: 'mobile', action: 'rate_limited', metadata: { endpoint: 'attest' }, ip });
    return send(res, 429, { error: 'demasiados_intentos' });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (err) {
    if (err.message === 'payload_demasiado_grande') return send(res, 413, { error: err.message });
    return send(res, 400, { error: 'json_invalido' });
  }

  const platform = payload?.platform;
  if (platform !== 'ios' && platform !== 'android') {
    return send(res, 400, { error: 'plataforma_invalida' });
  }

  const challenge = verifyChallenge(payload?.challenge);
  if (!challenge.ok) return send(res, 400, { error: challenge.reason });

  // El reto es de un solo uso de verdad: se consume antes de llamar a Apple o
  // Google. Antes solo se verificaban la firma y la caducidad, y el mismo reto
  // (con el mismo token de Play Integrity) servía varias veces en 5 minutos.
  const consumo = await consumirReto(payload.challenge);
  if (!consumo.ok) {
    if (consumo.reason === 'reto_ya_usado') return send(res, 400, { error: 'reto_ya_usado' });
    return send(res, 500, { error: 'error_interno' });
  }

  let deviceId;
  let keyId = null;
  let publicKey = null;

  if (platform === 'ios') {
    if (typeof payload.attestation !== 'string' || typeof payload.keyId !== 'string') {
      return send(res, 400, { error: 'atestacion_incompleta' });
    }

    const result = await verifyAppAttest({
      attestation: Buffer.from(payload.attestation, 'base64'),
      keyId: payload.keyId,
      challenge: challenge.bytes,
    });
    if (!result.ok) {
      await audit({
        actor: 'mobile',
        action: 'attest_failed',
        metadata: { platform, reason: result.reason, detail: result.detail },
        ip,
      });
      return send(res, 403, { error: 'atestacion_rechazada' });
    }

    // En iOS el propio keyId identifica al dispositivo: es el SHA-256 de una
    // clave que solo existe dentro del Secure Enclave de ese aparato.
    deviceId = result.keyId;
    keyId = result.keyId;
    publicKey = result.publicKeyPem;
  } else {
    if (typeof payload.token !== 'string' || !RE_DEVICE_ID.test(payload.deviceId ?? '')) {
      return send(res, 400, { error: 'atestacion_incompleta' });
    }

    const result = await verifyPlayIntegrity({
      token: payload.token,
      challenge: challenge.bytes,
    });
    if (!result.ok) {
      await audit({
        actor: 'mobile',
        action: 'attest_failed',
        metadata: { platform, reason: result.reason, detail: result.detail },
        ip,
      });
      return send(res, 403, { error: 'atestacion_rechazada' });
    }

    // Play Integrity certifica "app genuina en dispositivo íntegro", pero no
    // devuelve un identificador estable de aparato. El deviceId lo genera el
    // cliente y sirve para el rate limit: como cada reto se consume una sola
    // vez, rotarlo exige un token de integridad nuevo por cada intento, y un id
    // que ya existe (o está revocado) se rechaza más abajo.
    deviceId = payload.deviceId;
  }

  const appVersion =
    typeof payload.appVersion === 'string' ? payload.appVersion.slice(0, 40) : null;

  // Una nueva atestación nunca deshace una revocación ni pisa la fila de otro
  // dispositivo: si el id ya existe, debe ser el mismo aparato (misma
  // plataforma y misma clave) y no estar revocado.
  const { data: existente, error: lookupErr } = await supabase
    .from('mobile_devices')
    .select('platform, key_id, revoked_at')
    .eq('device_id', deviceId)
    .maybeSingle();
  if (lookupErr) {
    console.error('mobile_device_lookup_error', JSON.stringify(lookupErr));
    return send(res, 500, { error: 'error_interno' });
  }
  if (existente && (existente.revoked_at || existente.platform !== platform || (existente.key_id ?? null) !== keyId)) {
    await audit({
      actor: 'mobile',
      action: 'attest_conflict',
      metadata: { platform, revocado: !!existente.revoked_at, otra_plataforma: existente.platform !== platform },
      ip,
    });
    return send(res, 403, { error: 'atestacion_rechazada' });
  }

  const { error } = await supabase.from('mobile_devices').upsert(
    {
      device_id: deviceId,
      platform,
      key_id: keyId,
      public_key: publicKey,
      app_version: appVersion,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'device_id' }
  );

  if (error) {
    console.error('mobile_device_upsert_error', JSON.stringify(error));
    return send(res, 500, { error: 'error_interno' });
  }

  await audit({
    actor: 'mobile',
    action: 'device_attested',
    metadata: { platform, appVersion, ua: safeUserAgent(getHeader(req, 'user-agent')) },
    ip,
  });

  return send(res, 201, {
    ok: true,
    session: issueSession({ deviceId, platform }),
    deviceId,
  });
}

/** Marca el reto como usado; un segundo intento choca con la clave primaria. */
async function consumirReto(reto) {
  const nonceHash = createHash('sha256').update(reto).digest('hex');
  const { error } = await supabase.from('mobile_challenges_used').insert({
    nonce_hash: nonceHash,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (!error) return { ok: true };
  if (error.code === '23505') return { ok: false, reason: 'reto_ya_usado' };
  console.error('challenge_consume_error', JSON.stringify(error));
  return { ok: false, reason: 'error_interno' };
}
