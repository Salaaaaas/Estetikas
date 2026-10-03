// Pruebas de las reglas de sede por profesional (api/_lib/profesionales.mjs).
// Ejecutar: node scripts/test-profesionales.mjs
import assert from 'node:assert/strict';
import { conflictoDeSede, mensajeConflicto, profesionalDe } from '../api/_lib/profesionales.mjs';

const BATAAN = 'Bataan (Clínica ODONTOBATAAN)';
const NUMANCIA = 'Guápiles (Clínica Medical Numancia)';
const ECO = 'Guápiles (Eco Clinic)';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { process.exitCode = 1; console.error(`  ✗ ${name}\n    ${err.message}`); }
}
const cita = (sede, hora, ...slugs) => ({ sede, hora, slugs });

test('asignación de profesionales', () => {
  assert.equal(profesionalDe('limpieza-facial'), 'katherine');
  assert.equal(profesionalDe('masajes'), 'monica');
  assert.equal(profesionalDe('sueroterapia'), 'monica');
  assert.equal(profesionalDe('botox'), 'karen');
  assert.equal(profesionalDe('terapia-capilar'), 'karen');
});

test('Katherine: segunda limpieza en otra sede el mismo día → conflicto', () => {
  const r = conflictoDeSede(cita(NUMANCIA, '18:30', 'limpieza-facial'), [cita(BATAAN, '17:30', 'limpieza-facial')]);
  assert.equal(r?.motivo, 'ciudad');
});

test('Katherine: otro local de la misma ciudad → conflicto (una sede por día)', () => {
  const r = conflictoDeSede(cita(ECO, '19:30', 'limpieza-facial'), [cita(NUMANCIA, '17:30', 'limpieza-facial')]);
  assert.equal(r?.motivo, 'sede');
});

test('Katherine: misma sede → permitido', () => {
  assert.equal(conflictoDeSede(cita(BATAAN, '18:30', 'limpieza-facial'), [cita(BATAAN, '17:30', 'limpieza-facial')]), null);
});

test('Dra. Karen: Bataan y Guápiles el mismo día → conflicto aunque haya horas de margen', () => {
  const r = conflictoDeSede(cita(NUMANCIA, '15:00', 'botox'), [cita(BATAAN, '08:00', 'peelings')]);
  assert.equal(r?.motivo, 'ciudad');
});

test('Dra. Karen: Numancia y Eco Clinic con 1 h de diferencia → conflicto por margen', () => {
  const r = conflictoDeSede(cita(ECO, '10:00', 'botox'), [cita(NUMANCIA, '09:00', 'rellenos')]);
  assert.equal(r?.motivo, 'margen');
});

test('Dra. Karen: Numancia y Eco Clinic con exactamente 2 h → permitido', () => {
  assert.equal(conflictoDeSede(cita(ECO, '11:00', 'botox'), [cita(NUMANCIA, '09:00', 'rellenos')]), null);
});

test('Dra. Karen: el margen aplica también hacia atrás', () => {
  const r = conflictoDeSede(cita(ECO, '08:00', 'botox'), [cita(NUMANCIA, '09:30', 'rellenos')]);
  assert.equal(r?.motivo, 'margen');
});

test('profesionales distintas no se bloquean entre sí', () => {
  assert.equal(conflictoDeSede(cita(NUMANCIA, '17:30', 'botox'), [cita(BATAAN, '17:30', 'limpieza-facial')]), null);
});

test('Dra. Mónica: masajes en dos locales → conflicto', () => {
  const r = conflictoDeSede(cita(ECO, '14:00', 'masajes'), [cita(NUMANCIA, '09:00', 'sueroterapia')]);
  assert.equal(r?.motivo, 'sede');
});

test('carrito mixto: choca si cualquiera de sus profesionales choca', () => {
  const r = conflictoDeSede(cita(ECO, '17:30', 'limpieza-facial', 'botox'), [cita(BATAAN, '17:30', 'limpieza-facial')]);
  assert.equal(r?.profesional, 'katherine');
});

test('el navegador puede pasar profesionales en vez de slugs', () => {
  const r = conflictoDeSede({ sede: ECO, hora: '10:00', slugs: ['botox'] }, [{ sede: NUMANCIA, hora: '09:00', profesionales: ['karen'] }]);
  assert.equal(r?.motivo, 'margen');
});

test('mensajes legibles', () => {
  assert.match(mensajeConflicto({ profesional: 'karen', sede: NUMANCIA, hora: '09:00', motivo: 'margen' }),
    /^La Dra\. Karen tiene una cita en Clínica Medical Numancia a las 9:00 AM/);
  assert.equal(mensajeConflicto({ profesional: 'katherine', sede: BATAAN, hora: '17:30', motivo: 'ciudad' }),
    'Este día Katherine atiende en Clínica ODONTOBATAAN. Elige esa sede u otra fecha.');
});

console.log(`\n${passed} comprobaciones pasaron${process.exitCode ? ' — HAY FALLOS' : ''}\n`);
