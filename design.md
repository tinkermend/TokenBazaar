# Design — TokenBazaar × PriceAI (Aurora Lumen)

A locked design system for both products. Every page redesign reads this file
before emitting code. Do not regenerate per page — extend or amend this file
when the system needs to grow.


## Brand (locked 2026-07-31)
- **Display name**: 词元集市
- **English product code** (repos/env): TokenBazaar × PriceAI (internal only)
- **Tagline**: AI 订阅与 API 比价
- **Mark**: marketplace canopy over three token pillars; Aurora violet `#8b5cf6` → `#7c3aed`
- **Assets**: PriceAI `src/app/icon.svg` + `AppLogo`/`BrandMark`; TokenBazaar `frontend/public/logo.svg`
- Do not revert UI chrome to PriceAI / Sub2API display strings.

## Genre
modern-minimal · light paper · soft-tech

## Macrostructure family
- Marketing / portal pages (PriceAI): **feature stack** — sticky frosted header,
  hero kicker + display display, module cards, list rows with mono metrics.
- App pages (TokenBazaar console): **workbench** — left rail + sticky top bar +
  content canvas. No marketing enrichment inside app chrome.
- Auth pages: centered card on **Aurora** stage.

## Theme (locked — Aurora Lumen)
OKLCH sources from prototype C + BG Aurora; hex bridges for Tailwind / inline.

| Token | OKLCH | Hex bridge |
| --- | --- | --- |
| `--color-paper` | oklch(98.4% 0.004 280) | `#fbfcfe` |
| `--color-paper-2` | oklch(96% 0.01 280) | `#f1f3f9` |
| `--color-ink` | oklch(20% 0.02 280) | `#1a1828` |
| `--color-ink-2` | oklch(48% 0.02 280) | `#65607a` |
| `--color-rule` | oklch(91% 0.01 280) | `#e3e4ee` |
| `--color-accent` | oklch(55% 0.2 300) | `#8b5cf6` |
| `--color-accent-2` | oklch(42% 0.14 300) | `#6d28d9` |
| `--color-focus` | accent @ 22% mix | ring `rgba(139,92,246,0.28)` |

Semantic (not brand):
- success: `#2f7a4b` / bg `#e8f3ec`
- warning: `#7a541b` / bg `#fff7e8`
- danger: `#9b3328` / bg `#fbe9e7`
- info: `#4c5d8a` / bg `#eef1fb`

### Surface / background treatment — **Aurora** (chosen)
Page stage uses fixed pseudo-layers:
1. Base paper `#fbfcfe`
2. Radial glows: accent 12–18% at top-left / violet soft at top-right / faint bottom
3. Sparse 22px dot lattice at ~40% opacity, masked to upper ellipse

Do **not** use full-page hairline grid as the default (Grid remains a prototype-only option, not production default).

Dark theme: keep cool charcoal violet-tinted surfaces; accent lifts to `#a78bfa`.

## Typography
- Display / UI sans: **Inter**, weight 600–700, tracking −0.02em to −0.03em
- Body: **Inter** + `"PingFang SC", "Microsoft YaHei"` for CJK
- Mono / kickers: **IBM Plex Mono**, 10–12px, uppercase + 0.06–0.08em tracking for labels
- Type scale anchor: page title ≈ `clamp(1.4rem, 2vw, 2rem)`

## Spacing
4-point scale via Tailwind defaults. Prefer `p-4/6/8`, `gap-2/3/4`.
Cards: padding 16–28px. Section gaps 20–32px.

## Radius
- Control / input: `10–12px` (`rounded-xl`)
- Card: `14–16px` (`rounded-2xl` where spacious)
- CTA / chips / nav active: **pill** `999px`
- Focus ring: 3px soft accent glow

## Motion
- Easing: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
- Short: 180–220ms opacity / transform
- Reduced-motion: opacity only ≤ 150ms
- No celebratory confetti; silent success

## Microinteractions
- Hover delay none on chrome; 0ms focus
- Primary hover: deepen ink / accent 1 step
- Inputs: border → accent + 3px ring wash

## CTA voice
- Primary: solid **ink** (`#1a1828`) text white, pill, height 40–44px, weight 700
- Accent / brand emphasis: solid **violet** (`#8b5cf6`) when signaling product brand or positive highlight
- Secondary: white fill, `1px` rule border, pill, ink text
- Ghost: transparent + rule border

## Per-page allowances
- PriceAI marketing: Aurora stage on body; soft card elevation OK
- TokenBazaar app: Aurora wash **subtle** behind workbench; sidebar solid white/translucent
- Auth: full Aurora stage + left accent bar optional on card

## What pages MUST share
- Wordmark treatment, accent violet ≤ ~5% of viewport (glows + small badges)
- Inter + IBM Plex Mono pairing
- Pill CTA voice
- Paper / ink / rule tokens

## What pages MAY differ on
- Macrostructure within family
- Density (admin tables denser than marketing lists)

## Exports — CSS variables
```css
:root {
  --color-paper: #fbfcfe;
  --color-paper-2: #f1f3f9;
  --color-ink: #1a1828;
  --color-ink-2: #65607a;
  --color-rule: #e3e4ee;
  --color-accent: #8b5cf6;
  --color-accent-2: #6d28d9;
  --font-display: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-body: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace;
  --radius-card: 16px;
  --radius-control: 12px;
  --radius-pill: 999px;
  --shadow-surface: 0 18px 50px rgba(26, 24, 40, 0.06);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 200ms;
}
```

## Implementation map
- TokenBazaar: `frontend/tailwind.config.js`, `frontend/src/style.css`, layout shells, `index.html` fonts
- PriceAI: `src/app/globals.css`, `src/app/layout.tsx` fonts + body stage, shells using tokens
- Shared product paths: `/Users/tinker/src/fuye/TokenBazaar`, `/Users/tinker/src/fuye/PriceAI`

## Decision log
- 2026-07-30: User chose **Aurora 柔光极光** background over Grid/Orbit/Horizon.
- UI direction follows Pulse Soft-Tech (C) with Aurora stage; green brand shifted to violet accent; semantic success green retained.
- 2026-07-30: **light-first** — default theme is light; system `prefers-color-scheme: dark` is ignored until the user explicitly toggles dark.
- 2026-07-30: PriceAI page shells use transparent page stage so body Aurora glows remain visible; section panels stay solid white.
