// Pruebas de la agenda (api/_lib/agenda.mjs): qué evento del Calendar abre
// horario, cuál ocupa turnos y cuáles. Sin red ni BD.
// Ejecutar: node scripts/test-agenda.mjs
import assert from 'node:assert/strict';
import {
  clasificarEventos, tipoDeEvento, turnoOcupado, ocupadosDeCitas, fechaHoraCR, intervaloDeEvento,
} from '../api/_lib/agenda.mjs';
import { horasOfrecidas } from '../api/_lib/horarios.mjs';

const BATAAN = 'Bataan (Clínica ODONTOBATAAN)';
const NUMANCIA = 'Guápiles (Clínica Medical Numancia)';
const ECO = 'Guápiles (Eco Clinic)';
const F = '2026-11-10'; // martes: limpiezas 5:30 y 6:30 PM

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { process.exitCode = 1; console.error(`  ✗ ${name}\n    ${err.message}`); }
}

const ev = (summary, ini, fin, extra = {}) => ({
  id: summary, summary, organizer: { self: true }, status: 'confirmed',
  start: { dateTime: `${F}T${ini}:00-06:00` }, end: { dateTime: `${F}T${fin}:00-06:00` }, ...extra,
});
const ocupadosDe = (...events) => clasificarEventos(events).ocupados;
const libres = (sede, ocupados, fecha = F) =>
  [...horasOfrecidas(fecha, sede, ['limpieza-facial'])].filter((h) => !turnoOcupado(fecha, h, sede, ocupados)).sort();

test('sin eventos: los dos turnos del martes libres', () => {
  assert.deepEqual(libres(BATAAN, []), ['17:30', '18:30']);
});

test('evento personal que empieza a la misma hora bloquea ese turno', () => {
  assert.deepEqual(libres(BATAAN, ocupadosDe(ev('Dentista', '17:30', '18:30'))), ['18:30']);
});

test('evento que empieza antes (5:00–6:00) bloquea el turno de 5:30', () => {
  assert.deepEqual(libres(BATAAN, ocupadosDe(ev('Dentista', '17:00', '18:00'))), ['18:30']);
});

test('evento a media hora (5:45–6:00) bloquea el turno de 5:30', () => {
  assert.deepEqual(libres(BATAAN, ocupadosDe(ev('Llamada', '17:45', '18:00'))), ['18:30']);
});

test('evento largo (5:30–7:30) bloquea los dos turnos', () => {
  assert.deepEqual(libres(BATAAN, ocupadosDe(ev('Curso', '17:30', '19:30'))), []);
});

test('evento que termina justo cuando empieza el turno no lo bloquea', () => {
  assert.deepEqual(libres(BATAAN, ocupadosDe(ev('Almuerzo', '16:30', '17:30'))), ['17:30', '18:30']);
});

test('evento de día completo bloquea todo el día y solo ese día', () => {
  const vac = { id: 'v', summary: 'Vacaciones', organizer: { self: true },
    start: { date: F }, end: { date: '2026-11-11' } };
  const oc = ocupadosDe(vac);
  assert.deepEqual(libres(BATAAN, oc), []);
  assert.deepEqual(libres(BATAAN, oc, '2026-11-11'), ['17:30', '18:30']);
  assert.deepEqual(libres(BATAAN, oc, '2026-11-09'.replace('09', '12')), ['17:30', '18:30']);
});

test('día completo de varios días los bloquea todos', () => {
  const vac = { id: 'v', summary: 'Viaje', organizer: { self: true },
    start: { date: F }, end: { date: '2026-11-13' } };
  const oc = ocupadosDe(vac);
  assert.deepEqual(libres(BATAAN, oc, '2026-11-12'), []);
  assert.deepEqual(libres(BATAAN, oc, '2026-11-13'), ['17:30', '18:30']);
});

test('cancelados e invitaciones rechazadas no ocupan', () => {
  const oc = ocupadosDe(
    ev('Cancelado', '17:30', '18:30', { status: 'cancelled' }),
    ev('Reunión', '18:30', '19:30', { organizer: { email: 'x@y.z' },
      attendees: [{ self: true, responseStatus: 'declined' }] }),
  );
  assert.deepEqual(libres(BATAAN, oc), ['17:30', '18:30']);
});

