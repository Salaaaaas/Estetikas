// Pruebas de regresión de los arreglos de la auditoría de seguridad
// (2026-10-03). Sin red ni base de datos: valores de entorno ficticios y
// fetch simulado.
//   node scripts/test-seguridad.mjs

process.env.SUPABASE_URL ??= 'https://prueba.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'clave-de-prueba';
process.env.GOOGLE_CALENDAR_ID ??= 'primary';

const assert = (await import('node:assert/strict')).default;
const { readFileSync } = await import('node:fs');
const { validateBookingInput } = await import('../api/_lib/validate.mjs');
const { horasOfrecidas } = await import('../api/_lib/horarios.mjs');
const { getClientIp, bearerCoincide, secretoCoincide } = await import('../api/_lib/security.mjs');
const { decodeCbor } = await import('../api/_lib/cbor.mjs');
const { children } = await import('../api/_lib/der.mjs');
const { getScheduleFromCalendar } = await import('../api/_lib/calendar.mjs');
const { CATALOGO } = await import('../api/_lib/catalogo.mjs');
const { construirCatalogo } = await import('./build-catalogo.mjs');

let ok = 0;
async function prueba(nombre, fn) {
  await fn();
  ok++;
  console.log(`  ✓ ${nombre}`);
}

function enDias(n) {
  const d = new Date(Date.now() - 6 * 3600_000);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const base = {
  nombre: 'Ana Prueba', telefono: '88888888', sede: 'Guápiles (Clínica Medical Numancia)',
  fecha: enDias(7), hora: '09:00', servicios: [{ slug: 'botox', name: 'Botox' }],
  consentimiento_habeas_data: true, turnstile_token: 'tok',
};

console.log('validación de reservas');
await prueba('hora fuera de rango se rechaza', () => {
  for (const hora of ['99:99', '24:00', '9:00', '09:60']) {
    assert.equal(validateBookingInput({ ...base, hora }).ok, false, hora);
  }
  assert.equal(validateBookingInput(base).ok, true);
});
await prueba('fecha imposible se rechaza sin llegar a la BD', () => {
  assert.equal(validateBookingInput({ ...base, fecha: '2027-02-31' }).ok, false);
});
await prueba('el nombre del servicio lo pone el servidor', () => {
  const v = validateBookingInput({ ...base, servicios: [{ slug: 'botox', name: '<a href="https://x">Confirme</a>' }] });
  assert.equal(v.ok, true);
  assert.equal(v.data.servicios[0].name, CATALOGO.botox);
});
await prueba('slug fuera del catálogo se rechaza', () => {
  assert.equal(validateBookingInput({ ...base, servicios: [{ slug: 'no-existe', name: 'x' }] }).ok, false);
});
await prueba('catalogo.mjs está al día con src/content', () => {
  assert.deepEqual({ ...CATALOGO }, construirCatalogo());
});

console.log('turnos ofrecidos');
const sesionesCal = [{ id: 'cal-1', type: 'date', date: base.fecha, hours: '9:00 AM – 12:00 PM', label: 'Dra. Karen', forIds: ['*'], sede: base.sede }];
await prueba('solo horas de la parrilla del día y la sede', () => {
  const h = horasOfrecidas(base.fecha, base.sede, ['botox'], sesionesCal);
  assert.deepEqual([...h].sort(), ['09:00', '10:00', '11:00']);
  assert.equal(h.has('09:01'), false);
  assert.equal(h.has('03:00'), false);
});
await prueba('otra sede o un día sin sesión no ofrece nada', () => {
  assert.equal(horasOfrecidas(base.fecha, 'Guápiles (Eco Clinic)', ['botox'], sesionesCal).size, 0);
  assert.equal(horasOfrecidas(enDias(8), base.sede, ['botox'], sesionesCal).size, 0);
});

console.log('IP y secretos');
await prueba('x-nf-client-connection-ip ya no decide la IP', () => {
  const req = { headers: { 'x-nf-client-connection-ip': '192.0.2.9', 'x-real-ip': '198.51.100.7' } };
  assert.equal(getClientIp(req), '198.51.100.7');
});
await prueba('una "IP" inválida se descarta', () => {
  assert.equal(getClientIp({ headers: { 'x-real-ip': 'no-es-ip' } }), null);
});
await prueba('Bearer sin secreto configurado nunca coincide', () => {
  assert.equal(bearerCoincide('Bearer undefined', undefined), false);
  assert.equal(bearerCoincide('Bearer s3creto', 's3creto'), true);
  assert.equal(secretoCoincide(undefined, 'x'), false);
});

console.log('parsers');
await prueba('DER con longitud de 4 bytes no entra en bucle', () => {
  assert.throws(() => children(Buffer.from([0x30, 0x84, 0xff, 0xff, 0xff, 0xfa])));
});
await prueba('CBOR muy anidado o con longitudes falsas falla rápido', () => {
  assert.throws(() => decodeCbor(Buffer.alloc(100, 0x81)), /anidamiento|truncados/);
  assert.throws(() => decodeCbor(Buffer.from([0x9b, 0x00, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])), /truncados/);
});

console.log('calendario público');
await prueba('get-schedule no publica invitaciones ajenas ni citas de pacientes', async () => {
  const eventos = [
    { id: 'a', summary: 'Dra. Karen', location: 'Guápiles', organizer: { self: true },
      start: { dateTime: `${base.fecha}T09:00:00-06:00` }, end: { dateTime: `${base.fecha}T12:00:00-06:00` } },
    { id: 'b', summary: 'Invitación de afuera', location: 'Eco Clinic', organizer: { email: 'x@y.z' },
      start: { dateTime: `${base.fecha}T09:00:00-06:00` }, end: { dateTime: `${base.fecha}T10:00:00-06:00` } },
    { id: 'c', summary: 'Cita — Paciente Real', location: 'Guápiles', organizer: { self: true },
      start: { dateTime: `${base.fecha}T13:00:00-06:00` }, end: { dateTime: `${base.fecha}T14:00:00-06:00` } },
  ];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => (String(url).includes('oauth2') ? { access_token: 't' } : { items: eventos }),
  });
  try {
    const s = await getScheduleFromCalendar('a', 'b');
    assert.deepEqual(s.map(x => x.label), ['Dra. Karen']);
  } finally {
    globalThis.fetch = original;
  }
});

console.log('correo');
await prueba('la plantilla escapa los datos de la cita', () => {
  const src = readFileSync(new URL('../api/_lib/email.mjs', import.meta.url), 'utf8');
  assert.match(src, /const serviciosStr\s*=\s*esc\(/);
  assert.match(src, /nombre = esc\(nombre\)/);
});

console.log(`\n${ok} comprobaciones pasaron`);
