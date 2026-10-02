import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { clearCart, getCart, getServerCart, removeFromCart, showToast, subscribeCart } from '../../lib/cart';
import {
  SCHEDULE_DATES,
  SCHEDULE_WEEKLY,
  SEDE_OPTIONS,
  buildAvailableSet,
  computeFullDays,
  computeSedeRules,
  generateSlots,
  getApplicableSchedules,
  getSessionsForDate,
  sessionsForSede,
  type Session,
} from '../../lib/booking/schedule';
import {
  buildPayload,
  createBooking,
  fetchBookedTimes,
  fetchCalendarSchedule,
  fetchLimpiezaSede,
  fetchMonthAvailability,
} from '../../lib/booking/api';
import Calendar from './Calendar';
import { useTurnstile } from './useTurnstile';

// ---- Estilos compartidos -------------------------------------------------
const sectionClass = 'py-7 border-b border-black/6 last-of-type:border-b-0';
const titleClass = 'font-heading text-[1.1rem] font-bold text-ink tracking-[-0.02em] leading-[1.2] mb-5 max-ph:text-[1rem]';
const gridClass = 'grid grid-cols-2 gap-4 max-ph:grid-cols-1';
const fieldClass = 'flex flex-col gap-[0.4rem]';
const labelClass = 'text-[0.82rem] font-medium text-body';
const controlClass =
  'w-full px-4 py-[0.85rem] border-[1.5px] border-black/12 rounded-lg bg-white font-body text-[0.95rem] text-ink outline-none appearance-none transition-[border-color,box-shadow] duration-200 ease-out focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,125,136,0.1)]';
const selectWrap =
  "relative after:content-[''] after:pointer-events-none after:absolute after:right-4 after:top-1/2 after:-translate-y-1/2 after:size-0 after:border-x-[4.5px] after:border-x-transparent after:border-t-[5.5px] after:border-t-primary";
const selectClass = `${controlClass} pr-10 [&_option:disabled]:text-[#b0b0b0]`;

// ---- Tipos del selector de horario --------------------------------------
type TimeState =
  | { kind: 'message'; text: string; disabled?: boolean }
  | { kind: 'slots'; groups: { label: string; slots: { value: string; label: string; booked: boolean }[] }[]; available: number };

const NO_DATE: TimeState = { kind: 'message', text: 'Selecciona una fecha primero' };

interface FormFields {
  name: string;
  phone: string;
  sede: string;
  date: string;
  time: string;
  notes: string;
  consent: boolean;
}

const EMPTY_FORM: FormFields = { name: '', phone: '', sede: '', date: '', time: '', notes: '', consent: false };

