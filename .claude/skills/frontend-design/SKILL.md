---
name: frontend-design
description: Build Hebrew RTL frontend UI for the time-reporting system that matches the Figma design system pixel-by-pixel. Use this skill when the user asks to build a screen, component, modal, form, or any UI for the Management (admin desktop), Webapp (employee desktop), or Mobile portal. Pulls authoritative tokens, typography, spacing, and component specs from `specs/figma-design-spec.md`.
license: Complete terms in LICENSE.txt
---

This skill guides creation of UI for the time-reporting system. The product **prioritizes simplicity for the daily reporter** (per `docs/specs/project-spec.md` §43) — utilitarian B2B software, not a marketing site. There is a complete Figma design system that is the source of truth. Your job is to **match it**, not invent.

## Source of truth — read before coding

1. **`specs/figma-design-spec.md`** — pixel-perfect reference: color tokens, typography, spacing, component library, screen-by-screen specs, RTL rules. Authoritative.
2. **`figma/PIXEL_PERFECT_CSS.css`** — production-ready CSS variable file generated from Figma MCP. Import this (or its tokens) into the global stylesheet; don't redefine values.
3. **`figma/`** — additional Figma artifacts when you need more detail:
   - `PIXEL_PERFECT_SPEC.md` — extended spec
   - `FIGMA_COMPONENT_LIBRARY.md` — component catalog
   - `figma-design-tokens.json` / `design-system-spec.json` — machine-readable tokens
   - `Time Report - Bootcamp.fig` — the source Figma file
4. **`src/components/figma-generated/`** — production-ready React components extracted directly from Figma via MCP (`LoginCard`, `MobileFrame`, `BigButton`). Reuse and follow their patterns; don't reinvent.
5. **The relevant `specs/F##-*.md`** — the feature spec for the screen you're building (e.g. F09 daily reporting, F10 timer, F14 admin review). Defines required behavior and UI states.
6. **`docs/specs/project-spec.md`** §6 — global UI state requirements (loading, error, offline, locked-month banner, unsaved-changes warning) every screen must cover.

If a token, size, or behavior is in the Figma spec, **use it verbatim**. Do not substitute "close enough" values.

## Project context (non-negotiable)

- **Three portals**, each with its own conventions (see Figma spec §1.2–1.4 for portal-specific tokens):
  - **Management** (admin desktop) — sidebar `#1B2450`, dark navy table header `#1B2340`, page bg `#F3F4F6`
  - **Webapp** (employee desktop) — page bg `#F2F3F7`, white header, KPI cards rounded-xl, pink timer + orange manual-report pills
  - **Mobile** (React Native / Expo) — page bg `#F2F2F7`, brand pink `#E8627A`, navy CTA `#1C2B5A`, bottom-sheet pickers
- **Hebrew RTL only**: `dir="rtl"` on root, `lang="he"`. All layouts, chevrons, table columns, modal close buttons follow the RTL rules in Figma spec §6.4.
- **Mobile-first responsive**: every flow must work on mobile, even admin flows (project-spec §165).
- **Fonts**: `'Heebo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. Heebo for Hebrew, Inter for numbers/Latin. **Do not** suggest other display fonts — the spec mandates these.
- **Browsers**: latest Chrome / Edge / Safari, desktop and mobile.
- **Timezone**: `Asia/Jerusalem`. Week starts Sunday (Israeli convention). Calendar columns: Sunday rightmost, Saturday leftmost.

## Workflow

1. **Identify the portal** (Management / Webapp / Mobile) and the feature spec (F##).
2. **Read** the relevant section of `specs/figma-design-spec.md`:
   - §1 for color tokens (use the right portal-specific tokens).
   - §2 for typography (use the type scale and per-portal styles).
   - §3 for spacing/layout (per-portal: sidebar width, modal width, row heights, radii).
   - §4 for component specs (button, input, modal, badge, table, calendar, bottom sheet, etc.).
   - §5 for screen-by-screen layouts.
   - §6 for interaction patterns (validation, RTL, accessibility).
3. **Reuse** existing components from `src/components/figma-generated/` before creating new ones. If you need a new primitive (e.g. `Input`, `Select`, `Modal`), build it to the §4 spec and place it under `src/components/`.
4. **Implement** the screen, matching the relevant §5 layout.
5. **Cover required UI states** for the portal: loading, empty, error, offline, locked-month banner (when applicable), unsaved-changes warning (forms).
6. **Verify RTL**: test with `dir="rtl"`. Chevrons pointing left = forward/expand; right = back/close. Close × is top-left in modals. Form labels right-aligned. Table identifier columns on the right, actions on the left.
7. **Verify accessibility**: 44×44px minimum touch targets, ≥4.5:1 text contrast, visible focus ring (`box-shadow: 0 0 0 3px rgba(107,47,170,0.1)` for inputs), keyboard focus trap in modals, Escape to close.

## Token usage — quick reference

Always pull from the CSS custom properties defined in `figma/PIXEL_PERFECT_CSS.css` (mirrored in Figma spec §9). Never hardcode hex codes that exist as tokens.

```css
/* Primary CTA — all portals */
background: var(--color-nav-button);          /* #142A3F */
color: #FFFFFF;
border-radius: var(--radius-sm);              /* 8px desktop / 12px mobile */
height: var(--height-btn);                    /* 48px */

