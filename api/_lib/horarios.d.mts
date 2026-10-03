export interface WeeklySession {
  id: string;
  type: 'weekly';
  /** 0 = domingo … 6 = sábado */
  weekdays: number[];
  /** "5:30 PM – 7:30 PM" */
  hours: string;
  label: string;
  /** ids de tratamientos que cubre; '*' = todos */
  forIds: string[];
  sede?: string;
}

export interface DateSession {
  id: string;
  type: 'date';
  /** YYYY-MM-DD */
  date: string;
  hours: string;
  label: string;
  forIds: string[];
  sede?: string;
}

export type Session = WeeklySession | DateSession;

export interface Slot {
  label: string;
  time24: string;
}

export const LIMPIEZA_ID: 'limpieza-facial';
export const SCHEDULE_WEEKLY: WeeklySession[];
export const SCHEDULE_DATES: DateSession[];
export function generateSlots(hours: string): Slot[];
export function getApplicableSchedules(schedule: Session[], cartIds: string[]): Session[];
export function getSessionsForDate(dateStr: string, schedules: Session[]): Session[];
export function sessionsForSede(sessions: Session[], sede: string): Session[];
export function horasOfrecidas(fecha: string, sede: string, slugs: string[], calendarSessions?: Session[]): Set<string>;
