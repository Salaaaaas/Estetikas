import { useId, useState } from 'react';
import type { FaqItem } from '../../data/home';

interface FaqAccordionProps {
  items: FaqItem[];
}

// Acordeón con una sola respuesta abierta. La altura se anima con
// grid-template-rows (0fr → 1fr), sin medir el DOM.
export default function FaqAccordion({ items }: FaqAccordionProps) {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();

  return (
    <div className="max-w-[750px] mx-auto">
      {items.map((item, i) => {
        const isOpen = open === i;
        const answerId = `${baseId}-answer-${i}`;
        return (
          // faq-item: gancho del reveal de site.js
          <div key={item.q} className="faq-item mb-4 border-b border-[#EAEAEA] overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={answerId}
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex justify-between items-center gap-4 py-[1.4rem] bg-transparent border-0 text-left cursor-pointer font-body text-[1rem] font-medium text-ink transition-colors duration-300 hover:text-primary"
            >
              {item.q}
              <span
                aria-hidden="true"
                className={[
                  "flex items-center justify-center shrink-0 size-7 rounded-full border-[1.5px] text-[1.1rem] leading-none after:content-['+']",
                  'transition-[rotate,background-color,border-color,color] duration-[220ms] ease-out',
                  isOpen ? 'bg-primary border-primary text-white rotate-45' : 'border-current',
                ].join(' ')}
              />
            </button>
            <div
              id={answerId}
              role="region"
              className={[
                'grid overflow-hidden text-muted text-[0.98rem] leading-[1.7] font-light',
                'transition-[grid-template-rows,padding-bottom] duration-[360ms] ease-out',
                isOpen ? 'grid-rows-[1fr] pb-6' : 'grid-rows-[0fr] pb-0',
              ].join(' ')}
            >
              <p className="overflow-hidden min-h-0" dangerouslySetInnerHTML={{ __html: item.a }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
