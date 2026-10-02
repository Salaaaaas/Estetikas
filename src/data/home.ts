// Contenido de la página de inicio. Los textos son los publicados; no editar sin revisión.

export const MARQUEE_TREATMENTS = [
  'Limpieza Facial',
  'Botox & Rellenos',
  'Exosomas',
  'Peelings Químicos',
  'Bioestimuladores',
  'Sueroterapia IV',
  'Masajes Avanzados',
  'Mesoterapia',
  'Dermaplaning',
  'Depilación LDI',
];

export type TrustIcon = 'pin' | 'user' | 'smile';

export const TRUST_ITEMS: { icon: TrustIcon; label: string }[] = [
  { icon: 'pin', label: '3 sedes en Costa Rica' },
  { icon: 'user', label: 'Médicos especialistas certificados' },
  { icon: 'smile', label: 'Resultados armónicos y naturales' },
];

export interface TeamMember {
  role: string;
  /** Nombre en dos líneas, tal como se muestra */
  nameLines: [string, string];
  photo: string;
  alt: string;
  /** Párrafos de la bio; admiten <strong> */
  bio: string[];
  cta: string;
}

export const TEAM: TeamMember[] = [
  {
    role: 'Medicina Estética',
    nameLines: ['Dra. Karen', 'Mayorga Quirós'],
    photo: '/img/dr_karen.webp',
    alt: 'Dra. Karen Mayorga Quirós',
    bio: [
      'Médico especializada en estética regenerativa y armonización facial. Su enfoque, respaldado por actualización constante en tendencias globales, se basa en realzar la belleza natural de cada paciente.',
      'Garantiza tratamientos seguros y personalizados con protocolos médicos actualizados y productos certificados de la más alta calidad.',
    ],
    cta: 'Agendar con la Dra. Karen',
  },
  {
    role: 'Especialista en Estética',
    nameLines: ['Katherine', 'Leitón Castillo'],
    photo: '/img/mami.webp',
    alt: 'Especialista Katherine Leitón Castillo',
    bio: [
      'Especialista certificada en tratamientos faciales avanzados. Su pasión por el cuidado de la piel la ha llevado a dominar técnicas exclusivas que combinan bienestar con resultados visibles desde la primera sesión.',
      'Su calidez y enfoque detallista aseguran que cada visita sea una atención cuidada, con resultados visibles y un trato cercano.',
    ],
    cta: 'Agendar con Katherine',
  },
  {
    role: 'Especialista Corporal',
    nameLines: ['Dra. Mónica', 'Gamboa Calderón'],
    photo: '/img/dra_monica.webp',
    alt: 'Dra. Mónica Gamboa Calderón',
    bio: [
      'Especialista encargada de llevar el cuidado corporal a otro nivel. Meticulosa y conocedora del bienestar físico, domina un amplio espectro de técnicas manuales y terapias sistémicas.',
      'Experta residente en <strong>Sueroterapia</strong> intravenosa y en <strong>Masajes</strong> avanzados: drenajes linfáticos, técnicas descontracturantes y reductivas, diseñando terapias únicas para la recuperación total del cuerpo.',
    ],
    cta: 'Agendar con la Dra. Mónica',
  },
];

export const PHILOSOPHY_TAGS = ['Abordaje Médico Integral', 'Resultados Naturales', 'Máxima Calidad'];

export interface Specialty {
  title: string;
  description: string;
  items: string[];
}

export const SPECIALTIES: Specialty[] = [
  {
    title: 'Facial & Regeneración',
    description: 'Revitaliza la textura y luminosidad de tu piel con protocolos clínicamente respaldados.',
    items: ['Limpiezas Profundas y Dermaplaning', 'Peelings Químicos', 'Botox y Ácido Hialurónico', 'Exosomas y ADN de Salmón'],
  },
  {
    title: 'Bioestimulación',
    description: 'Activa tu producción interna de colágeno y recupera la estructura natural del rostro.',
    items: ['Bioestimuladores de Colágeno', 'Perfilado Facial y Doble Mentón', 'Redensificación de Cuello y Escote', 'Reestructuración de Manos'],
  },
  {
    title: 'Cuidado Corporal',
    description: 'Soluciones integrales para esculpir tu silueta, recuperar el bienestar y regenerar desde adentro.',
    items: ['Sueroterapia Vitamínica Intravenosa', 'Masajes Relajantes, Reductivos y más', 'Mesoterapia Reductiva y Estrías', 'Lunares y Depilación LDI'],
  },
];

