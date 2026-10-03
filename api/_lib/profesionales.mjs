// Reglas de sede por profesional. Módulo puro (sin Supabase): lo usan
// create-booking en el servidor y el formulario de reservas en el navegador.
// Espejo SQL: supabase/schema_profesional_sede.sql — si cambias la
// asignación o el margen aquí, cámbialos también allí.
//
// Una persona no puede estar en dos ciudades el mismo día. Dentro de
// Guápiles (Medical Numancia y Eco Clinic) la Dra. Karen sí puede atender en
// los dos locales, siempre que entre una cita y otra en distinto local haya
// al menos MARGEN_ENTRE_SEDES_MIN de diferencia. Katherine y la Dra. Mónica
// atienden en una sola sede por día.

export const MARGEN_ENTRE_SEDES_MIN = 120;

/** @typedef {'karen' | 'katherine' | 'monica'} Profesional */

/** @type {Record<string, Profesional>} */
const PROFESIONAL_POR_SLUG = {
  'limpieza-facial': 'katherine',
  masajes: 'monica',
  sueroterapia: 'monica',
};

/** Profesionales que pueden cambiar de local dentro de la misma ciudad. */
const CAMBIA_DE_LOCAL = new Set(['karen']);

export const NOMBRE_PROFESIONAL = {
  karen: 'la Dra. Karen',
  katherine: 'Katherine',
  monica: 'la Dra. Mónica',
};

/** @param {string} slug @returns {Profesional} */
export function profesionalDe(slug) {
  return PROFESIONAL_POR_SLUG[slug] ?? 'karen';
}

/** @param {string[]} slugs @returns {Set<Profesional>} */
export function profesionalesDe(slugs) {
  return new Set(slugs.map(profesionalDe));
}

/** Espejo de public.sede_ciudad y de ciudadDeSede en get-availability. */
export function ciudadDeSede(sede) {
  return sede?.startsWith('Bataan') ? 'Bataan' : 'Guápiles';
}

/** "17:30" → 1050 */
export function minutosDeHora(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Una cita puede traer los slugs (servidor) o ya las profesionales (navegador). */
function profesionalesDeCita(cita) {
  return cita.profesionales ? new Set(cita.profesionales) : profesionalesDe(cita.slugs);
}

/**
 * Comprueba una cita nueva contra las citas activas del mismo día.
 *
 * @param {{ sede: string, hora: string, slugs?: string[], profesionales?: Profesional[] }} nueva
 * @param {{ sede: string, hora: string, slugs?: string[], profesionales?: Profesional[] }[]} delDia
 * @returns {null | { profesional: Profesional, sede: string, hora: string, motivo: 'ciudad' | 'sede' | 'margen' }}
 */
export function conflictoDeSede(nueva, delDia) {
  const profs = profesionalesDeCita(nueva);
  for (const cita of delDia) {
    if (cita.sede === nueva.sede) continue;
    for (const p of profesionalesDeCita(cita)) {
      if (!profs.has(p)) continue;
      if (ciudadDeSede(cita.sede) !== ciudadDeSede(nueva.sede)) {
        return { profesional: p, sede: cita.sede, hora: cita.hora, motivo: 'ciudad' };
      }
      if (!CAMBIA_DE_LOCAL.has(p)) {
        return { profesional: p, sede: cita.sede, hora: cita.hora, motivo: 'sede' };
      }
      if (Math.abs(minutosDeHora(cita.hora) - minutosDeHora(nueva.hora)) < MARGEN_ENTRE_SEDES_MIN) {
        return { profesional: p, sede: cita.sede, hora: cita.hora, motivo: 'margen' };
      }
    }
  }
  return null;
}

/** "Guápiles (Eco Clinic)" → "Eco Clinic" */
function localCorto(sede) {
  return sede.match(/\(([^)]+)\)/)?.[1] ?? sede;
}

/** "17:30" → "5:30 PM" */
function hora12(hora) {
  const min = minutosDeHora(hora);
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Mensaje para la clienta a partir del resultado de conflictoDeSede. */
export function mensajeConflicto(c) {
  const quien = NOMBRE_PROFESIONAL[c.profesional];
  const Quien = quien.charAt(0).toUpperCase() + quien.slice(1);
  if (c.motivo === 'margen') {
    return `${Quien} tiene una cita en ${localCorto(c.sede)} a las ${hora12(c.hora)} y necesita al menos 2 horas para cambiar de local. Elige otra hora o esa misma sede.`;
  }
  return `Este día ${quien} atiende en ${localCorto(c.sede)}. Elige esa sede u otra fecha.`;
}
