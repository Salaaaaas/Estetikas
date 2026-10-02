// Categorías de /tratamientos. `name` debe coincidir con `category` del frontmatter
// de cada tratamiento en src/content/tratamientos/.

export interface TreatmentCategory {
  name: string;
  slug: string;
  desc: string;
  /** id del tratamiento que encabeza la categoría como tarjeta destacada */
  featured: string;
}

export const TREATMENT_CATEGORIES: TreatmentCategory[] = [
  {
    name: 'Facial & Regeneración',
    slug: 'facial-regeneracion',
    desc: 'Limpieza, textura y luminosidad: protocolos faciales que devuelven la salud de tu piel con respaldo médico.',
    featured: 'limpieza-facial',
  },
  {
    name: 'Bioestimulación & Contorno',
    slug: 'bioestimulacion-contorno',
    desc: 'Activa tu propio colágeno y recupera la estructura natural del rostro, sin resultados artificiales.',
    featured: 'bioestimuladores-colageno',
  },
  {
    name: 'Cuidado Corporal',
    slug: 'cuidado-corporal',
    desc: 'Silueta, recuperación y bienestar desde adentro: terapias corporales diseñadas para tu cuerpo.',
    featured: 'sueroterapia',
  },
];
