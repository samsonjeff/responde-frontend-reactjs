# responsive-design — detailed patterns and worked examples

## Core Capabilities

### 1. Container Queries & Flex Adaptations
- Component-level responsiveness independent of viewport
- Flex wraps and min-w-0 for content truncation
- Mobile-first breakpoint progression: Base -> sm -> md -> lg -> xl

### 2. Fluid Typography & Spacing
- Mobile: Compact density, tighter gaps (`gap-3 sm:gap-4 lg:gap-6`, `p-3.5 sm:p-5`)
- Adaptive text sizes: `text-xs sm:text-sm`, `text-2xl sm:text-3xl`
- Prevent header collisions: Hide decorative labels on extra small screens (`hidden sm:inline-flex`), truncate long titles.

### 3. Layout Patterns
- CSS Grid Bento rows:
  - Row 1: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
  - Row 2: Stacked on mobile/tablet (`col-span-12`), split on desktop (`lg:col-span-4` and `lg:col-span-8`)
  - Row 3: Stacked on mobile/tablet (`col-span-12`), split on desktop (`lg:col-span-7` and `lg:col-span-5`)
- Height proportionality:
  - Phone: `h-[400px]` to `h-[440px]`
  - Tablet: `h-[460px]` to `h-[500px]`
  - Desktop: `h-[480px]` to `h-[580px]`

### 4. Modal & Sheet Adaptation
- Split modals (list + detail):
  - Mobile (<md): Show detail chat full-width (`w-full`), hide list (`hidden md:flex md:w-72 lg:w-80`)
  - Tablet/Desktop (>=md): Display side-by-side list + thread
  - Header actions: Wrap or hide secondary metadata (like PSID) on narrow screens so close & action buttons remain readily clickable.
