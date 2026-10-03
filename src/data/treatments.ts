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
    desc: 'Limpieza, textura y luminosidad: tratamientos faciales con respaldo médico.',
    featured: 'limpieza-facial',
  },
  {
    name: 'Bioestimulación & Contorno',
    slug: 'bioestimulacion-contorno',
    desc: 'Estimula tu propio colágeno y define el contorno del rostro, con resultados naturales.',
    featured: 'bioestimuladores-colageno',
  },
  {
    name: 'Cuidado Corporal',
    slug: 'cuidado-corporal',
    desc: 'Silueta, relajación y bienestar: tratamientos corporales pensados para ti.',
    featured: 'sueroterapia',
  },
];
