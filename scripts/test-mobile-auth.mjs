/**
 * Comprobaciones de las piezas puras de la capa móvil: CBOR, DER, normalización
 * de teléfonos, hash determinista, retos y sesiones.
 *
 *   node scripts/test-mobile-auth.mjs
 *
 * No toca la red ni la base de datos: usa secretos de prueba propios, así que
 * corre igual en local que en CI. Lo que NO cubre —y no puede— es una
 * atestación real de App Attest o Play Integrity: para eso hacen falta un
 * dispositivo físico y las credenciales de las tiendas.
 */

import assert from 'node:assert/strict';
import { X509Certificate, generateKeyPairSync, createHash, createHmac } from 'node:crypto';

process.env.MOBILE_SESSION_SECRET ??= 'secreto-de-prueba-suficientemente-largo-1234567890';
process.env.PHONE_HASH_PEPPER ??= 'pepper-de-prueba-suficientemente-largo-1234567890';
// mobile-auth importa el cliente de Supabase para comprobar revocaciones. Estas
// credenciales falsas solo permiten construirlo: ninguna prueba de aquí sale a
// la red ni llama a requireMobileSession.
process.env.SUPABASE_URL ??= 'https://prueba.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'clave-de-prueba-no-valida';

const { decodeCbor } = await import('../api/_lib/cbor.mjs');
const { encodeOid, findExtension, ecPointFromSpki } = await import('../api/_lib/der.mjs');
const { normalizePhoneE164 } = await import('../api/_lib/validate.mjs');
const { hashPhone } = await import('../api/_lib/crypto.mjs');
const { issueChallenge, verifyChallenge, issueSession, verifySession, bearerToken } = await import(
  '../api/_lib/mobile-auth.mjs'
);
const { verifyAppAttest } = await import('../api/_lib/attest.mjs');
const { ciudadDeSede } = await import('../api/get-availability.mjs');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

const hex = (s) => Buffer.from(s.replace(/\s/g, ''), 'hex');

console.log('\nCBOR (vectores del RFC 8949, apéndice A)');
test('enteros', () => {
  assert.equal(decodeCbor(hex('00')), 0);
  assert.equal(decodeCbor(hex('17')), 23);
  assert.equal(decodeCbor(hex('1818')), 24);
  assert.equal(decodeCbor(hex('1903e8')), 1000);
  assert.equal(decodeCbor(hex('20')), -1);
  assert.equal(decodeCbor(hex('3903e7')), -1000);
});
test('cadenas de bytes y de texto', () => {
  assert.deepEqual(decodeCbor(hex('4401020304')), Buffer.from([1, 2, 3, 4]));
  assert.equal(decodeCbor(hex('63666f6f')), 'foo');
});
test('arrays y mapas', () => {
  assert.deepEqual(decodeCbor(hex('83010203')), [1, 2, 3]);
  assert.deepEqual({ ...decodeCbor(hex('a26161016162820203')) }, { a: 1, b: [2, 3] });
});
test('valores simples', () => {
  assert.equal(decodeCbor(hex('f4')), false);
  assert.equal(decodeCbor(hex('f5')), true);
  assert.equal(decodeCbor(hex('f6')), null);
});
test('rechaza longitud indefinida', () => {
  assert.throws(() => decodeCbor(hex('5f42010243030405ff')), /indefinida/);
});
test('rechaza bytes sobrantes', () => {
  assert.throws(() => decodeCbor(hex('0000')), /sobrantes/);
});
test('rechaza clave duplicada en mapa', () => {
  // {"a": 1, "a": 2} — permitirlo dejaría sobrescribir un campo ya validado.
  assert.throws(() => decodeCbor(hex('a2616101616102')), /duplicada/);
});
test('rechaza datos truncados', () => {
  assert.throws(() => decodeCbor(hex('4404')), /truncados/);
});

console.log('\nDER');
test('encodeOid reproduce OIDs conocidos', () => {
  // Extensión privada de Apple para el nonce de App Attest.
  assert.deepEqual(encodeOid('1.2.840.113635.100.8.2'), hex('2a 86 48 86 f7 63 64 08 02'));
  // id-ecPublicKey.
  assert.deepEqual(encodeOid('1.2.840.10045.2.1'), hex('2a 86 48 ce 3d 02 01'));
});