/* Input focus */
border-color: var(--color-brand-purple);      /* #6B2FAA */
box-shadow: 0 0 0 3px var(--color-brand-purple-ring);

/* Card shadow (login card, key cards) */
box-shadow: var(--shadow-card);

/* Body font */
font-family: var(--font-base);
```

## Status badges (Figma spec §4.12)

The badge color/text combinations are fixed. Do not invent new states. Each work-day status maps to one badge:

| State (Hebrew) | Bg | Text |
|---|---|---|
| חסר (missing) | `#FEE2E2` | `#EF4444` |
| 9 שעות (complete) | `#DCFCE7` | `#16A34A` |
| 7 שעות (partial) | `#FEF3C7` | `#D97706` |
| סוף"ש (weekend) | `#DBEAFE` | `#2563EB` |
| מחלה / חופש / מילואים | `#E5E7EB` / `#D8D8E5` | `#374151` / `#555568` |
| חצי חופש + עבודה | `#F0D0F8` | `#8830A8` |

## What NOT to do

- **Don't invent an aesthetic.** No "bold maximalism," "brutalist," "asymmetric grid-breaking," "diagonal flow," "custom cursors," "grain overlays," "dramatic shadows" beyond `--shadow-card`. The spec is a clean, refined business app.
- **Don't substitute fonts.** Heebo + Inter, period. Not Space Grotesk, not Plus Jakarta Sans, not anything else.
- **Don't hardcode colors that exist as tokens.** Use the CSS custom properties from §9.
- **Don't break RTL.** No `margin-left`/`padding-left` for logical-end spacing — use `margin-inline-end` or rely on `dir="rtl"` flipping. Don't assert visual left/right.
- **Don't mix portal tokens.** Mobile pink `#E8627A` ≠ Webapp pink `#EC4899`. Management page bg `#F3F4F6` ≠ Webapp page bg `#F2F3F7`. Match the portal you're building.
- **Don't skip required states.** A screen without loading/error/empty is incomplete per project-spec §6.
- **Don't add framer-motion / heavy animation.** Login card has a 0.3s slide-in, error fields shake, button hover lifts 2px — that's the budget. No staggered reveals, no scroll-triggered animations.
- **Don't reorder column semantics for "balance."** RTL table columns: identifier right, actions left. That's the convention; don't break it.
- **Don't use Azure SSO buttons.** Figma shows them; the v3.2 FINAL spec uses email + password. Use the Figma button as a sizing reference only.

## When the spec is silent

Some screens are not yet in Figma (project-spec §9 lists ~50% missing — desktop absence form, admin rejection dialog, month lock/unlock, timer UI, audit log viewer, export screen, holiday settings, first-login password change, etc.). When building one of these:

1. Follow the same tokens, type scale, spacing, and component primitives from §1–4.
2. Match the portal's existing screens stylistically (look at the closest §5 screen).
3. Cover the required UI states from project-spec §6.
4. Flag explicitly in your response that the screen has no Figma reference and you're extrapolating from the design system, so the user can review.
