import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);


let _lenis = null;

// =====================================================
// MAIN SITE INIT
// =====================================================
const initSite = () => {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isTouch) {
        document.body.classList.add('is-touch');
    }

    // Smooth Scroll (Lenis) — desktop only. On touch devices native scroll is
    // faster and avoids fighting the browser's own momentum scrolling.
    if (!isTouch && !reduceMotion) {
        _lenis = new Lenis({
            duration: 1.1,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });
        _lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => { _lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
    }

    // Internal anchor scroll
    document.querySelectorAll('nav a, .service-link, a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (!href || !href.startsWith('#')) return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            if (_lenis) {
                _lenis.scrollTo(target, { offset: -80, duration: 1.5 });
            } else {
                const top = target.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
            }
        });
    });

    // Reveal animations — content is visible by default (no CSS opacity:0), so
    // nothing ships hidden if JS fails. GSAP hides right before animating.
    const revealTargets = ".service-card, .faq-item, .before-after-container, .testimonial-featured, .testimonial-card-compact, .contact-info, .contact-form-wrapper, .treatment-detail-block, .trust-item, .t-card";
    // Solo se oculta lo que está bajo el pliegue: lo visible al cargar no parpadea
    const belowFold = gsap.utils.toArray(revealTargets)
        .filter(el => el.getBoundingClientRect().top > window.innerHeight);
    if (!reduceMotion && belowFold.length) {
        gsap.set(belowFold, { opacity: 0, y: 30, willChange: 'transform, opacity' });
        ScrollTrigger.batch(belowFold, {
            start: "top 88%",
            onEnter: batch => gsap.to(batch, {
                opacity: 1, y: 0, stagger: 0.08, duration: 0.65, ease: "power3.out", overwrite: true,
                onComplete() { batch.forEach(el => { el.style.willChange = 'auto'; }); }
            }),
            once: true
        });
    }

    // Hero entrance — staggered editorial reveal
    if (!reduceMotion && document.querySelector('.hero-display')) {
        const heroLines = gsap.utils.toArray('.hero-display em, .hero-display span');
        gsap.from('.hero-eyemark', { opacity: 0, scaleX: 0, transformOrigin: 'left center', duration: 0.5, delay: 0.05, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from(heroLines, { opacity: 0, y: 40, duration: 0.9, stagger: 0.12, delay: 0.15, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from('.hero-bottom', { opacity: 0, y: 24, duration: 0.8, delay: 0.6, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from('.hero-image-wrap', { opacity: 0, scale: 0.95, duration: 1.6, delay: 0.1, ease: "expo.out", clearProps: 'transform,opacity' });
    }

    // Staff intro: heading + description entrance
    const staffIntro = !reduceMotion && document.querySelector('.staff-intro');
    if (staffIntro) {
        const tl = gsap.timeline({
            scrollTrigger: { trigger: staffIntro, start: 'top 80%', once: true }
        });
        tl.fromTo('.staff-intro-heading', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity' })
          .fromTo('.staff-intro-copy p',  { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' }, '-=0.4');
    }

    // Profile content sides: slide in from the appropriate direction
    if (!reduceMotion) gsap.utils.toArray('.profile-block').forEach((block, i) => {
        const side = block.querySelector('.profile-content-side');
        const isReverse = block.classList.contains('reverse');
        if (side) {
            gsap.fromTo(side,
                { opacity: 0, x: isReverse ? -28 : 28 },
                { opacity: 1, x: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity',
                  scrollTrigger: { trigger: side, start: 'top 80%', once: true } }
            );
        }
    });

    // Profile images: entrada única (sin oscurecer al salir del viewport)
    if (!reduceMotion) gsap.utils.toArray('.profile-image-side img').forEach(img => {
        gsap.fromTo(img,
            { scale: 0.94, opacity: 0 },
            { scale: 1, opacity: 1, duration: 1.1, ease: "power3.out", clearProps: 'transform,opacity',
              scrollTrigger: { trigger: img, start: "top 85%", once: true } }
        );
    });

    // Specialties heading: entrance
    const specHeading = !reduceMotion && document.querySelector('.specialties-heading');
    if (specHeading) {
        const fromVars = (y) => ({ opacity: 0, y });
        const toVars   = (y, dur, ease) => ({ opacity: 1, y: 0, duration: dur, ease: ease || 'power3.out', clearProps: 'transform,opacity' });
        const tl = gsap.timeline({
            scrollTrigger: { trigger: specHeading, start: 'top 80%', once: true }
        });
        tl.fromTo('.specialties-heading', fromVars(20), { ...toVars(0, 0.7) })
          .fromTo('.specialties-sub',     fromVars(14), { ...toVars(0, 0.6) }, '-=0.3')
          .fromTo('.specialties-cta',     fromVars(10), { ...toVars(0, 0.5) }, '-=0.25');
    }

    // Specialty cards: staggered fade-in from bottom
    if (!reduceMotion) gsap.utils.toArray('.specialty-card').forEach((card, i) => {
        gsap.fromTo(card,
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.7, delay: i * 0.1,
              ease: "power3.out", clearProps: 'transform,opacity',
              scrollTrigger: { trigger: card, start: "top 85%", once: true } }
        );
    });

    // Philosophy section: GSAP word-by-word scrubbing text reveal
    const philosophyEl = !reduceMotion && document.querySelector('#philosophy-text');
    if (philosophyEl) {
        const text = philosophyEl.textContent;
        const words = text.split(' ');
        philosophyEl.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');
        const wordEls = philosophyEl.querySelectorAll('.word');
        gsap.to(wordEls, {
            opacity: 1,
            stagger: 0.04,
            ease: "none",
            scrollTrigger: {
                trigger: philosophyEl,
                start: "top 75%",
                end: "bottom 40%",
                scrub: 1.5
            }
        });
    }

    // Stats counter animation
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');
    statNumbers.forEach(el => {
        ScrollTrigger.create({
            trigger: el,
            start: "top 85%",
            once: true,
            onEnter: () => {
                const target = parseInt(el.dataset.target);
                const suffix = el.dataset.suffix || '';
                gsap.to({ val: 0 }, {
                    val: target,
                    duration: 2,
                    ease: "power2.out",
                    onUpdate: function() { el.textContent = Math.ceil(this.targets()[0].val) + suffix; }
                });
            }
        });
    });

    // Respaldo de los reveals: si un elemento sigue invisible 2 s después de
    // entrar al viewport (scroll muy rápido, resize, render headless), se muestra.
    if (!reduceMotion && 'IntersectionObserver' in window) {
        const guarded = revealTargets + ", .profile-content-side, .profile-image-side img, .specialty-card, .staff-intro-heading, .staff-intro-copy p, .specialties-heading, .specialties-sub, .specialties-cta";
        const guard = new IntersectionObserver((entries) => {
            entries.forEach(({ isIntersecting, target }) => {
                if (!isIntersecting) return;
                guard.unobserve(target);
                setTimeout(() => {
                    if (parseFloat(getComputedStyle(target).opacity) < 1) {
                        gsap.to(target, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.4, overwrite: true, clearProps: 'transform,opacity' });
                    }
                }, 2000);
            });
        });
        document.querySelectorAll(guarded).forEach(el => guard.observe(el));
    }

    // Before/After Slider
    const baSlider = document.querySelector('.ba-slider');
    if (baSlider) {
        const afterImage = baSlider.querySelector('.ba-image-after');
        const handle = baSlider.querySelector('.ba-handle');
        let rect = baSlider.getBoundingClientRect();
        window.addEventListener('resize', () => { rect = baSlider.getBoundingClientRect(); });
        const moveSlider = (e) => {
            let pageX = e.pageX || (e.touches && e.touches[0].pageX);
            let x = Math.max(0, Math.min(pageX - rect.left - window.scrollX, rect.width));
            const pct = (x / rect.width) * 100;
            afterImage.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
            handle.style.left = `${pct}%`;
        };
        baSlider.addEventListener('mousemove', moveSlider);
        baSlider.addEventListener('touchstart', () => { rect = baSlider.getBoundingClientRect(); });
        baSlider.addEventListener('touchmove', (e) => { moveSlider(e); e.preventDefault(); }, { passive: false });
    }

    // Parallax hero image
    if (!reduceMotion && document.querySelector('.hero-image-wrap')) {
        gsap.to(".hero-image", {
            scrollTrigger: { trigger: ".hero", start: "top top", scrub: true },
            y: 60, ease: "none"
        });
    }

};

initSite();
document.addEventListener('astro:after-swap', initSite);
