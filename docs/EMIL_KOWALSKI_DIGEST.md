# Emil Kowalski — Animation Doctrine (Checklist)

Source: emilkowal.ski (design engineer at Linear, ex-Vercel, author of Sonner & Vaul).
Full document: `docs/EMIL_KOWALSKI_DIGEST.docx`

---

## Hard Rules (enforce always)

- [ ] **No linear easing** for UI. Use spring or ease-out curves.
- [ ] **UI animations 150-300ms max.** Hero/decorative can be longer.
- [ ] **ease-out by default** (fast start, slow finish = instant feedback feel).
- [ ] **ease-in is almost always wrong** for UI (feels laggy).
- [ ] **Animate only `transform` + `opacity`** — never padding/margin/width/height/top/left (triggers layout+paint).
- [ ] **Start scale >= 0.9** — never `scale(0)`. Use 0.92-0.95.
- [ ] **`button:active { scale(0.97) }`** — global on all interactive elements.
- [ ] **`@media (prefers-reduced-motion: reduce)`** — mandatory, not optional.
- [ ] **Every animation must have a purpose.** No animation for animation's sake.

## Easing

- Default easing token: `cubic-bezier(0.32, 0.72, 0, 1)` ("iOS curve" from Vaul)
- Moving visible object across screen: `ease-in-out`
- Appear/disappear: `ease-out`
- Hover, color change: built-in `ease` is ok
- Everything else: custom cubic-bezier from easings.co

## Interactivity

- [ ] **Spring for cursor-linked effects** — never bind mouseX/Y directly to transform. Use `useSpring()` from Framer Motion (stiffness ~50, damping ~20).
- [ ] **Origin-aware**: `transform-origin` from the point of action, not center.
- [ ] **Interruptible**: closing mid-open must reverse smoothly. CSS transitions and Framer Motion support this; CSS keyframes do not.

## Techniques

- **Blur masks crossfade gaps** — `filter: blur(2px)` mid-transition hides visual breaks.
- **Tooltips**: first with 500ms delay, subsequent instant (Radix `data-instant`).
- **clip-path** for synchronized highlight + text color (Stripe tabs pattern).
- **CSS animations > JS animations** when main thread is busy (hardware-accelerated, no RAF dependency).

## What NOT to do

- No built-in CSS easings (ease-in-out, ease-out) on important animations — too weak. Use custom cubic-bezier.
- No direct cursor-to-transform binding without spring.
- No long transitions on frequently-used navigation (section pages).
- No importing Linear/Vercel visual style — take their animation discipline, keep our cinematic aesthetic.

## Libraries (Emil's)

- `sonner` — toast notifications
- `vaul` — iOS-feel drawer

## One-liner for every code session

> Linear easing banned. Duration < 300ms for UI. Start scale >= 0.9. transform+opacity only. ease-out default. Origin-aware. Reduced-motion mandatory. Spring for anything alive. Blur when crossfade looks off. Every animation needs a purpose.
