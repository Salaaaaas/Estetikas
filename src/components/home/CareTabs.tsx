import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CareProtocol } from '../../data/home';

interface CareTabsProps {
  protocols: CareProtocol[];
}

const AUTOPLAY_MS = 10000;

const ICONS: Record<CareProtocol['icon'], ReactNode> = {
  clock: (
    <>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  layers: (
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </>
  ),
};

// Carrusel de cuidados post-tratamiento: avanza solo cada 10 s (salvo con
// movimiento reducido o pestaña oculta); al elegir un punto se reinicia el ciclo.
export default function CareTabs({ protocols }: CareTabsProps) {
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion.current) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((i) => (i + 1) % protocols.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [protocols.length, cycle]);

  return (
    <>
      <div className="relative max-w-[1200px] mx-auto h-[480px] max-md:h-[650px]">
        {protocols.map((protocol, i) => {
          const isActive = i === active;
          return (
            <div
              key={protocol.title}
              aria-hidden={!isActive}
              className={[
                'absolute inset-0 flex items-center justify-center transition-[opacity,visibility] duration-[550ms] ease-out',
                isActive ? 'opacity-100 visible' : 'opacity-0 invisible',
              ].join(' ')}
            >
              <div
                className={[
                  'glass-strong grid grid-cols-[1fr_1.5fr] items-center gap-16 max-w-[1000px] p-14 rounded-[32px]',
                  'transition-[translate,opacity] duration-[550ms] ease-out',
                  'max-md:grid-cols-1 max-md:gap-8 max-md:px-6 max-md:py-10 max-md:text-center',
                  isActive ? 'translate-y-0' : 'translate-y-5',
                ].join(' ')}
              >
                <div>
                  <svg className="max-md:mx-auto max-md:size-20" width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONS[protocol.icon]}
                  </svg>
                </div>
                <div>
                  <span className="block mb-2 text-[0.85rem] font-semibold text-muted">{protocol.category}</span>
                  <h3 className="font-heading font-bold text-primary text-[2.2rem] mb-6">{protocol.title}</h3>
                  <ul className="list-none p-0">
                    {protocol.steps.map((step) => (
                      <li key={step} className="flex items-start gap-[1.2rem] mb-6 leading-[1.6] text-ink text-[1.1rem] max-md:text-left">
                        <svg className="shrink-0 mt-[0.2rem] text-primary" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-[1.2rem] mt-4">
        {protocols.map((protocol, i) => {
          const isActive = i === active;
          return (
            <button
              key={protocol.title}
              type="button"
              aria-label={protocol.dotLabel}
              aria-pressed={isActive}
              onClick={() => {
                setActive(i);
                setCycle((c) => c + 1);
              }}
              // Zona táctil de 44px invisible alrededor del punto de 12px
              className={[
                "relative size-3 rounded-full cursor-pointer transition-[scale,background-color] duration-200 ease-out before:content-[''] before:absolute before:-inset-4",
                isActive ? 'bg-primary scale-140 shadow-[0_0_15px_rgba(0,166,178,0.3)]' : 'bg-[rgba(0,166,178,0.15)]',
              ].join(' ')}
            />
          );
        })}
      </div>
    </>
  );
}
