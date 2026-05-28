Design System — RANO LN

Overview

This document captures the visual system, token scale, responsive breakpoints, and component guidance for the RANO LN newsroom/editorial UI. Use this as the single source of truth while we refactor components and the admin dashboard.

Guiding principles

- Preserve editorial/newsprint identity: strong typographic scale, high information density, strict geometry.
- Token-first: CSS variables + Tailwind tokens where used.
- Mobile-first responsive rules and measured whitespace.
- Component primitives like Card, Panel, ListRow, TableRow, FormField, Modal.
- Accessibility: focus-visible, 44px touch targets, high contrast text and keyboard navigation.

Design tokens (canonical)

Colors
- --color-paper: #F9F9F7
- --color-paper-warm: #F4ECD8
- --color-ink: #111111
- --color-ink-muted: #666666
- --color-accent: #CC0000
- --color-accent-dark: #990000
- --color-rule: #DDDDDD
- --color-surface: #FFFFFF
- Semantic colors: --color-success, --color-warning, --color-danger, --color-info

Typography
- Heading font: var(--font-heading)
- Body font: var(--font-body)
- UI font: var(--font-ui)
- System: h1..h6 use fluid sizing via clamp(); base body uses 1rem with line-height 1.6
- Use `max-width` constraints for reading column (60–75 characters) on large screens

Spacing (modular rhythm)
- --spacing-xs: 4px
- --spacing-sm: 8px
- --spacing-md: 16px
- --spacing-lg: 24px
- --spacing-xl: 32px
- --spacing-2xl: 48px
- --spacing-3xl: 64px

Breakpoints (mobile-first)
- mobile: 0–640px (small)
- tablet: 641–1024px (medium)
- desktop: 1025–1440px (large)
- wide: 1441px+ (xlarge)

Grid
- 12-column baseline for admin pages.
- Editorial grids: 1–4 column `grid-newspaper` for article summaries.
- Container max-width: 1280px (centered) for admin shell; reading center column max-width ~720px.

Components and layout rules
- Shell regions: `Header`, `LeftRail`, `ContentArea`, `RightRail`.
- LeftRail: collapsible on small screens; pinned on desktop.
- Cards: consistent padding (var(--spacing-md)), border: 1px solid var(--color-rule), surface background.
- Lists: ListRow component with consistent min-height and truncated text.
- Forms: use `FormField` with label above input, 8–12px gap.

Responsive behavior rules
- Mobile-first: stack content, increase vertical rhythm, collapse secondary nav into hamburger or bottom nav.
- Editor: split-screen on >= 1024px; single column editor (editor above preview) on <= 1024px.
- Media: images respond to container width using `max-width: 100%`, `height: auto`; use `srcset`/`sizes`.

Accessibility
- Focus: `:focus-visible` outline 2px accent color.
- Touch targets: minimum 44x44pt.
- Keyboard: all interactive elements should be reachable and operable.

Migration & Implementation plan

Phase 1 — Foundations (this PR)
- Add/verify design tokens (main.css already declares tokens).
- Create `docs/DESIGN_SYSTEM.md` (this file).
- Replace raw ad-hoc textareas with `UiTextarea` and add local autosave (done).

Phase 2 — Component refactor
- Create shared primitives in `app/components/ui/` (Card, Panel, ListRow, TableRow).
- Replace per-page ad-hoc panels with primitives.
- Standardize spacing via utility classes that reference tokens.

Phase 3 — Layout shell & navigation
- Implement App Shell with `Header`, `LeftRail`, `ContentArea`, `RightRail`.
- Collapse/pin behavior for left rail and responsive switching to bottom nav for mobile.

Phase 4 — Rich text editor & media
- Integrate TipTap (client-only) as the editor core.
- Autosave to IndexedDB + optimistic save to API.
- Media upload pipeline hooked to R2 with background processing.

Phase 5 — Performance & QA
- API consolidation, caching, virtualization for lists.
- Lighthouse audits, e2e, accessibility testing.

Developer notes

- Use the CSS variables defined in `app/assets/css/main.css` as canonical tokens.
- Prefer lazy-loading heavy editor and analytics components.
- Keep changes small per PR and include visual diffs/screenshots.

Contact
- Ask in PR comments if unsure about token usage or visual adjustments.