const appleRoot = new X509Certificate(`-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----`);

test('la CA raíz embebida es la de Apple', () => {
  assert.match(appleRoot.subject, /Apple App Attestation Root CA/);
  assert.equal(
    appleRoot.fingerprint256,
    '1C:B9:82:3B:A2:8B:A6:AD:2D:33:A0:06:94:1D:E2:AE:4F:51:3E:F1:D4:E8:31:B9:F7:E0:FA:7B:62:42:C9:32'
  );
});
test('findExtension encuentra una extensión real', () => {
  // subjectKeyIdentifier (2.5.29.14): OCTET STRING que envuelve otro de 20 bytes.
  const ski = findExtension(appleRoot.raw, '2.5.29.14');
  assert.ok(ski, 'la raíz de Apple debería tener subjectKeyIdentifier');
  assert.equal(ski[0], 0x04);
  assert.equal(ski.length, 22);
});
test('findExtension devuelve null si el OID no está', () => {
  assert.equal(findExtension(appleRoot.raw, '1.2.840.113635.100.8.2'), null);
});
test('ecPointFromSpki extrae un punto P-256 válido', () => {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const point = ecPointFromSpki(publicKey.export({ format: 'der', type: 'spki' }));
  assert.equal(point[0], 0x04, 'el punto debe ir sin comprimir');
  assert.equal(point.length, 65, '1 byte de prefijo + X(32) + Y(32)');
  assert.equal(createHash('sha256').update(point).digest().length, 32);
});

console.log('\nTeléfonos');
test('normaliza a E.164 con Costa Rica por defecto', () => {
  assert.equal(normalizePhoneE164('8432 0647'), '+50684320647');
  assert.equal(normalizePhoneE164('8432-0647'), '+50684320647');
  assert.equal(normalizePhoneE164('(506) 8432 0647'), '+50684320647');
  assert.equal(normalizePhoneE164('+506 8432 0647'), '+50684320647');
  assert.equal(normalizePhoneE164('+1 (305) 555-0147'), '+13055550147');
  assert.equal(normalizePhoneE164(''), null);
});
test('formatos distintos del mismo número dan el mismo hash', () => {
  const variantes = ['84320647', '8432-0647', '+506 8432 0647', '(506)84320647'];
  const hashes = new Set(variantes.map((v) => hashPhone(normalizePhoneE164(v))));
  assert.equal(hashes.size, 1, 'el índice buscable tiene que ser estable');
});
test('números distintos dan hashes distintos', () => {
  assert.notEqual(hashPhone('+50684320647'), hashPhone('+50684320648'));
});
test('el hash depende del pepper', () => {
  const conPepper = hashPhone('+50684320647');
  const original = process.env.PHONE_HASH_PEPPER;
  process.env.PHONE_HASH_PEPPER = 'otro-pepper-igual-de-largo-1234567890abcdef';
  const conOtro = hashPhone('+50684320647');
  process.env.PHONE_HASH_PEPPER = original;
  assert.notEqual(conPepper, conOtro);
});
test('sin pepper falla en vez de guardar algo débil', () => {
  const original = process.env.PHONE_HASH_PEPPER;
  process.env.PHONE_HASH_PEPPER = 'corto';
  assert.throws(() => hashPhone('+50684320647'), /PHONE_HASH_PEPPER/);
  process.env.PHONE_HASH_PEPPER = original;
});

console.log('\nRetos');
test('un reto recién emitido se acepta', () => {
  const r = verifyChallenge(issueChallenge());
  assert.equal(r.ok, true);
  assert.ok(Buffer.isBuffer(r.bytes));
});
test('rechaza un reto manipulado', () => {
  const [nonce, exp, sig] = issueChallenge().split('.');
  assert.equal(verifyChallenge(`${nonce}x.${exp}.${sig}`).reason, 'reto_no_autentico');
});
test('rechaza un reto caducado aunque la firma sea buena', () => {
  // Se firma un reto ya vencido con el mismo secreto: la firma es válida, la
  // caducidad no.
  const body = `abc.${Date.now() - 1000}`;
  const sig = createHmac('sha256', process.env.MOBILE_SESSION_SECRET).update(body).digest('base64url');
  assert.equal(verifyChallenge(`${body}.${sig}`).reason, 'reto_caducado');
});
test('rechaza basura', () => {
  assert.equal(verifyChallenge('').ok, false);
  assert.equal(verifyChallenge(null).ok, false);
  assert.equal(verifyChallenge('a.b').ok, false);
});

