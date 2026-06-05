# Pavel Zverev — Portfolio Site

> 🔴 **СНАЧАЛА читать `SITE_DECISIONS.md`** — канонический журнал актуальных решений и
> граблей (деплой, R2, кодек H.264, CORS, аспекты, постеры, звук, трекбол, чат, нав).
> Раздел ниже от 2026-05-03 частично УСТАРЕЛ (старый глобус с webm-спутниками, stub-страницы) —
> при расхождении верить `SITE_DECISIONS.md`.

## Project
**Path:** D:\pavel-site  
**Goal:** Awwwards-tier portfolio for AI-Creator Pavel Zverev  
**Contact:** Telegram @Verevpz  
**Live:** https://verevpz-boop.github.io/ (GitHub Pages, auto-deploy on push to master)

## Stack
- Next.js 16 + TypeScript + Tailwind v4 + App Router
- Framer Motion (`motion/react` package, not `framer-motion`)
- Fonts: Cormorant Garamond (display), Geist Sans (body)
- Deployment target: GitHub Pages (Cloudflare Pages / Vercel unstable in RF)

## Palette
| Token | Value |
|---|---|
| Background | `#0A0A0A` |
| Gold | `#C9A961` |
| Bordeaux | `#3D1F1F` |
| Off-white | `#F5F1E8` |

## Done (2026-05-03)
- Hero section merged with Globe: single 100vh screen — "NAVIGATE THE WORLDS" top, 3D globe center, "Pavel Zverev / @Verevpz" bottom
- 3D Globe navigation: Earth (radius 4.5, night texture with city lights) + 5 satellite orbits
- Satellites: FASHION (orbit 15.75), TECH (11.25), CINEMA (13.5), GAMING (9), AI-BOTS (18)
- Video satellites: `lookAt(camera) + rotateY(-Math.PI/2)` keeps video front-facing; `meshBasicMaterial` for self-lit display
- Satellite labels: compact at rest (44px), expand on hover (64px + description)
- Hide-behind-Earth occlusion on labels
- BearBrick 3D model (fixed bottom-right) with ASK ME badge + look-at cursor effect
- Two spotlights kept in components but removed from main page

## Key Files
```
app/
  page.tsx              # GlobeSection + BearBrickClient only (Hero removed)
  layout.tsx            # Cormorant + Geist fonts, metadata
  globals.css           # CSS vars, Tailwind v4
  fashion|tech|cinema|gaming|ai-bots/page.tsx  # stub pages

components/
  three/
    globe-section.tsx   # "use client" wrapper, 100vh hero layout
    globe-canvas.tsx    # R3F Canvas, SATELLITES array, camera, lighting
    earth.tsx           # Earth with night texture + atmosphere
    satellite.tsx       # orbit + video/emissive sphere + labels
  BearBrick.tsx         # 3D model with look-at + ASK ME badge
  BearBrickClient.tsx   # dynamic ssr:false wrapper (fixed bottom-right)
  ui/
    spotlight-tracking.tsx   # kept but unused on main page
    spotlight-breathing.tsx  # kept but unused on main page
    magnetic-link.tsx        # reusable magnetic hover

lib/
  utils.ts              # cn() helper
```

## Video Satellites
**Methodology:** 384×384px, WebM VP9, no audio, 1.5s crossfade loop  
**Rendering:** `meshBasicMaterial` + `toneMapped={false}` + `lookAt(camera) + rotateY(-Math.PI/2)`

| Satellite | File | Content | Status |
|---|---|---|---|
| FASHION | `/public/videos/satellites/fashion.webm` | воробей из драгоценных камней, 9 сек | ✅ |
| TECH | `/public/videos/satellites/tech.webm` | реклама кофе Coffee Bros, 15 сек | ✅ |
| CINEMA | `/public/videos/satellites/cinema.webm` | кинематографичный ролик с актёром/эмоцией | ⏳ |
| GAMING | `/public/videos/satellites/gaming.webm` | sci-fi/fantasy/3D-персонаж | ⏳ |
| AI-BOTS | `/public/videos/satellites/ai-bots.webm` | технологично-абстрактное (нейросети, код) | ⏳ |

## Video Assets (Cloudflare R2)
Base URL: `https://pub-4d3c064541404a1eb448a1c1229e2dfc.r2.dev/`  
Files: `LIME.mp4`, `MD1.mp4`, `ВЕНЕТТО.mp4`, `с голосом.mp4`  
Embed via `<video>` tag directly (no Cloudflare Stream needed)

## TODO (next sessions)
1. **Video satellites** — add cinema.webm, gaming.webm, ai-bots.webm (same methodology)
2. **Section pages** — replace stubs with real content (R2 videos, case studies)
3. **Apple Cards Carousel** — case studies per section
4. **Case pages** — individual project pages

## Strategic Note (discuss before building)
Pavel also builds n8n automation bots as a service. Potential pivot:  
**"AI-Creator (video)"** → **"AI-agency of one person: video + bots + avatars"**  
May require architecture rethink + demo bot embedded via n8n webhook.

## Animation Doctrine
**Source:** `docs/EMIL_KOWALSKI_DIGEST.md` (checklist) + `docs/EMIL_KOWALSKI_DIGEST.docx` (full)
**One-liner:** Linear easing banned. Duration < 300ms for UI. Start scale >= 0.9. transform+opacity only. ease-out default. Origin-aware. Reduced-motion mandatory. Spring for anything alive. Every animation needs a purpose.

## Design References
- https://www.romanjeanelie.com/ — motion, luxury dark aesthetic
- https://ui.aceternity.com/ — component library in use
- Aesthetic: fashion-luxury Vogue, restrained expensive animations — NOT nightclub
