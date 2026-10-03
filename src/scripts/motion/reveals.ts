import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Animaciones de entrada (GSAP). El contenido es visible por defecto: GSAP solo
// lo oculta justo antes de animarlo, así nada queda invisible si falla el JS.
// Las clases que se usan aquí (hero-*, staff-*, profile-*, …) son ganchos
// sin estilos propios.

const EASE = 'power3.out';
const SHOW = { opacity: 1, y: 0, ease: EASE, clearProps: 'transform,opacity' } as const;

/** Elementos que aparecen en lote al entrar en pantalla */
const REVEAL_TARGETS = '.faq-item, .contact-info, .contact-form-wrapper, .trust-item, .t-card';

function revealOnScroll(): void {
  // Solo se oculta lo que está bajo el pliegue: lo visible al cargar no parpadea
  const belowFold = gsap.utils
    .toArray<HTMLElement>(REVEAL_TARGETS)
    .filter((el) => el.getBoundingClientRect().top > window.innerHeight);
  if (!belowFold.length) return;
  gsap.set(belowFold, { opacity: 0, y: 30, willChange: 'transform, opacity' });
  ScrollTrigger.batch(belowFold, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        stagger: 0.08,
        duration: 0.65,
        ease: EASE,
        overwrite: true,
        onComplete: () => batch.forEach((el) => ((el as HTMLElement).style.willChange = 'auto')),
      }),
  });
}

function heroEntrance(): void {
  if (!document.querySelector('.hero-display')) return;
  const lines = gsap.utils.toArray('.hero-display em, .hero-display span');
  gsap.from('.hero-eyemark', { opacity: 0, scaleX: 0, transformOrigin: 'left center', duration: 0.5, delay: 0.05, ease: EASE, clearProps: 'transform,opacity' });
  gsap.from(lines, { opacity: 0, y: 40, duration: 0.9, stagger: 0.12, delay: 0.15, ease: EASE, clearProps: 'transform,opacity' });
  gsap.from('.hero-bottom', { opacity: 0, y: 24, duration: 0.8, delay: 0.6, ease: EASE, clearProps: 'transform,opacity' });
  gsap.from('.hero-image-wrap', { opacity: 0, scale: 0.95, duration: 1.6, delay: 0.1, ease: 'expo.out', clearProps: 'transform,opacity' });

  // Parallax de la foto del hero
  gsap.to('.hero-image', { scrollTrigger: { trigger: '.hero', start: 'top top', scrub: true }, y: 60, ease: 'none' });
}

function teamEntrance(): void {
  const intro = document.querySelector('.staff-intro');
  if (intro) {
    gsap
      .timeline({ scrollTrigger: { trigger: intro, start: 'top 80%', once: true } })
      .fromTo('.staff-intro-heading', { opacity: 0, y: 24 }, { ...SHOW, duration: 0.8 })
      .fromTo('.staff-intro-copy p', { opacity: 0, y: 16 }, { ...SHOW, duration: 0.6 }, '-=0.4');
  }

  // Texto de cada perfil: entra desde el lado contrario a la foto
  gsap.utils.toArray<HTMLElement>('.profile-block').forEach((block) => {
    const side = block.querySelector('.profile-content-side');
    if (!side) return;
    const fromX = block.classList.contains('reverse') ? -28 : 28;
    gsap.fromTo(
      side,
      { opacity: 0, x: fromX },
      { opacity: 1, x: 0, duration: 0.9, ease: EASE, clearProps: 'transform,opacity', scrollTrigger: { trigger: side, start: 'top 80%', once: true } },
    );
  });

  gsap.utils.toArray<HTMLElement>('.profile-image-side img').forEach((img) => {
    gsap.fromTo(
      img,
      { scale: 0.94, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1.1, ease: EASE, clearProps: 'transform,opacity', scrollTrigger: { trigger: img, start: 'top 85%', once: true } },
    );
  });
}

function specialtiesEntrance(): void {
  const heading = document.querySelector('.specialties-heading');
  if (heading) {
    gsap
      .timeline({ scrollTrigger: { trigger: heading, start: 'top 80%', once: true } })
      .fromTo('.specialties-count', { opacity: 0, y: 16 }, { ...SHOW, duration: 0.6 })
      .fromTo('.specialties-heading', { opacity: 0, y: 20 }, { ...SHOW, duration: 0.7 }, '-=0.35')
      .fromTo('.specialties-sub', { opacity: 0, y: 14 }, { ...SHOW, duration: 0.6 }, '-=0.3')
      .fromTo('.specialties-cta', { opacity: 0, y: 10 }, { ...SHOW, duration: 0.5 }, '-=0.25');
  }

  gsap.utils.toArray<HTMLElement>('.specialty-card').forEach((card, i) => {
    gsap.fromTo(
      card,
      { opacity: 0, y: 40 },
      { ...SHOW, duration: 0.7, delay: i * 0.1, scrollTrigger: { trigger: card, start: 'top 85%', once: true } },
    );
  });
}

/** "Cada paciente es única": el párrafo se ilumina palabra por palabra al hacer scroll. */
function philosophyScrub(): void {
  const el = document.querySelector<HTMLElement>('#philosophy-text');
  if (!el) return;
  const words = (el.textContent ?? '').split(' ');
  el.replaceChildren(
    ...words.flatMap((word, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      return i < words.length - 1 ? [span, document.createTextNode(' ')] : [span];
    }),
  );
  gsap.to(el.querySelectorAll('.word'), {
    opacity: 1,
    stagger: 0.04,
    ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 40%', scrub: 1.5 },
  });
}

/**
 * Respaldo: si un elemento animado sigue invisible 2 s después de entrar en
 * pantalla (scroll muy rápido, resize, render sin interacción), se muestra.
 */
function revealSafetyNet(): void {
  if (!('IntersectionObserver' in window)) return;
  const guarded = `${REVEAL_TARGETS}, .profile-content-side, .profile-image-side img, .specialty-card, .staff-intro-heading, .staff-intro-copy p, .specialties-heading, .specialties-sub, .specialties-cta`;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      window.setTimeout(() => {
        if (parseFloat(getComputedStyle(target).opacity) < 1) {
          gsap.to(target, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.4, overwrite: true, clearProps: 'transform,opacity' });
        }
      }, 2000);
    });
  });
  document.querySelectorAll(guarded).forEach((el) => observer.observe(el));
}

export function initReveals(): void {
  revealOnScroll();
  heroEntrance();
  teamEntrance();
  specialtiesEntrance();
  philosophyScrub();
  revealSafetyNet();
}
