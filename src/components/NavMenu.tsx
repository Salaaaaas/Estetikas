import { useEffect, useState } from 'react';
import { lockScroll, unlockScroll } from '../scripts/scroll-lock';

interface NavMenuProps {
  isHome: boolean;
}

interface NavLink {
  label: string;
  href: string;
}

const linkClass = [
  'relative no-underline text-ink font-normal text-[0.95rem] tracking-[0.01em]',
  'transition-colors duration-[220ms] ease-out',
  'max-xl:text-[0.9rem] max-md:text-[1.4rem] max-md:tracking-[3px]',
  'nav:on-dark-hero:text-white',
  "after:content-[''] after:absolute after:left-0 after:-bottom-1 after:h-px after:w-0 after:bg-primary",
  'after:transition-[width] after:duration-[280ms] after:ease-out hover-fine:after:w-full',
].join(' ');

const reservarClass = [
  'relative no-underline bg-primary text-white border border-primary rounded font-medium tracking-[0.01em]',
  'px-5 py-2 text-[0.95rem] max-xl:text-[0.9rem]',
  'max-md:text-[1rem] max-md:px-8 max-md:py-[0.8rem]',
  'transition-[background-color,border-color,transform] duration-200 ease-out motion-reduce:transition-none',
  'hover-fine:bg-primary-hover hover-fine:border-primary-hover active:scale-[0.97]',
].join(' ');

export default function NavMenu({ isHome }: NavMenuProps) {
  const [open, setOpen] = useState(false);

  // En el inicio los anclas son locales; en subpáginas apuntan a la home
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
      <nav
        id="site-nav"
        className={[
          'max-md:fixed max-md:inset-0 max-md:z-[9000] max-md:flex max-md:items-center max-md:justify-center',
          'max-md:transition-opacity max-md:duration-[280ms] max-md:ease-out',
          open
            ? 'max-md:opacity-100 max-md:pointer-events-auto max-md:bg-white/98'
            : 'max-md:opacity-0 max-md:pointer-events-none max-md:bg-white',
        ].join(' ')}
      >
        <ul className="flex list-none m-0 p-0 gap-10 max-xl:gap-6 max-md:flex-col max-md:justify-center max-md:gap-10 max-md:text-center">
          {links.map((link) => (
            <li key={link.label}>
              <a href={link.href} className={linkClass} onClick={close}>
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a href="/reservar" className={reservarClass} onClick={close}>
              Reservar Cita
            </a>
          </li>
        </ul>
      </nav>
      <button
        type="button"
        className="hidden max-md:flex flex-col justify-center gap-[5px] size-11 p-1 bg-transparent border-0 rounded-lg cursor-pointer relative z-[9002] transition-colors duration-200 hover:bg-primary/8"
        aria-label="Abrir menú de navegación"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`block w-full h-0.5 bg-ink rounded-[2px] origin-center transition-[translate,rotate,scale,opacity] duration-[220ms] ease-out ${open ? 'translate-y-[7px] rotate-45' : ''}`} />
        <span className={`block w-full h-0.5 bg-ink rounded-[2px] origin-center transition-[translate,rotate,scale,opacity] duration-[220ms] ease-out ${open ? 'opacity-0 scale-x-0' : ''}`} />
        <span className={`block w-full h-0.5 bg-ink rounded-[2px] origin-center transition-[translate,rotate,scale,opacity] duration-[220ms] ease-out ${open ? '-translate-y-[7px] -rotate-45' : ''}`} />
      </button>
    </>
  );
}
