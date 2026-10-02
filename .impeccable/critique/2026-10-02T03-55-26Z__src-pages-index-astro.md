---
target: página de inicio
total_score: 26
p0_count: 0
p1_count: 4
timestamp: 2026-10-02T03-55-26Z
slug: src-pages-index-astro
---
## Design Health Score: 26/40 (Acceptable)

| # | Heurística | Nota | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Slider de cuidados con autoplay y puntos de 12px |
| 2 | Coincidencia con el mundo real | 3 | Bien |
| 3 | Control y libertad | 3 | Autoplay del slider |
| 4 | Consistencia | 2 | Hero y "única" en Jost vs. titulares en Bodoni; .btn definido dos veces; mayúsculas contra DESIGN.md |
| 5 | Prevención de errores | 3 | Bien |
| 6 | Reconocimiento | 3 | 2 de 3 protocolos ocultos en el slider |
| 7 | Flexibilidad | 2 | Sitio de marca, aceptable |
| 8 | Estética y minimalismo | 2 | "3" huérfano, iconos de 140px sin significado, texto scrub al 15% |
| 9 | Recuperación de errores | 2 | Solo validación nativa |
| 10 | Ayuda | 3 | Hay FAQ |

## Findings
- P1 A1 contraste en contacto/footer (teléfono 3.86:1, copyright 3.82:1)
- P1 A2 texto scrub de filosofía arranca al 15% de opacidad
- P1 A3 regla `* {font-family}` fuerza Jost en em/span de los titulares
- P1 A4 focus de los campos: borde teal sobre #2a2a2a a 2.9:1
- P2 B1-B7 ritmo de fondos, slider de cuidados, "3" huérfano, mayúsculas, easing elástico, reveals que dependen de JS, orden de los perfiles en móvil
- P3 C1-C4 pulido