test('invitación aceptada ocupa', () => {
  const oc = ocupadosDe(ev('Reunión', '18:30', '19:30', { organizer: { email: 'x@y.z' },
    attendees: [{ self: true, responseStatus: 'accepted' }] }));
  assert.deepEqual(libres(BATAAN, oc), ['17:30']);
});

test('evento sin sede bloquea todas las sedes', () => {
  const oc = ocupadosDe(ev('Dentista', '17:30', '18:30'));
  assert.equal(turnoOcupado(F, '17:30', NUMANCIA, oc), true);
  assert.equal(turnoOcupado(F, '17:30', BATAAN, oc), true);
});

test('cita del sitio solo ocupa su ciudad', () => {
  const oc = ocupadosDe(ev('Cita — Ana', '17:30', '18:30', { description: `📞 8888\n📍 Sede: ${BATAAN}` }));
  assert.equal(turnoOcupado(F, '17:30', BATAAN, oc), true);
  assert.equal(turnoOcupado(F, '17:30', NUMANCIA, oc), false);
  assert.equal(turnoOcupado(F, '17:30', null, oc), true);
});

test('cita en Eco Clinic ocupa también Numancia (misma ciudad)', () => {
  const oc = ocupadosDe(ev('Cita — Ana', '09:00', '10:00', { description: `📍 Sede: ${ECO}` }));
  assert.equal(turnoOcupado(F, '09:00', NUMANCIA, oc), true);
});

test('bloque de disponibilidad abre horario y no ocupa', () => {
  const { bloques, ocupados } = clasificarEventos([ev('Dra. Karen', '08:00', '12:00', { location: 'Guápiles' })]);
  assert.equal(ocupados.length, 0);
  assert.deepEqual(bloques.map((b) => [b.date, b.hours, b.sede]), [[F, '8:00 AM – 12:00 PM', NUMANCIA]]);
  assert.deepEqual([...horasOfrecidas(F, NUMANCIA, ['botox'], bloques)].sort(), ['08:00', '09:00', '10:00', '11:00']);
});

test('evento personal dentro de un bloque ocupa sus turnos', () => {
  const { bloques, ocupados } = clasificarEventos([
    ev('Dra. Karen', '08:00', '12:00', { location: 'Guápiles' }),
    ev('Trámite', '09:30', '10:15'),
  ]);
  const libresBotox = [...horasOfrecidas(F, NUMANCIA, ['botox'], bloques)]
    .filter((h) => !turnoOcupado(F, h, NUMANCIA, ocupados)).sort();
  assert.deepEqual(libresBotox, ['08:00', '11:00']);
});

test('no son bloque: invitación ajena, título "Cita…", día completo con sede', () => {
  assert.equal(tipoDeEvento(ev('Karen', '08:00', '12:00', { location: 'Bataan', organizer: { email: 'x@y.z' } })), 'ocupado');
  assert.equal(tipoDeEvento(ev('Cita — María', '08:00', '09:00', { location: 'Bataan' })), 'ocupado');
  assert.equal(tipoDeEvento({ summary: 'Feria', location: 'Bataan', organizer: { self: true },
    start: { date: F }, end: { date: '2026-11-11' } }), 'ocupado');
});

test('cita a mano con sede en la ubicación ocupa solo esa ciudad', () => {
  const oc = ocupadosDe(ev('Cita — María', '17:30', '18:30', { location: 'Bataan' }));
  assert.equal(turnoOcupado(F, '17:30', BATAAN, oc), true);
  assert.equal(turnoOcupado(F, '17:30', NUMANCIA, oc), false);
});

test('citas de la BD se comparan por intervalo (9:00 choca con 9:30)', () => {
  const oc = ocupadosDeCitas([{ fecha: F, hora: '09:00', sede: NUMANCIA }]);
  assert.equal(turnoOcupado(F, '09:30', ECO, oc), true);
  assert.equal(turnoOcupado(F, '10:00', ECO, oc), false);
  assert.equal(turnoOcupado(F, '09:30', BATAAN, oc), false);
});

test('horas de Google en otra zona horaria se pasan a hora de Costa Rica', () => {
  const iv = intervaloDeEvento({ start: { dateTime: '2026-11-10T23:30:00Z' }, end: { dateTime: '2026-11-11T00:30:00Z' } });
  assert.deepEqual(fechaHoraCR(iv.inicio), { fecha: F, hora: '17:30' });
  assert.deepEqual(libres(BATAAN, [{ ...iv, sede: null }]), ['18:30']);
});

console.log(`\n${passed} pruebas de agenda pasaron`);
