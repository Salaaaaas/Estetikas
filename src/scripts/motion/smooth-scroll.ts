import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const HEADER_OFFSET = -80;

/**
 * Scroll suave con Lenis en equipos con mouse/trackpad. Se decide por el
 * puntero principal (no por maxTouchPoints: muchos portátiles reportan
 * pantalla táctil). En móvil y con movimiento reducido, scroll nativo.
 */
export function initSmoothScroll(reduceMotion: boolean): Lenis | null {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (coarsePointer || reduceMotion) return null;

  // Duración fija con curva exponencial: por fuerte que se gire la rueda, el
  // recorrido tarda lo mismo y frena suave. Más duración = más lento.
  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

/** Enlaces a anclas internas (#seccion): desplazamiento suave descontando el header. */
export function initAnchorLinks(lenis: Lenis | null, reduceMotion: boolean): void {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector<HTMLElement>(href);
      if (!target) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(target, { offset: HEADER_OFFSET, duration: 1.5 });
      } else {
        const top = target.getBoundingClientRect().top + window.scrollY + HEADER_OFFSET;
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });
  });
}
