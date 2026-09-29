---
name: responsive-design
description: Implement modern responsive layouts using container queries, fluid typography, CSS Grid, and mobile-first breakpoint strategies. Use when building adaptive interfaces, implementing fluid layouts, or creating component-level responsive behavior across phones, tablets, and desktops.
---

# Responsive Design

Master modern responsive design techniques to create interfaces that adapt seamlessly across all screen sizes and device contexts.

## When to Use This Skill

- Implementing mobile-first responsive layouts
- Using container queries for component-based responsiveness
- Creating fluid typography and spacing scales
- Building complex layouts with CSS Grid and Flexbox
- Designing breakpoint strategies for design systems
- Implementing responsive images and media
- Creating adaptive navigation patterns
- Building responsive tables and data displays

## Core Principles & Breakpoints

### Tailwind Breakpoint Scale
- Mobile / Base: `< 640px` (phones)
- `sm`: `>= 640px` (large phones, small tablets)
- `md`: `>= 768px` (tablets, portrait iPad)
- `lg`: `>= 1024px` (laptops, landscape iPad / small desktops)
- `xl`: `>= 1280px` (desktops)
- `2xl`: `>= 1536px` (large screens)

### Key Rules
1. **Mobile-First Always**: Write base styles for the narrowest viewports (360px–390px), then progressively enhance with `sm:`, `md:`, and `lg:`.
2. **Prevent Overflow & Horizontal Scroll**: Use `min-w-0`, `truncate`, `overflow-hidden`, and flex wrap strategies. Never allow fixed pixel widths to force container blowout.
3. **Adaptive Component Heights**: Avoid rigid desktop heights (e.g. `h-[580px]`) on small mobile viewports where screen height is constrained (~667px). Use progressive heights like `h-[420px] sm:h-[480px] lg:h-[580px]`.
4. **Adaptive Modals & Sheets**: Full screen or near-full screen (`h-[88vh] sm:h-[80vh]`) on mobile, hiding auxiliary sidebars/drawers unless toggled.
5. **Touch Targets & Density**: Ensure interactive targets have at least 44x44px touch targets or adequate tap padding on mobile devices.

## Detailed patterns and worked examples

Detailed pattern documentation lives in `references/details.md`.
