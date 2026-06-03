# Design System: Esteti'Kas

## 1. Visual Theme & Atmosphere

A gallery-airy clinic landing page with editorial asymmetry and warm clinical restraint. The atmosphere is "a premium dermatology studio that happens to be run by someone with taste" — precise, human, never sterile. Think a well-lit consultation room with a piece of art on the wall, not a spa with lavender candles.

- **Density:** 3 — Generous whitespace, one dominant idea per fold, content earns its position
- **Variance:** 6 — Split-screen hero, alternating profile blocks, no centered layouts except FAQ and testimonials
- **Motion:** 5 — Smooth CSS easing, a persistent marquee, slide-in modal. Restrained but alive.

The palette is warm-teal-dominant with a single gold accent. The brand is aspirational for women in small Costa Rican towns — it must feel attainable-premium, not intimidating-luxury. The distinction: the Dra. Karen photo should feel like "someone I trust" before it feels like "someone I aspire to be."

---

## 2. Color Palette & Roles

- **Clinical White** (`#FFFFFF`) — Primary canvas, body background, modal surfaces
- **Frost Surface** (`#F7F9FA`) — Alternate section backgrounds, trust bar, care cards. Barely visible tint.
- **Deep Teal** (`#007D88`) — Primary action color: CTAs, active nav states, links, focus rings, section tags, booking accent. The brand's authority color.
- **Teal Depth** (`#005E67`) — Hover state for primary color. Never used at rest.
- **Warm Gold** (`#C9A84C`) — Secondary warm accent: specialty number labels (when used), staff role badges, premium markers. Never used as a background. Strict decorative role.
- **Champagne Blush** (`#F7E7CE`) — Background tint for warm-accent callouts only. Very light application.
- **Charcoal Heading** (`#111111`) — All headings. Near-black with warmth, not pure black.
- **Body Ink** (`#1A1A1A`) — Primary body text. Rich, readable, warm dark.
- **Muted Slate** (`#4A4A4A`) — Secondary text, descriptions, metadata, subheadings. Passes WCAG AA on white.
- **Structural Whisper** (`rgba(0,0,0,0.08)`) — Card borders, horizontal rules, section dividers. Never a solid line.

**One accent rule:** Deep Teal (`#007D88`) is the single interaction accent. Gold is decorative. Never both on the same interactive element.

---

## 3. Typography Rules

- **Display / Headings:** `Bodoni Moda` (serif, optical size 6–96, weights 400/700, italic 400/700)
  - Track tight: `letter-spacing: -0.02em` to `-0.04em` at display sizes
  - Italic weight reserved for emphasis within headings (e.g., `<em>Medicina</em>` in hero)
  - Hero h1: `clamp(4rem, 8vw, 8.5rem)`, line-height 0.88
  - Section h2: `clamp(2rem, 3.5vw, 2.8rem)`, weight 400 (let the font do the work)
  - Profile name: `clamp(2.2rem, 3.5vw, 3.5rem)`, weight 700

- **Body / UI:** `Jost` (sans-serif, weights 300/400/500/600)
  - Body: `1rem`/`1.6` line-height, max 65ch line length
  - UI labels: weight 500, no uppercase unless it's a pill badge
  - Small metadata: `0.85rem`, weight 400, Muted Slate color
  - Button labels: weight 500–600

- **No monospace needed** — this is a marketing site, no code or numeric-heavy content

- **Scale ratios (modular, 1.35×):**
  - `0.8rem` — micro labels, pill text
  - `0.85rem` — section tags, care categories
  - `1rem` — body
  - `1.2rem` — large body, blockquotes
  - `1.6rem` — small headings
  - `2.2–2.8rem` — section h2s
  - `3.5rem` — profile names
  - `4–8.5rem` — hero display

- **Banned fonts:** Playfair Display, Outfit, Fraunces, Cormorant, Inter, DM Sans, Plus Jakarta Sans, Instrument Serif. The brand now uses Bodoni Moda + Jost — do not suggest alternatives.

---

## 4. Component Stylings

**Buttons (`.btn`):**
- Primary: Deep Teal fill (`#007D88`), white text, `border-radius: 4px`, `padding: 0.85rem 2rem`
- On active: `transform: translateY(1px)` — tactile press, no glow
- Hover: `#005E67` fill
- Outline variant: transparent fill, `1px solid var(--secondary-color)` border, dark text
- No outer glow shadows. No neon effects. No custom cursors.

**Profile Role Pill (`.profile-role`):**
- `border: 1px solid var(--primary-color)`, `border-radius: 2rem`, `color: var(--primary-color)`
- `font-size: 0.8rem`, no uppercase, normal tracking
- This is the single pill/badge component in the system

**Section Tags (`.section-tag`):**
- `font-size: 0.85rem`, `font-weight: 500`, Deep Teal color
- No uppercase. No letter-spacing. Acts as a category label above h2.
- Used sparingly: only where the content category is not self-evident from the heading

**Cards (`.specialty-card`, `.testimonial-*`, `.care-card`):**
- Specialty cards: border-bottom divider only, no box. White background implied by page.
- Testimonial featured: `background: #111111`, `border-radius: 4px`, 3rem padding — dark, deliberate contrast
- Testimonial compact: `background: #F7F9FA`, `border-radius: 12px`, same padding rhythm
- Care cards: white with subtle border, SVG icon decorative at 140×140 (kept for visual anchor, reduced visual noise by thinning stroke weight)
- No identical-size card grids (3 equal columns). Use 2+1 asymmetric or full-width alternating.

