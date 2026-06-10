---
target: src/pages/index.astro
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-06-03T00-15-59Z
slug: src-pages-index-astro
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Form submit no visible loading state; care slider dots work; booking feedback JS-only |
| 2 | Match System / Real World | 4 | Natural Spanish, no jargon, logical flow |
| 3 | User Control and Freedom | 3 | Modal close/Escape; booking cart removable; no form undo |
| 4 | Consistency and Standards | 3 | BTN consistent; 3 different uppercase-tracked label treatments doing same job |
| 5 | Error Prevention | 2 | required on inputs; custom select risky on mobile; phone field missing |
| 6 | Recognition Rather Than Recall | 3 | Clear nav, prominent CTAs, booking cart shows selections |
| 7 | Flexibility and Efficiency | 2 | WhatsApp shortcut good; care slider not swipeable; no fast return-visitor path |
| 8 | Aesthetic and Minimalist Design | 3 | Generally clean; 140x140 care SVGs add decorative noise |
| 9 | Error Recovery | 2 | No field-level validation; form errors via JS alert only |
| 10 | Help and Documentation | 3 | FAQ answers 4 real objections; pricing entirely absent |
| **Total** | | **27/40** | **Acceptable** |

## Anti-Patterns Verdict

AI slop verdict: YES — category-predictable. Playfair Display + Outfit (both reflex-reject list) + uppercase tracked eyebrows on every section label = 2024 generic aesthetic clinic site. Detector returned [] (design-token level issues, not HTML patterns).

## Priority Issues

[P1] Typography reflex — Playfair Display + Outfit both on banned list. Reads as every other aesthetic clinic site.
[P1] Eyebrow grammar applied reflexively: .section-tag, .care-category, .specialty-num all use uppercase + letter-spacing: 3px for different content. Not one system — three accidental variations.
[P2] 01/02/03 numbered scaffolding on specialty cards — order is arbitrary, numbers carry no information.
[P2] No before/after photos on homepage — the audience's primary doubt ("will it look natural?") goes unanswered.
[P3] Dra. Monica profile has no photo — "Foto próximamente" placeholder breaks trust at the most critical trust-building moment.

## Persona Red Flags

Jordan: "Valoración gratuita" buried in FAQ, not hero. No pricing anywhere. Placeholder photo on Mónica. Closes tab.
Casey: Care slider has no swipe gesture (dot clicks only). Hero CTA top-of-screen on mobile.
Ana (local): No before/after on homepage. Anonymous testimonials (initials only, no photos).
