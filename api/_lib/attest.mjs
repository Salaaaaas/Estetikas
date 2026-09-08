// Atestación de dispositivo: el sustituto nativo de Turnstile.
//
// Turnstile es un widget de navegador y no puede ejecutarse en una app. En su
// lugar el dispositivo demuestra, ante Apple o Google, que la petición sale de
// una instalación legítima de la app en un dispositivo sin manipular. Es una
// garantía más fuerte que un CAPTCHA y además invisible para la clienta.
//
//   iOS      → App Attest. El Secure Enclave firma un reto que emitimos
//              nosotros; aquí se verifica la cadena hasta la CA raíz de Apple.
//   Android  → Play Integrity. El token se envía a Google, que responde con
//              su veredicto sobre la app y el dispositivo.
//
// Ambos caminos comparten el mismo reto de un solo uso (ver mobile-auth.mjs) para
// que una atestación capturada no pueda reproducirse.

import { X509Certificate, createHash, createPublicKey } from 'node:crypto';
import { decodeCbor } from './cbor.mjs';
import {
  TAG_OCTET_STRING,
  children as derChildren,
  ecPointFromSpki,
  findExtension,
  parse as parseDer,
} from './der.mjs';

// CA raíz de App Attest, descargada de
// https://www.apple.com/certificateauthority/Apple_App_Attestation_Root_CA.pem
// Huella SHA-256:
// 1C:B9:82:3B:A2:8B:A6:AD:2D:33:A0:06:94:1D:E2:AE:4F:51:3E:F1:D4:E8:31:B9:F7:E0:FA:7B:62:42:C9:32
const APPLE_APP_ATTEST_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`;

const APPLE_NONCE_OID = '1.2.840.113635.100.8.2';

// El aaguid identifica el entorno del que salió la clave. Aceptar el de
// desarrollo en producción permitiría atestar desde Xcode con un dispositivo
// cualquiera, así que solo se admite cuando APP_ATTEST_ENV lo dice.
const AAGUID_PROD = Buffer.concat([Buffer.from('appattest'), Buffer.alloc(7)]);
const AAGUID_DEV = Buffer.from('appattestdevelop');

function fail(reason, detail) {
  return { ok: false, reason, detail: detail ?? null };
}

/* ------------------------------------------------------------------ iOS -- */

/**
 * Verifica una atestación de App Attest.
 *
 * @param {object} params
 * @param {Buffer} params.attestation  objeto de atestación CBOR
 * @param {string} params.keyId        base64 del keyId que devolvió el cliente
 * @param {Buffer} params.challenge    reto que emitimos, en bytes
 * @returns {Promise<{ok:true, keyId:string, publicKeyPem:string}|{ok:false, reason:string}>}
 */
export async function verifyAppAttest({ attestation, keyId, challenge }) {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = process.env.IOS_BUNDLE_ID;
  if (!teamId || !bundleId) return fail('app_attest_misconfigured');

  const allowDev = process.env.APP_ATTEST_ENV === 'development';

  let decoded;
  try {
    decoded = decodeCbor(attestation);
  } catch (err) {
    return fail('attestation_malformada', err.message);
  }

  if (decoded?.fmt !== 'apple-appattest') return fail('formato_no_soportado');

  const x5c = decoded.attStmt?.x5c;
  const authData = decoded.authData;
  if (!Array.isArray(x5c) || x5c.length < 2) return fail('cadena_de_certificados_ausente');
  if (!Buffer.isBuffer(authData) || authData.length < 55) return fail('authdata_invalido');

  // 1. Cadena: hoja ← intermedio ← raíz de Apple.
  let leaf, intermediate, root;
  try {
    leaf = new X509Certificate(x5c[0]);
    intermediate = new X509Certificate(x5c[1]);
    root = new X509Certificate(APPLE_APP_ATTEST_ROOT_CA);
  } catch (err) {
    return fail('certificado_ilegible', err.message);
  }

  const now = Date.now();
  for (const [name, cert] of [['hoja', leaf], ['intermedio', intermediate]]) {
    if (new Date(cert.validFrom).getTime() > now || new Date(cert.validTo).getTime() < now) {
      return fail('certificado_fuera_de_vigencia', name);
    }
  }
  if (!leaf.verify(intermediate.publicKey)) return fail('cadena_invalida', 'hoja/intermedio');
  if (!intermediate.verify(root.publicKey)) return fail('cadena_invalida', 'intermedio/raiz');

  // 2. El nonce del certificado ata la atestación a NUESTRO reto.
  const clientDataHash = createHash('sha256').update(challenge).digest();
  const expectedNonce = createHash('sha256')
    .update(Buffer.concat([authData, clientDataHash]))
    .digest();

  let certNonce;
  try {
    const extValue = findExtension(leaf.raw, APPLE_NONCE_OID);
    if (!extValue) return fail('nonce_ausente');

    // extnValue ::= SEQUENCE { [1] EXPLICIT OCTET STRING nonce }
    const seq = parseDer(extValue);
    const tagged = derChildren(seq.content).find((c) => c.tag === 0xa1);
    if (!tagged) return fail('nonce_malformado');
    const octet = derChildren(tagged.content)[0];
    if (!octet || octet.tag !== TAG_OCTET_STRING) return fail('nonce_malformado');
    certNonce = octet.content;
  } catch (err) {
    return fail('extension_ilegible', err.message);
  }

  if (certNonce.length !== 32 || !certNonce.equals(expectedNonce)) return fail('nonce_no_coincide');

  // 3. El keyId es el SHA-256 de la clave pública de la hoja.
  let point;
  try {
    point = ecPointFromSpki(leaf.publicKey.export({ format: 'der', type: 'spki' }));
  } catch (err) {
    return fail('clave_publica_ilegible', err.message);
  }
  const derivedKeyId = createHash('sha256').update(point).digest();
  if (!derivedKeyId.equals(Buffer.from(keyId, 'base64'))) return fail('keyid_no_coincide');

  // 4. authData: la app correcta, contador a cero y entorno esperado.
  const rpIdHash = authData.subarray(0, 32);
  const signCount = authData.readUInt32BE(33);
  const aaguid = authData.subarray(37, 53);
  const credIdLen = authData.readUInt16BE(53);
  const credId = authData.subarray(55, 55 + credIdLen);

  const expectedRpId = createHash('sha256').update(`${teamId}.${bundleId}`).digest();
  if (!rpIdHash.equals(expectedRpId)) return fail('app_id_no_coincide');
  if (signCount !== 0) return fail('contador_no_es_cero');
  if (credIdLen !== 32 || !credId.equals(derivedKeyId)) return fail('credential_id_no_coincide');

  const isProd = aaguid.equals(AAGUID_PROD);
  const isDev = aaguid.equals(AAGUID_DEV);
  if (!isProd && !(isDev && allowDev)) return fail('entorno_de_atestacion_no_permitido');

  return {
    ok: true,
    keyId: derivedKeyId.toString('base64'),
    publicKeyPem: createPublicKey(leaf.publicKey).export({ format: 'pem', type: 'spki' }).toString(),
  };
}

/* -------------------------------------------------------------- Android -- */

let playIntegrityClient = null;

async function getPlayIntegrityClient() {
  if (playIntegrityClient) return playIntegrityClient;

  const rawKey = process.env.GOOGLE_PLAY_INTEGRITY_SA_JSON;
  if (!rawKey) throw new Error('falta GOOGLE_PLAY_INTEGRITY_SA_JSON');

  // Se acepta el JSON tal cual o en base64, porque pegar un JSON con saltos de
  // línea en el panel de Vercel es una fuente inagotable de errores.
  const text = rawKey.trim().startsWith('{')
    ? rawKey
    : Buffer.from(rawKey, 'base64').toString('utf8');

  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(text),
    scopes: ['https://www.googleapis.com/auth/playintegrity'],
  });

  playIntegrityClient = google.playintegrity({ version: 'v1', auth });
  return playIntegrityClient;
}

/**
 * Verifica un token de Play Integrity contra la API de Google.
 *
 * @param {object} params
 * @param {string} params.token      integrityToken que produjo el cliente
 * @param {Buffer} params.challenge  reto que emitimos, en bytes
 */
export async function verifyPlayIntegrity({ token, challenge }) {
  const packageName = process.env.ANDROID_PACKAGE_NAME;
  if (!packageName) return fail('play_integrity_misconfigured');

  let payload;
  try {
    const client = await getPlayIntegrityClient();
    const res = await client.v1.decodeIntegrityToken({
      packageName,
      requestBody: { integrityToken: token },
    });
    payload = res.data?.tokenPayloadExternal;
  } catch (err) {
    console.error('play_integrity_error', err?.message);
    return fail('play_integrity_no_disponible');
  }

  if (!payload) return fail('respuesta_vacia');

  const details = payload.requestDetails ?? {};
  if (details.requestPackageName !== packageName) return fail('paquete_no_coincide');

  // El reto viaja como nonce en base64url sin relleno, tal y como lo pide la
  // API de Play Integrity.
  const expectedNonce = challenge.toString('base64url');
  if (details.requestHash !== expectedNonce && details.nonce !== expectedNonce) {
    return fail('nonce_no_coincide');
  }

  const ts = Number(details.timestampMillis ?? 0);
  if (!ts || Math.abs(Date.now() - ts) > 5 * 60_000) return fail('token_caducado');

  const appVerdict = payload.appIntegrity?.appRecognitionVerdict;
  if (appVerdict !== 'PLAY_RECOGNIZED') return fail('app_no_reconocida', appVerdict);

  const deviceVerdicts = payload.deviceIntegrity?.deviceRecognitionVerdict ?? [];
  if (!deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
    return fail('dispositivo_no_integro', deviceVerdicts.join(',') || 'sin veredicto');
  }

  return { ok: true, packageName, appVersion: payload.appIntegrity?.versionCode ?? null };
}