**Booking Modal (`.booking-modal-panel`):**
- Desktop: full-height right drawer, `max-width: 560px`, `backdrop-filter: blur(24px)`
- Mobile: bottom sheet, `height: 92svh`, `border-radius: 20px 20px 0 0`, scrollable internally via `.modal-body { overflow-y: scroll }`
- Open animation: `translateX(100%)` → 0 desktop, `translateY(100%)` → 0 mobile
- Easing: `cubic-bezier(0.32, 0.72, 0, 1)` (iOS-like drawer feel)

**FAQ Accordion (`.faq-question`, `.faq-answer`):**
- Question: full-width button, flex between question text and icon circle
- Icon: 28×28px circle with `+` → rotates 45° to `×` on active
- Answer reveal: `grid-template-rows: 0fr → 1fr`, 360ms `ease-out` — no max-height hacks

**Inputs / Contact Form:**
- Label above input, no floating labels
- `border: 1px solid rgba(0,0,0,0.15)`, `border-radius: 4px`, `padding: 0.85rem 1rem`
- Focus: `border-color: var(--primary-color)`, no box-shadow glow
- Error: red border + error text below field
- Custom dropdown: trigger div + options panel. Ensure `position: fixed` or portal if inside overflow container.

---

## 5. Layout Principles

**Grid architecture:**
- Max content width: `1200px` centered with `8%` horizontal padding
- Hero: `grid-template-columns: 1fr 1fr`, `min-height: 92vh` — never centered
- Profile blocks: alternating `.profile-block` and `.profile-block.reverse` — left-text/right-image and vice versa
- Specialty section: sticky left column (`specialties-sticky`) + scrolling right cards — horizontal two-pane, not a card grid
- Testimonials: `grid-template-columns: 1fr 1fr` — featured dark left, compact light right

**Spacing rhythm:**
- Section gaps: `clamp(4rem, 8vw, 8rem)` vertical padding
- Internal card padding: `2–3rem`
- Component gaps: `1rem`–`2rem`
- Touch targets: minimum `44px` height on all interactive elements

**Forbidden layouts:**
- No 3-equal-column card grids
- No centered hero (the split editorial hero is the brand's layout)
- No absolute-positioned content overlapping other content
- No `height: 100vh` — use `min-height: 100dvh` or `92svh`

**Mobile collapse (≤768px):**
- Hero: stacks to single column, image below content
- Profile blocks: image above, content below
- Specialty: left sticky hides, right cards stack vertically
- Testimonials: stack to single column
- Marquee: persists (it's a single-row scroll, already responsive)

---

## 6. Motion & Interaction

**Easing curves (already in `:root`):**
- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` — default UI interaction
- `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` — on-screen movement
- `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` — modal/sheet entrances

**Reveal animations:**
- Section reveal: `opacity 0→1`, `translateY(20px→0)`, staggered cascade within groups
- Trigger: `IntersectionObserver` with `rootMargin: "-80px"` — content visible before it enters viewport
- Default: content must be visible without JS (opacity:1 as default, class-toggled transition)

**Perpetual motion:**
- Treatments marquee: `animation: marquee-scroll 30s linear infinite` — always running
- Pauses on `prefers-reduced-motion`

**Interaction feedback:**
- Button active: `transform: translateY(1px)`, 100ms
- Hover cards: `transform: translateY(-2px)`, `box-shadow` lift, 200ms ease-out
- FAQ icon: `transform: rotate(45deg)`, 220ms
- Modal enter/exit: 380ms ease-drawer

**Performance:**
- Animate only `transform` and `opacity` — never `width`, `height`, `top`, `left`
- `will-change: transform` on modal panels and sticky elements
- Reduced motion: all entrance animations disabled, transitions instant, marquee paused

---

## 7. Anti-Patterns (Banned)

**Visual:**
- No pure black (`#000000`) — use `#111111` (Charcoal Heading) for darkest elements
- No neon glows or outer box-shadow effects on buttons
- No gradient text (`background-clip: text`) — single solid colors only
- No glassmorphism as decoration — the booking modal uses it purposefully, nowhere else
- No 3-equal-column card grids — use asymmetric or alternating layouts
- No centered hero section — the split editorial layout is non-negotiable
- No emojis in the UI (they exist in CSS as Unicode but not in content)
- No numbered section scaffolding (01/02/03) unless the order carries real meaning

**Typography:**
- No uppercase tracked labels on body-size text — `section-tag` and `care-category` do NOT use uppercase or letter-spacing
- No all-caps body copy
- No generic serif fonts — Bodoni Moda only, and only for headings
- No Playfair Display, Cormorant, Lora, Fraunces — they were explicitly removed

**Copy:**
- No AI clichés: "Seamless", "Elevate", "Next-Gen", "Cutting-Edge", "Transform", "Unleash", "World-Class"
- No tech jargon: "tecnología de vanguardia" reads as filler — replace with what the technology literally does
- No fake social proof numbers ("99.9% satisfaction", "500+ clients")
- No "Scroll to explore", scroll arrows, or bouncing chevrons

**Interaction:**
- No custom mouse cursors
- No loading animations that block content visibility
- No modal transitions that use `display: none` toggling — use opacity + pointer-events

**Images:**
- No broken image links — verify all `/img/*.webp` assets exist locally
- No colored `<div>` placeholders where actual photography belongs
- Dra. Mónica profile uses gold-gradient initials until a real photo is available — do not revert to "Foto próximamente" text