console.log('\nSesiones');
test('una sesión emitida se verifica y conserva los datos', () => {
  const token = issueSession({ deviceId: 'dispositivo-123', platform: 'ios' });
  const s = verifySession(token);
  assert.equal(s.ok, true);
  assert.equal(s.deviceId, 'dispositivo-123');
  assert.equal(s.platform, 'ios');
});
test('rechaza una sesión con el payload alterado', () => {
  const token = issueSession({ deviceId: 'dispositivo-123', platform: 'ios' });
  const [v, payload, sig] = token.split('.');
  const alterado = Buffer.from(
    JSON.stringify({ d: 'otro-dispositivo', p: 'ios', iat: Date.now(), exp: Date.now() + 1000 })
  ).toString('base64url');
  assert.equal(verifySession(`${v}.${alterado}.${sig}`).reason, 'sesion_no_autentica');
});
test('rechaza una versión de token desconocida', () => {
  const token = issueSession({ deviceId: 'd', platform: 'android' });
  assert.equal(verifySession(token.replace(/^v1\./, 'v2.')).ok, false);
});
test('bearerToken lee el header y solo el header bien formado', () => {
  assert.equal(bearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(bearerToken('bearer  abc'), 'abc');
  assert.equal(bearerToken('Basic abc'), null);
  assert.equal(bearerToken(undefined), null);
});

console.log('\nSedes');
test('ciudadDeSede agrupa los dos locales de Guápiles', () => {
  // Es el espejo en JS de la función SQL public.sede_ciudad. Si divergen, el
  // índice único y la parrilla de horas dejarían de coincidir.
  assert.equal(ciudadDeSede('Bataan (Clínica ODONTOBATAAN)'), 'Bataan');
  assert.equal(ciudadDeSede('Guápiles (Clínica Medical Numancia)'), 'Guápiles');
  assert.equal(ciudadDeSede('Guápiles (Eco Clinic)'), 'Guápiles');
});
test('los dos locales de Guápiles comparten profesional, y por tanto hora', () => {
  // La Dra. Karen no puede estar a las 10:00 en Numancia y en Eco Clinic.
  assert.equal(
    ciudadDeSede('Guápiles (Eco Clinic)'),
    ciudadDeSede('Guápiles (Clínica Medical Numancia)')
  );
  assert.notEqual(
    ciudadDeSede('Bataan (Clínica ODONTOBATAAN)'),
    ciudadDeSede('Guápiles (Eco Clinic)')
  );
});

console.log('\nApp Attest (caminos de rechazo)');
async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    console.error(`  \u2717 ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

await testAsync('sin APPLE_TEAM_ID falla cerrado', async () => {
  delete process.env.APPLE_TEAM_ID;
  const r = await verifyAppAttest({
    attestation: Buffer.from('00', 'hex'),
    keyId: '',
    challenge: Buffer.from('reto'),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'app_attest_misconfigured');
});

await testAsync('rechaza una atestación que no es CBOR', async () => {
  process.env.APPLE_TEAM_ID = 'ABCDE12345';
  process.env.IOS_BUNDLE_ID = 'cr.estetikas.app';
  const r = await verifyAppAttest({
    attestation: Buffer.from('no soy cbor valido'),
    keyId: 'AAAA',
    challenge: Buffer.from('reto'),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'attestation_malformada');
});

await testAsync('rechaza un formato de atestación desconocido', async () => {
  // CBOR válido: {"fmt": "otro"}  →  a1 63 666d74 64 6f74726f
  const r = await verifyAppAttest({
    attestation: hex('a163666d74646f74726f'),
    keyId: 'AAAA',
    challenge: Buffer.from('reto'),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'formato_no_soportado');
});

console.log(`\n${passed} comprobaciones pasaron${process.exitCode ? ' — HAY FALLOS' : ''}\n`);
