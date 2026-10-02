import { useEffect, useState } from 'react';
import { lockScroll, unlockScroll } from '../lib/scroll-lock';

interface NavMenuProps {
  isHome: boolean;
}

interface NavLink {
  label: string;
  href: string;
}

// Enlaces: cápsula que se ilumina al pasar el cursor (estilo Apple).
// Sobre hero oscuro (≥769px y sin scroll) el texto va en blanco.
const linkClass = [
  'block rounded-full px-4 py-2 no-underline uppercase font-normal text-[0.8rem] tracking-[2px] text-ink',
  'transition-[background-color,color] duration-200 ease-out',
  'hover-fine:bg-white/70 max-xl:px-3 max-xl:text-[0.76rem] max-xl:tracking-[1px]',
  'md:on-dark-hero:text-white md:on-dark-hero:hover-fine:bg-white/12',
  'max-md:px-5 max-md:py-3 max-md:text-[1rem] max-md:tracking-[3px] max-md:hover-fine:bg-black/5',
].join(' ');

const reservarClass = [
  'glass-sheen block rounded-full border border-primary bg-primary px-5 py-[0.6rem] no-underline uppercase',
  'font-normal text-[0.8rem] tracking-[2px] text-white',
  'transition-[background-color,border-color,translate] duration-200 ease-out motion-reduce:transition-none',
  'hover-fine:bg-primary-hover hover-fine:border-primary-hover active:scale-[0.97]',
  'max-md:mt-3 max-md:px-8 max-md:py-[0.85rem] max-md:text-[0.9rem]',
].join(' ');

export default function NavMenu({ isHome }: NavMenuProps) {
  const [open, setOpen] = useState(false);

  const anchor = (id: string) => (isHome ? `#${id}` : `/#${id}`);
  const links: NavLink[] = [
    { label: 'Inicio', href: anchor('inicio') },
    { label: 'Sobre Nosotras', href: anchor('nosotras') },
    { label: 'Tratamientos', href: '/tratamientos' },
    { label: 'Contacto', href: anchor('contacto') },
  ];

  useEffect(() => {
    if (!open) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      {/* Velo detrás de la hoja del menú móvil: tocar fuera la cierra */}
      <div
        aria-hidden="true"
        onClick={close}
        className={[
          'hidden max-md:block fixed inset-0 z-[8999] bg-ink/25 transition-opacity duration-300 ease-out',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />
      <nav
        id="site-nav"
        className={[
          // Móvil: hoja de vidrio que cae bajo la cápsula
          'max-md:fixed max-md:inset-x-3 max-md:top-[88px] max-md:z-[9000] max-md:rounded-[28px] max-md:glass-strong max-md:p-5',
          'max-md:transition-[opacity,translate] max-md:duration-300 max-md:ease-out',
          open
            ? 'max-md:opacity-100 max-md:translate-y-0 max-md:pointer-events-auto'
            : 'max-md:opacity-0 max-md:-translate-y-3 max-md:pointer-events-none',
        ].join(' ')}
      >
        <ul className="flex items-center list-none m-0 p-0 gap-1 max-md:flex-col max-md:items-stretch max-md:text-center">
          {links.map((link) => (
            <li key={link.label}>
              <a href={link.href} className={linkClass} onClick={close}>
                {link.label}
              </a>
            </li>
          ))}
          <li className="ml-2 max-md:ml-0">
            <a href="/reservar" className={reservarClass} onClick={close}>
              Reservar Cita
            </a>
          </li>
        </ul>
      </nav>
      <button
        type="button"
        className="hidden max-md:flex flex-col justify-center gap-[5px] size-11 p-[11px] rounded-full bg-transparent border-0 cursor-pointer relative z-[9002] transition-colors duration-200 hover:bg-black/5 on-dark-hero:hover:bg-white/10"
        aria-label={open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {[open ? 'translate-y-[7px] rotate-45' : '', open ? 'opacity-0 scale-x-0' : '', open ? '-translate-y-[7px] -rotate-45' : ''].map((state, i) => (
          <span
            key={i}
            className={`block w-full h-0.5 rounded-[2px] bg-ink on-dark-hero:bg-white origin-center transition-[translate,rotate,scale,opacity,background-color] duration-[220ms] ease-out ${state}`}
          />
        ))}
      </button>
    </>
  );
}
