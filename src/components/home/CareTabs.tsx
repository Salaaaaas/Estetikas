import { useState } from 'react';
import type { CareProtocol } from '../../data/home';

interface CareTabsProps {
  protocols: CareProtocol[];
}

// Pestañas de cuidados post-tratamiento. Sin autoplay: son instrucciones
// médicas y la paciente elige qué leer.
export default function CareTabs({ protocols }: CareTabsProps) {
  const [active, setActive] = useState(0);

  return (
    <>
      <div className="flex flex-wrap gap-[0.6rem] max-w-[1000px] mx-auto mb-5">
        {protocols.map((protocol, i) => {
          const isActive = i === active;
          return (
            <button
              key={protocol.title}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActive(i)}
              className={[
                'min-h-11 px-[1.15rem] py-[0.6rem] rounded-[2rem] border text-[0.92rem] leading-[1.3] text-left cursor-pointer',
                'transition-colors duration-200 ease-out active:translate-y-px',
                isActive
                  ? 'bg-white border-white text-primary-hover font-medium'
                  : 'bg-transparent border-white/50 text-white font-normal hover-fine:border-white',
              ].join(' ')}
            >
              {protocol.title}
            </button>
          );
        })}
      </div>
      <div className="grid max-w-[1000px] mx-auto">
        {protocols.map((protocol, i) => {
          const isActive = i === active;
          return (
            <div
              key={protocol.title}
              className={[
                'flex items-stretch [grid-area:1/1] transition-[opacity,visibility] duration-[550ms] ease-out',
                isActive ? 'opacity-100 visible' : 'opacity-0 invisible',
              ].join(' ')}
            >
              <div
                className={[
                  'w-full bg-white text-body rounded p-[clamp(2rem,4vw,3.5rem)]',
                  'transition-[translate,opacity] duration-[550ms] ease-out',
                  isActive ? 'translate-y-0' : 'translate-y-5',
                ].join(' ')}
              >
                <span className="block mb-2 text-[0.85rem] font-medium text-primary">{protocol.category}</span>
                <h3 className="font-heading font-normal text-ink text-[clamp(1.6rem,2.6vw,2.2rem)] mb-7 text-balance">{protocol.title}</h3>
                <ul className="list-none p-0">
                  {protocol.steps.map((step) => (
                    <li key={step} className="flex items-start gap-[1.2rem] mb-5 leading-[1.6] text-ink text-[1.1rem] max-md:text-base">
                      <svg className="shrink-0 mt-[0.2rem] text-primary" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