export default function BookingForm() {
  const cart = useSyncExternalStore(subscribeCart, getCart, getServerCart);
  const cartIds = useMemo(() => cart.map((i) => i.id), [cart]);

  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const set = <K extends keyof FormFields>(key: K, value: FormFields[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Horarios: semanales + fechas fijas al instante; Google Calendar después.
  const [schedule, setSchedule] = useState<Session[]>(() => [...SCHEDULE_WEEKLY, ...SCHEDULE_DATES]);
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [fullDays, setFullDays] = useState<Set<string>>(new Set());
  const [allowedSedes, setAllowedSedes] = useState<Set<string> | null>(null);
  const [sedeHint, setSedeHint] = useState('');
  const [timeState, setTimeState] = useState<TimeState>(NO_DATE);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const turnstileBox = useRef<HTMLDivElement>(null);
  const turnstile = useTurnstile(turnstileBox);
  const successRef = useRef<HTMLDivElement>(null);
  // Evita que una respuesta lenta de una fecha anterior pise la actual
  const dateRequest = useRef(0);

  const schedules = useMemo(() => getApplicableSchedules(schedule, cartIds), [schedule, cartIds]);
  const available = useMemo(() => buildAvailableSet(schedules), [schedules]);

  useEffect(() => {
    let cancelled = false;
    fetchCalendarSchedule().then((extra) => {
      if (!cancelled && extra.length > 0) {
        setSchedule([...SCHEDULE_WEEKLY, ...SCHEDULE_DATES, ...extra]);
        setFullDays(new Set());
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Días llenos del mes visible
  useEffect(() => {
    let cancelled = false;
    fetchMonthAvailability(view.year, view.month + 1)
      .then((grouped) => { if (!cancelled) setFullDays(computeFullDays(available, schedules, grouped)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [view, available, schedules]);

  const loadTimes = useCallback(async (sessions: Session[], date: string, request: number) => {
    if (!sessions.length) {
      setTimeState({ kind: 'message', text: 'Sin horario para esta fecha' });
      return;
    }
    setTimeState({ kind: 'message', text: 'Cargando horarios...', disabled: true });
    const booked = await fetchBookedTimes(date);
    if (request !== dateRequest.current) return;

    let total = 0;
    let free = 0;
    const groups = sessions
      .map((s) => ({
        label: s.label,
        slots: generateSlots(s.hours).map((slot) => {
          total++;
          const isBooked = booked.has(slot.time24);
          if (!isBooked) free++;
          return { value: slot.time24, label: isBooked ? `${slot.label} — Ocupado` : slot.label, booked: isBooked };
        }),
      }))
      .filter((g) => g.slots.length > 0);

    if (total === 0) setTimeState({ kind: 'message', text: 'Sin horarios configurados' });
    else if (free === 0) setTimeState({ kind: 'message', text: 'Todos los horarios están ocupados' });
    else setTimeState({ kind: 'slots', groups, available: free });
  }, []);

  const onSelectDate = async (date: string) => {
    const request = ++dateRequest.current;
    setForm((f) => ({ ...f, date, time: '' }));
    const sessions = getSessionsForDate(date, schedules);

    const locked = cartIds.includes('limpieza-facial') ? await fetchLimpiezaSede(date) : null;
    if (request !== dateRequest.current) return;
    const { allowed, hint } = computeSedeRules(sessions, cartIds, locked);
    setAllowedSedes(allowed);
    setSedeHint(hint);

    let sede = form.sede;
    if (sede && !allowed.has(sede)) sede = '';
    if (allowed.size === 1) sede = [...allowed][0];
    setForm((f) => ({ ...f, sede }));

    loadTimes(sessionsForSede(sessions, sede), date, request);
  };

  const onSedeChange = (sede: string) => {
    setForm((f) => ({ ...f, sede, time: '' }));
    if (!form.date) return;
    const request = ++dateRequest.current;
    loadTimes(sessionsForSede(getSessionsForDate(form.date, schedules), sede), form.date, request);
  };

  const changeMonth = (delta: number) => {
    setView(({ year, month }) => {
      const m = month + delta;
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
    setFullDays(new Set());
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fields = { ...form, name: form.name.trim(), phone: form.phone.trim(), notes: form.notes.trim() };
    if (!fields.name || !fields.phone || !fields.sede || !fields.date || !fields.time) {
      showToast('Por favor completa los campos requeridos (*)');
      return;
    }
    if (cart.length === 0) { showToast('Selecciona al menos un tratamiento para continuar'); return; }
    if (!fields.consent) { showToast('Debes aceptar el tratamiento de datos para continuar'); return; }

    setSubmitting(true);
    const result = await createBooking(buildPayload(fields, cart, turnstile.getToken()));
    setSubmitting(false);

    if (!result.ok) {
      showToast(result.message);
      if (!result.message.startsWith('Error de conexión')) turnstile.reset();
      return;
    }
    clearCart();
    setForm(EMPTY_FORM);
    turnstile.reset();
    setDone(true);
  };

  useEffect(() => {
    if (done) successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [done]);

  if (done) {
    return (
      <div ref={successRef} className="flex flex-col items-center text-center gap-4 px-4 py-12">
        <div className="flex items-center justify-center size-16 mb-2 rounded-full bg-primary/12 text-primary" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 className="font-heading font-bold text-ink text-[clamp(1.6rem,3vw,2rem)] tracking-[-0.02em] leading-[1.1]">¡Solicitud recibida!</h2>
        <p className="text-muted max-w-[42ch] leading-[1.55]">Te contactaremos por WhatsApp en menos de 24 horas para confirmar tu cita.</p>
        <a href="/" className="btn mt-4 px-8 py-[0.85rem]">Volver al inicio</a>
      </div>
    );
  }

  return (
    <>
      {cart.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 pt-8 pb-6 mb-8 border-b border-black/6 text-muted text-[0.95rem]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.25" opacity="0.5" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          <p>Tu lista de tratamientos está vacía.</p>
          <a href="/tratamientos" className="btn mt-1 px-[1.4rem] py-[0.65rem] text-[0.82rem]">Explorar tratamientos</a>
        </div>
      ) : (
        <div>
          <section className="py-7">
            <h2 className={titleClass}>
              Tratamientos seleccionados{' '}
              <span className="font-body text-[0.9rem] font-medium tracking-normal text-muted">({cart.length})</span>
            </h2>
            <ul className="flex flex-col gap-[0.4rem] list-none p-0 m-0">
              {cart.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-[0.6rem] pr-3 pl-[0.9rem] bg-surface border border-black/5 rounded-[10px]">
                  <span className="flex items-center justify-center shrink-0 size-[22px] rounded-full bg-primary/10 text-primary" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                  <span className="flex-1 text-[0.92rem] font-normal text-ink">{item.name}</span>
                  <button
                    type="button"
                    aria-label={`Eliminar ${item.name}`}
                    onClick={() => removeFromCart(item.id)}
                    className="flex items-center justify-center shrink-0 size-[30px] rounded-full border-0 bg-transparent text-black/28 cursor-pointer transition-[background-color,color] duration-[160ms] ease-out hover:bg-[#fee2e2] hover:text-[#dc2626]"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <form id="booking-form" className="flex flex-col" noValidate onSubmit={onSubmit}>
        <section className={sectionClass}>
          <h2 className={titleClass}>Datos de contacto</h2>
          <div className={gridClass}>
            <div className={fieldClass}>
              <label htmlFor="b-name" className={labelClass}>Nombre completo *</label>
              <input type="text" id="b-name" placeholder="Tu nombre completo" required autoComplete="name" className={controlClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className={fieldClass}>
              <label htmlFor="b-phone" className={labelClass}>Teléfono / WhatsApp *</label>
              <input type="tel" id="b-phone" placeholder="+506 XXXX XXXX" required autoComplete="tel" className={controlClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className={`${fieldClass} col-span-full`}>
              <label htmlFor="b-sede" className={labelClass}>Sede de preferencia *</label>
              <div className={selectWrap}>
                <select id="b-sede" required className={selectClass} value={form.sede} onChange={(e) => onSedeChange(e.target.value)}>
                  <option value="" disabled>Selecciona una sede...</option>
                  {SEDE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} disabled={allowedSedes ? !allowedSedes.has(o.value) : false}>{o.label}</option>
                  ))}
                </select>
              </div>
              {sedeHint && <p id="b-sede-hint" className="mt-2 text-[0.8rem] leading-[1.45] text-primary">{sedeHint}</p>}
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={titleClass}>Fecha y horario</h2>
          <div className={gridClass}>
            <div className={`${fieldClass} col-span-full`}>
              <span className={labelClass}>Fecha preferida</span>
              <Calendar
                year={view.year}
                month={view.month}
                selected={form.date || null}
                available={available}
                full={fullDays}
                noSessions={schedules.length === 0}
                onSelect={onSelectDate}
                onPrev={() => changeMonth(-1)}
                onNext={() => changeMonth(1)}
              />
            </div>
            <div className={`${fieldClass} col-span-full`}>
              <label htmlFor="b-time" className={labelClass}>Horario disponible</label>
              <div className={selectWrap}>
                <select
                  id="b-time"
                  className={selectClass}
                  value={form.time}
                  disabled={timeState.kind === 'message' && timeState.disabled}
                  onChange={(e) => set('time', e.target.value)}
                >
                  {timeState.kind === 'message' ? (
                    <option value="">{timeState.text}</option>
                  ) : (
                    <>
                      <option value="">{`Selecciona un horario (${timeState.available} disponible${timeState.available !== 1 ? 's' : ''})`}</option>
                      {timeState.groups.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.slots.map((s) => (
                            <option key={s.value} value={s.value} disabled={s.booked}>{s.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={titleClass}>Información adicional</h2>
          <div className={gridClass}>
            <div className={`${fieldClass} col-span-full`}>
              <label htmlFor="b-notes" className={labelClass}>Notas (opcional)</label>
              <textarea id="b-notes" rows={3} maxLength={500} placeholder="Condición médica relevante, alergias, preguntas..." className={`${controlClass} resize-y min-h-[90px] leading-[1.5]`} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
            <div className={`${fieldClass} col-span-full mt-1`}>
              <label className="flex items-start gap-[10px] text-[0.82rem] font-medium leading-[1.5] text-body cursor-pointer select-none">
                <input type="checkbox" id="b-consent" required className="shrink-0 mt-[3px] size-[18px] accent-primary cursor-pointer" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} />
                <span>
                  Acepto el{' '}
                  <a href="/privacidad" target="_blank" rel="noopener" className="text-primary underline underline-offset-2 hover:text-primary-hover">tratamiento de mis datos personales</a>{' '}
                  conforme a la Ley 8968 para gestionar mi cita.
                </span>
              </label>
            </div>
            <div className={`${fieldClass} col-span-full`}>
              <div id="b-turnstile" ref={turnstileBox} className="flex justify-center min-h-[65px]" />
            </div>
          </div>
        </section>

        <div className="pt-8">
          <button
            type="submit"
            id="reservar-submit-btn"
            disabled={submitting}
            className="btn group w-full flex items-center justify-center gap-[0.65rem] px-6 py-[1.05rem] rounded-[10px] text-[1rem] font-semibold transition-[background-color,transform] duration-100 ease-out disabled:opacity-70 disabled:cursor-wait active:[transform:translateY(1px)] max-ph:px-5 max-ph:py-4"
          >
            {submitting ? 'Enviando...' : (
              <>
                Confirmar reserva
                <span className="flex items-center justify-center shrink-0 size-7 rounded-full bg-white/18 transition-[background-color,translate] duration-[180ms] ease-out group-hover:bg-white/28 group-hover:translate-x-0.5" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </span>
              </>
            )}
          </button>
          <p className="mt-[0.85rem] text-[0.78rem] leading-[1.45] text-muted text-center">Te contactaremos por WhatsApp en menos de 24 horas para confirmar.</p>
        </div>
      </form>
    </>
  );
}
