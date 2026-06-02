---
target: src/pages/index.astro
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-05-29T04-36-41Z
slug: src-pages-index-astro
---
## Design Health Score — staff section (#nosotras)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | GSAP scroll feedback works; minor gap in booking confirmation |
| 2 | Match System / Real World | 4 | Spanish copy natural, medical vocabulary appropriate |
| 3 | User Control and Freedom | 3 | Multiple CTAs present; navigation clear |
| 4 | Consistency and Standards | 3 | Design system holds; minor inconsistency noted |
| 5 | Error Prevention | 3 | Booking modal guides well; form validation present |
| 6 | Recognition Rather Than Recall | 3 | Treatments labeled; nav clear |
| 7 | Flexibility and Efficiency | 2 | Single conversion path; no WhatsApp shortcut above fold |
| 8 | Aesthetic and Minimalist Design | 2 | Large empty zone dominates; ghost number weak |
| 9 | Error Recovery | 2 | Form error handling unclear |
| 10 | Help and Documentation | 2 | FAQ exists; no inline booking guidance |
| **Total** | | **27/40** | **Acceptable — significant visual fix needed** |

## Anti-Patterns Verdict
Detector: 0 flags on markup. LLM: ghost "3" + "ESPECIALISTAS" label walks into hero-metric territory (banned: big number + small label). Staff-intro burns a full viewport height before showing any doctor — critical for a brand where "la doctora es el producto."

## Priority Issues

**[P1] Dead zone** — staff-intro padding `10rem 8% 7rem` pushes all doctors below fold. Fix: reduce to `6rem 8% 4rem`. Command: layout

**[P1] "ESPECIALISTAS" banned uppercase tracked label** — `text-transform: uppercase; letter-spacing: 3px` is the eyebrow anti-pattern regardless of position. Fix: remove label or replace with normal-case "tres especialistas" at 0.82rem weight 300 no tracking. Command: quieter

**[P2] Ghost "3" reads as hero-metric** — opacity 0.13 is simultaneously too faint to contribute and too structural to ignore. Fix: either commit to 0.28 opacity (and drop the label) or remove it entirely. Command: distill

**[P2] Staff count block consumes 20-25% width** — auto column + 8% gap wastes space the heading could use. Fix: `grid-template-columns: 120px 1fr`, gap `4%`. Command: layout

## Persona Red Flags
Casey (Mobile): 10rem padding on small screen = 2+ viewport heights before any doctor. Jordan (First-Timer): taps "Sobre Nosotras," sees a faint 3 and text, no face, no trust signal. Lucía (project persona, Bataan/Guápiles): arrived by recommendation to see who will treat her — books without having seen a face.

## Minor Observations
- `align-items: end` misaligns "3" below heading level — try `align-items: center`
- border-right divider at `rgba(0,0,0,0.08)` invisible in screenshot — bump to 0.12 or add teal tint
- Dra. Mónica dark placeholder against bg-light on adjacent blocks breaks visual alternation
