export type Profesional = 'karen' | 'katherine' | 'monica';

export interface CitaSede {
  sede: string;
  /** "HH:MM" */
  hora: string;
  slugs?: string[];
  profesionales?: Profesional[];
}

export interface ConflictoSede {
  profesional: Profesional;
  sede: string;
  hora: string;
  motivo: 'ciudad' | 'sede' | 'margen';
}

export const MARGEN_ENTRE_SEDES_MIN: number;
export const NOMBRE_PROFESIONAL: Record<Profesional, string>;
export function profesionalDe(slug: string): Profesional;
export function profesionalesDe(slugs: string[]): Set<Profesional>;
export function ciudadDeSede(sede: string | null | undefined): 'Bataan' | 'Guápiles';
export function minutosDeHora(hora: string): number;
export function conflictoDeSede(nueva: CitaSede, delDia: CitaSede[]): ConflictoSede | null;
export function mensajeConflicto(c: ConflictoSede): string;