export interface CareProtocol {
  category: string;
  title: string;
  steps: string[];
}

export const CARE_PROTOCOLS: CareProtocol[] = [
  {
    category: 'Protocolo Esencial',
    title: 'Faciales & Limpiezas',
    steps: [
      'No tocar ni lavar el rostro durante las primeras 8-12 horas.',
      'Uso estricto de bloqueador solar cada 4 horas.',
      'Evitar vapor y maquillaje pesado por 24 horas.',
    ],
  },
  {
    category: 'Post-Procedimiento',
    title: 'Inyectables (Botox & Rellenos)',
    steps: [
      'No tocar ni masajear la zona tratada por 4 horas.',
      'Evitar ejercicio intenso y calor (sauna, sol) por 24 horas.',
      'Mantener la cabeza erguida las primeras 4 horas.',
    ],
  },
  {
    category: 'Recuperación Corporal',
    title: 'Tratamientos Corporales',
    steps: [
      'Hidratación abundante: mínimo 2 litros de agua al día.',
      'Evitar piscinas, mar o tina por las primeras 24 horas.',
      'Usar ropa holgada sobre las zonas tratadas.',
    ],
  },
];

export interface Testimonial {
  quote: string;
  name: string;
  initial: string;
  detail: string;
}

export const TESTIMONIAL_FEATURED: Testimonial = {
  quote: "Llevaba años frustrada con mis imperfecciones y en Esteti'Kas encontré la solución. Katherine es una experta total, muy detallista y con mucha paciencia.",
  name: 'Sofía V.',
  initial: 'S',
  detail: 'Tratamiento de Estrías · Bataan',
};

export const TESTIMONIALS_COMPACT: Testimonial[] = [
  {
    quote: 'Desde la primera sesión noté la diferencia. La Dra. Karen es increíblemente profesional y su trato es muy cálido. Mi piel luce como nunca.',
    name: 'Karol B.',
    initial: 'K',
    detail: 'Limpieza Facial & Peelings · Limón',
  },
  {
    quote: 'El ambiente es muy profesional y la atención personalizada hace toda la diferencia. Volvería mil veces.',
    name: 'Adriana M.',
    initial: 'A',
    detail: 'Mesoterapia Corporal · Guápiles',
  },
];

export interface FaqItem {
  q: string;
  /** Respuesta; admite <strong> */
  a: string;
}

export const FAQ: FaqItem[] = [
  { q: '¿Necesito hacer una consulta antes de mi primer tratamiento?', a: 'Sí, siempre realizamos una valoración inicial gratuita para analizar tu tipo de piel, condición y objetivos. Esto nos permite diseñar un plan de tratamiento 100% personalizado y seguro para ti.' },
  { q: '¿Los tratamientos son dolorosos?', a: 'La mayoría de nuestros procedimientos son indoloros o generan una leve sensación de calor o presión. Para tratamientos que requieran mayor precisión aplicamos cremas anestésicas tópicas. Tu comodidad es siempre nuestra prioridad.' },
  { q: '¿Con cuánta anticipación debo agendar mi cita?', a: 'Recomendamos agendar con al menos 2 a 3 días de anticipación para garantizar disponibilidad en tu horario preferido. Puedes hacerlo directamente desde este sitio web o por WhatsApp, ¡en segundos!' },
  { q: '¿Tienen disponibilidad en las tres sedes?', a: 'Sí, contamos con tres sedes: una en <strong>Bataan</strong> (Clínica ODONTOBATAAN) y dos en <strong>Guápiles</strong> (Clínica Medical Numancia y Eco Clinic). Al momento de agendar puedes indicar tu sede de preferencia y te confirmamos disponibilidad.' },
];

export interface TreatmentOption {
  value: string;
  label: string;
}

export const CONTACT_TREATMENTS: TreatmentOption[] = [
  { value: 'limpieza', label: 'Limpieza Facial Profunda' },
  { value: 'botox', label: 'Botox & Traptox' },
  { value: 'rellenos', label: 'Rellenos con Ácido Hialurónico' },
  { value: 'regeneracion', label: 'Regeneración Facial' },
  { value: 'corporal', label: 'Tratamiento Corporal' },
  { value: 'otro', label: 'Otro' },
];
