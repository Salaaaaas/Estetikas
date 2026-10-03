// Contenido de la página de inicio. Los textos son los publicados; no editar sin revisión.

export const MARQUEE_TREATMENTS = [
  'Limpieza Facial',
  'Botox & Rellenos',
  'Exosomas',
  'Peelings Químicos',
  'Bioestimuladores',
  'Sueroterapia IV',
  'Masajes',
  'Mesoterapia',
  'Dermaplaning',
  'Depilación Láser',
  'Hollywood Peel',
  'Terapia Capilar',
];

export type TrustIcon = 'pin' | 'user' | 'smile';

export const TRUST_ITEMS: { icon: TrustIcon; label: string }[] = [
  { icon: 'pin', label: '3 sedes en Costa Rica' },
  { icon: 'user', label: 'Médicas y especialistas certificadas' },
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
      'Médica con enfoque en estética regenerativa y armonización facial. Su objetivo es realzar tus rasgos sin cambiarlos: que te veas mejor, no distinta.',
      'Trabaja con protocolos médicos actualizados y productos certificados. Atiende en Guápiles y en jornadas especiales en Bataan.',
    ],
    cta: 'Agendar con la Dra. Karen',
  },
  {
    role: 'Especialista en Estética',
    nameLines: ['Katherine', 'Leitón Castillo'],
    photo: '/img/mami.webp',
    alt: 'Especialista Katherine Leitón Castillo',
    bio: [
      'Especialista certificada en tratamientos faciales. Está a cargo de las limpiezas faciales profundas en nuestra sede de Bataan.',
      'Detallista y paciente: revisa tu piel, te explica qué necesita y adapta cada limpieza a ti.',
    ],
    cta: 'Agendar con Katherine',
  },
  {
    role: 'Especialista Corporal',
    nameLines: ['Dra. Mónica', 'Gamboa Calderón'],
    photo: '/img/dra_monica.webp',
    alt: 'Dra. Mónica Gamboa Calderón',
    bio: [
      'Especialista en cuidado corporal y bienestar físico.',
      'Está a cargo de la <strong>Sueroterapia</strong> intravenosa y de los <strong>Masajes</strong>: relajantes, descontracturantes, reductivos y drenaje linfático. Diseña cada sesión según lo que tu cuerpo necesita.',
    ],
    cta: 'Agendar con la Dra. Mónica',
  },
];

export const PHILOSOPHY_TAGS = ['Criterio Médico', 'Resultados Naturales', 'Productos Certificados'];

export interface Specialty {
  title: string;
  description: string;
  items: string[];
}

export const SPECIALTIES: Specialty[] = [
  {
    title: 'Facial & Regeneración',
    description: 'Mejora la textura, las manchas y la luminosidad de tu piel.',
    items: ['Limpiezas Profundas y Dermaplaning', 'Peelings Químicos', 'Botox y Ácido Hialurónico', 'Hollywood Peel y Revitaskin', 'Terapia Capilar Regenerativa'],
  },
  {
    title: 'Bioestimulación',
    description: 'Estimula tu propio colágeno para recuperar firmeza y definir el contorno del rostro.',
    items: ['Bioestimuladores de Colágeno', 'Perfilado Facial y Doble Mentón', 'Redensificación de Cuello y Escote', 'Reestructuración de Manos'],
  },
  {
    title: 'Cuidado Corporal',
    description: 'Moldea tu silueta, relaja tu cuerpo y repón vitaminas y nutrientes.',
    items: ['Sueroterapia Vitamínica Intravenosa', 'Masajes Relajantes, Reductivos y más', 'Mesoterapia Reductiva y Estrías', 'Depilación Láser y Hongos en Uñas'],
  },
];

export interface CareProtocol {
  category: string;
  title: string;
  /** Icono decorativo grande de la tarjeta */
  icon: 'clock' | 'heart' | 'layers';
  /** Nombre del punto de navegación para lectores de pantalla */
  dotLabel: string;
  steps: string[];
}

export const CARE_PROTOCOLS: CareProtocol[] = [
  {
    category: 'Protocolo Esencial',
    title: 'Faciales & Limpiezas',
    icon: 'clock',
    dotLabel: 'Cuidados faciales',
    steps: [
      'No tocar ni lavar el rostro durante las primeras 8-12 horas.',
      'Uso estricto de bloqueador solar cada 4 horas.',
      'Evitar vapor y maquillaje pesado por 24 horas.',
    ],
  },
  {
    category: 'Post-Procedimiento',
    title: 'Inyectables (Botox & Rellenos)',
    icon: 'heart',
    dotLabel: 'Cuidados de inyectables',
    steps: [
      'No tocar ni masajear la zona tratada por 4 horas.',
      'Evitar ejercicio intenso y calor (sauna, sol) por 24 horas.',
      'Mantener la cabeza erguida las primeras 4 horas.',
    ],
  },
  {
    category: 'Recuperación Corporal',
    title: 'Tratamientos Corporales',
    icon: 'layers',
    dotLabel: 'Cuidados corporales',
    steps: [
      'Hidratación abundante: mínimo 2 litros de agua al día.',
      'Evitar piscinas, mar o tina por las primeras 24 horas.',
      'Usar ropa holgada sobre las zonas tratadas.',
    ],
  },
];

export interface FaqItem {
  q: string;
  /** Respuesta; admite <strong> */
  a: string;
}

export const FAQ: FaqItem[] = [
  { q: '¿Necesito una valoración antes de mi primer tratamiento?', a: 'Sí. En la valoración revisamos tu piel, tu historial y lo que quieres lograr, y con eso armamos un plan seguro y hecho para ti. Escríbenos por WhatsApp para conocer el costo y la disponibilidad.' },
  { q: '¿Los tratamientos son dolorosos?', a: 'La mayoría solo causa una leve sensación de calor o presión. Cuando hace falta, aplicamos crema anestésica antes de empezar.' },
  { q: '¿Con cuánta anticipación debo agendar mi cita?', a: 'Te recomendamos reservar con 2 o 3 días de anticipación para conseguir el horario que prefieres. Puedes hacerlo desde este sitio o por WhatsApp.' },
  { q: '¿Dónde están las sedes?', a: 'Tenemos tres: una en <strong>Bataan</strong> (Clínica ODONTOBATAAN) y dos en <strong>Guápiles</strong> (Clínica Medical Numancia y Eco Clinic). Al reservar eliges la sede y ves los horarios disponibles.' },
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
  { value: 'capilar', label: 'Terapia Capilar' },
  { value: 'corporal', label: 'Tratamiento Corporal' },
  { value: 'otro', label: 'Otro' },
];
