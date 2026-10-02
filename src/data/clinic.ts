// Datos de contacto de la clínica: única fuente para header, footer, contacto y scripts.

export const WA_PHONE = '50684320647';
export const WA_URL = `https://wa.me/${WA_PHONE}`;
export const PHONE_DISPLAY = '+506 8432 0647';
export const INSTAGRAM_URL = 'https://www.instagram.com/esteti_kas/';
export const INSTAGRAM_HANDLE = '@esteti_kas';

export interface Sede {
  city: 'Bataan' | 'Guápiles';
  /** Nombre corto (footer) */
  clinic: string;
  /** Nombre completo (sección de contacto) */
  fullName: string;
  mapsUrl: string;
}

export const SEDES: Sede[] = [
  {
    city: 'Bataan',
    clinic: 'ODONTOBATAAN',
    fullName: 'Clínica ODONTOBATAAN',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cl%C3%ADnica+ODONTOBATAAN+Bataan+Lim%C3%B3n+Costa+Rica',
  },
  {
    city: 'Guápiles',
    clinic: 'Medical Numancia',
    fullName: 'Clínica Medical Numancia',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cl%C3%ADnica+Medical+Numancia+Gu%C3%A1piles+Costa+Rica',
  },
  {
    city: 'Guápiles',
    clinic: 'Eco Clinic',
    fullName: 'Eco Clinic',
    mapsUrl: 'https://maps.app.goo.gl/8k4cr7GRKfzPFY3u9?g_st=ic',
  },
];
