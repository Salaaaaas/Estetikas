// Punto de entrada del JS global (lo carga BaseLayout en todas las páginas).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initAnchorLinks, initSmoothScroll } from './motion/smooth-scroll';
import { initReveals } from './motion/reveals';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const lenis = initSmoothScroll(reduceMotion);
initAnchorLinks(lenis, reduceMotion);
if (!reduceMotion) initReveals();
