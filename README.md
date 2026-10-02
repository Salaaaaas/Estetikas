# Esteti'Kas — sitio web

Sitio de la clínica de medicina estética Esteti'Kas (Bataan y Guápiles, Costa Rica).
Producción: <https://estetikascr.com> (Vercel, despliegue automático desde `master`).

## Stack

- **Astro 6** (sitio estático) + **TypeScript** estricto
- **Tailwind CSS v4** (`@tailwindcss/vite`), tokens en `src/styles/global.css` (`@theme`)
- **React 19** solo en islas interactivas (`@astrojs/react`)
- **GSAP + Lenis** para animaciones y scroll suave
- **Funciones de Vercel** en `api/` (reservas, Google Calendar, recordatorios) con Supabase y Resend

## Comandos

| Comando | Acción |
| --- | --- |
| `npm install` | Instala dependencias |
| `npm run dev` | Servidor de desarrollo en `localhost:4321` |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npx astro check` | Verificación de tipos |

Las funciones de `api/` no corren con `npm run dev`; se prueban con `vercel dev` o en un preview de Vercel.

## Estructura

```text
src/
├── pages/                 Rutas: /, /tratamientos, /tratamientos/[slug], /reservar, /privacidad
├── layouts/               BaseLayout (head, header, footer, JS global) y TreatmentLayout
├── components/
│   ├── Header.astro, NavMenu.tsx, Footer.astro, FloatingActions.tsx
│   ├── home/              Secciones del inicio (+ islas CareTabs, FaqAccordion, ContactForm)
│   ├── treatments/        Página de tratamientos y tarjetas
│   ├── booking/           Isla de /reservar: BookingForm, Calendar, useTurnstile
│   └── icons/
├── data/                  Contenido y datos: clinic.ts (contacto, sedes), home.ts, treatments.ts
├── content/tratamientos/  Una ficha .md por tratamiento (esquema en content.config.ts)
├── lib/                   Lógica sin UI: cart.ts, booking/ (horarios y API), scroll-lock.ts
├── scripts/               JS de página: main.ts (entrada), motion/ (scroll y animaciones), cart-buttons.ts
└── styles/global.css      Tailwind, tokens, reset, botones y utilidades liquid glass

api/                       Funciones serverless de Vercel
supabase/, sql/            Esquemas de base de datos
scripts/                   Scripts de mantenimiento (Node, no se despliegan)
public/                    Archivos servidos tal cual (imágenes, favicon, sitemap, robots)
assets/brand/              Logos fuente (no se publican)
docs/                      Guías: sincronización de calendario, app móvil, Instagram
```

## Convenciones

- **Textos y datos** en `src/data/` o en las fichas `.md`, no dentro de los componentes.
- **Estilos** con utilidades de Tailwind; lo compartido (botones, vidrio) vive en `global.css`.
- **React** solo para lo que necesita estado en el navegador; el resto es `.astro` estático.
- **Clases de gancho** (`hero-display`, `profile-block`, `t-card`, …) no llevan estilos: las usa
  `scripts/motion/reveals.ts` para las animaciones.
- **Diseño:** `DESIGN.md` (sistema visual) y `PRODUCT.md` (público y principios).
