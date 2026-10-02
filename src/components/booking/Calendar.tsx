const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DOWS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

interface CalendarProps {
  year: number;
  /** 0–11 */
  month: number;
  selected: string | null;
  available: Set<string>;
  full: Set<string>;
  noSessions: boolean;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

interface Cell {
  day: number;
  date?: string;
  other?: boolean;
  past?: boolean;
  avail?: boolean;
  full?: boolean;
  today?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function buildCells(year: number, month: number, available: Set<string>, full: Set<string>): Cell[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, other: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad(month + 1)}-${pad(d)}`;
    const isFull = full.has(date);
    cells.push({
      day: d,
      date,
      past: new Date(`${date}T00:00:00`) < today,
      avail: available.has(date) && !isFull,
      full: isFull,
      today: date === todayStr,
    });
  }
  while (cells.length < 42) cells.push({ day: cells.length - firstDow - daysInMonth + 1, other: true });
  return cells;
}

const navBtn =
  'flex shrink-0 items-center justify-center size-8 rounded-full border border-black/9 bg-white text-ink cursor-pointer transition-[box-shadow,background-color] duration-[160ms] ease-out disabled:opacity-28 disabled:cursor-not-allowed disabled:shadow-none hover-fine:enabled:shadow-[0_2px_8px_rgba(0,0,0,0.1)]';

// Estado visual de un día. Una sola clase de color por estado (sin choques de cascada).
function dayClass({ isSel, canPick, full, today }: { isSel: boolean; canPick: boolean; full: boolean; today: boolean }): string {
  if (isSel) return 'bg-primary text-white font-semibold cursor-pointer';
  const todayRing = today ? 'shadow-[inset_0_0_0_1.5px_var(--color-primary)] ' : '';
  if (full) return `${todayRing}${today ? 'text-primary' : 'text-black/18'} line-through decoration-black/15 cursor-not-allowed`;
  if (canPick) {
    return `${todayRing}${today ? 'text-primary' : 'text-ink'} font-medium cursor-pointer after:content-[''] after:absolute after:bottom-[3px] after:left-1/2 after:-translate-x-1/2 after:size-[3px] after:rounded-full after:bg-primary hover-fine:bg-primary/8 hover-fine:text-primary active:scale-[0.86]`;
  }
  return `${todayRing}${today ? 'text-primary' : 'text-black/22'} cursor-not-allowed`;
}

export default function Calendar({ year, month, selected, available, full, noSessions, onSelect, onPrev, onNext }: CalendarProps) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const cells = buildCells(year, month, available, full);

  return (
    <div className="bg-surface border border-black/7 rounded-[14px] p-[0.9rem]" role="group" aria-label="Seleccionar fecha de cita">
      <div className="flex items-center justify-between mb-3">
        <button type="button" className={navBtn} aria-label="Mes anterior" disabled={isCurrentMonth} onClick={onPrev}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="font-heading text-[0.95rem] font-bold text-ink tracking-[-0.025em]">{MONTHS[month]} {year}</span>
        <button type="button" className={navBtn} aria-label="Mes siguiente" onClick={onNext}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-[2px]">
        {DOWS.map((d, i) => (
          <span key={i} className="text-center text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-muted pt-[0.15rem] pb-[0.45rem]">{d}</span>
        ))}
        {cells.map((c, i) => {
          const base = 'relative flex items-center justify-center aspect-square min-h-9 rounded-full border-0 bg-transparent font-body text-[0.8rem] max-ph:min-h-10 max-ph:text-[0.84rem]';
          if (c.other) return <span key={i} className={`${base} text-black/10 cursor-not-allowed`}>{c.day}</span>;
          const isSel = c.date === selected;
          const canPick = Boolean(c.avail && !c.past);
          return (
            <button
              key={i}
              type="button"
              disabled={c.past || !c.avail}
              aria-pressed={isSel}
              onClick={() => c.date && onSelect(c.date)}
              className={[
                base,
                'transition-[background-color,color,scale] duration-[130ms] ease-out',
                dayClass({ isSel, canPick, full: Boolean(c.full), today: Boolean(c.today) }),
              ].join(' ')}
            >
              {c.day}
            </button>
          );
        })}
      </div>
      {noSessions && (
        <p className="text-[0.78rem] text-muted mt-[0.65rem] text-center py-[0.4rem]">No hay sesiones disponibles para los tratamientos seleccionados.</p>
      )}
      {!selected && !noSessions && (
        <p className="flex items-center gap-[0.4rem] mt-[0.6rem] pt-[0.6rem] border-t border-black/5 text-[0.7rem] leading-[1.4] text-muted before:content-[''] before:size-1 before:shrink-0 before:rounded-full before:bg-primary">
          Los dias marcados tienen sesiones disponibles.
        </p>
      )}
    </div>
  );
}
