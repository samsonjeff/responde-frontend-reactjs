/**
 * PageLoader — shared skeleton loading component
 *
 * Pure CSS pulse-shimmer skeletons, zero external dependencies, zero build step.
 * Each variant mirrors the real page's layout exactly so there is no layout shift
 * when content arrives.
 *
 * Usage (early-return pattern — never wraps real content):
 *
 *   if (loading) return <PageLoader variant="dashboard" />;
 *   return <RealContent />;
 */

// ── Skeleton atom ────────────────────────────────────────────────────────────
function Bone({
  className = '',
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={style}
      className={`bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse ${className}`}
      {...props}
    />
  );
}

// ── Variant skeletons ────────────────────────────────────────────────────────

/** Mirrors the Dashboard 12-col grid: 4 stat cards + left activity feeds + right map */
function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6 h-full lg:grid-rows-[auto_1fr] overflow-x-hidden w-full">
      {/* ── Stat cards row ── */}
      <div className="col-span-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4"
            >
              <Bone className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Bone className="h-6 w-16" />
                <Bone className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Left column: two activity feed panels ── */}
      <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 h-full lg:min-h-0">
        {[...Array(2)].map((_, pi) => (
          <div
            key={pi}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col lg:min-h-0 overflow-hidden"
          >
            {/* panel header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <Bone className="h-4 w-40" />
            </div>
            {/* panel rows */}
            <div className="p-3 space-y-2 flex-1 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Bone className="w-8 h-8 rounded-full shrink-0" />
                  <Bone className="h-3 flex-1" />
                  <Bone className="h-3 w-14 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Right column: map panel ── */}
      <div className="col-span-12 lg:col-span-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:min-h-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <Bone className="h-4 w-36" />
          <Bone className="h-3 w-24" />
        </div>
        <Bone className="flex-1 min-h-[320px] rounded-none rounded-b-xl" />
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-center gap-6 shrink-0">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Bone className="w-2.5 h-2.5 rounded-full" />
              <Bone className="h-2.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mirrors MessengerBotLogs: filter bar + split conversation list / chat panel */
function MessengerSkeleton() {
  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 shrink-0">
        <div className="flex flex-wrap gap-3">
          <Bone className="h-9 w-28" />
          <Bone className="h-9 w-28" />
          <Bone className="h-9 w-28" />
          <Bone className="h-9 w-28 ml-auto" />
          <Bone className="h-9 w-28" />
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
        {/* Left: conversation list */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <Bone className="h-4 w-40" />
          </div>
          <div className="flex-1 overflow-hidden">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 border-b border-slate-50 dark:border-slate-700/50"
              >
                <Bone className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex justify-between gap-2">
                    <Bone className="h-3 w-28" />
                    <Bone className="h-3 w-10 shrink-0" />
                  </div>
                  <div className="flex gap-2">
                    <Bone className="h-2.5 w-16" />
                    <Bone className="h-2.5 w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: chat detail */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
          {/* chat header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 shrink-0">
            <Bone className="w-10 h-10 rounded-full shrink-0" />
            <div className="space-y-2">
              <Bone className="h-4 w-32" />
              <Bone className="h-3 w-24" />
            </div>
          </div>
          {/* chat bubbles */}
          <div className="flex-1 p-5 space-y-4 overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'justify-end' : ''}`}>
                {i % 2 !== 0 && <Bone className="w-7 h-7 rounded-full shrink-0" />}
                <Bone className={`h-10 rounded-2xl ${i % 2 === 0 ? 'w-48' : 'w-56'}`} />
                {i % 2 === 0 && <Bone className="w-7 h-7 rounded-full shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mirrors ScraperFeed: filter bar + split post list / post detail */
function ScraperSkeleton() {
  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 shrink-0">
        <div className="flex flex-wrap gap-3">
          <Bone className="h-9 w-28" />
          <Bone className="h-9 w-28" />
          <Bone className="h-9 w-28" />
          <Bone className="h-9 w-28" />
          <Bone className="h-9 w-28 ml-auto" />
          <Bone className="h-9 w-28" />
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-5 min-h-0">
        {/* Left: post list */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <Bone className="h-4 w-32" />
          </div>
          <div className="flex-1 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="p-4 border-b border-slate-50 dark:border-slate-700/50"
              >
                <div className="flex items-start gap-3">
                  <Bone className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex justify-between gap-2">
                      <Bone className="h-3 w-24" />
                      <Bone className="h-3 w-12 shrink-0" />
                    </div>
                    <Bone className="h-2.5 w-20" />
                    <Bone className="h-3 w-full" />
                    <Bone className="h-3 w-4/5" />
                    <div className="flex gap-2 pt-1">
                      <Bone className="h-4 w-12 rounded-full" />
                      <Bone className="h-4 w-14 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: post detail */}
        <div className="hidden lg:flex lg:col-span-7 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-col overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <Bone className="h-4 w-32" />
          </div>
          <div className="flex-1 p-5 space-y-4 overflow-hidden">
            <div className="flex items-center gap-3">
              <Bone className="w-12 h-12 rounded-full shrink-0" />
              <div className="space-y-2">
                <Bone className="h-4 w-36" />
                <Bone className="h-3 w-24" />
              </div>
            </div>
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-3/4" />
            <div className="border border-slate-100 dark:border-slate-700 rounded-xl p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Bone className="h-3 w-24" />
                  <Bone className="h-3 w-32" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Bone className="h-9 w-28 rounded-lg" />
              <Bone className="h-9 w-28 rounded-lg" />
              <Bone className="h-9 w-28 rounded-lg ml-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mirrors IncidentReports: tabs segmented bar + filter toolbar + pro data table */
function IncidentsSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 relative">
      {/* Tabs skeleton */}
      <div className="p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl inline-flex items-center gap-1 shrink-0 self-start">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-4 py-2 flex items-center gap-2">
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-6 rounded-full" />
          </div>
        ))}
      </div>

      {/* Filter toolbar skeleton */}
      <div className="backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shrink-0 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Bone className="w-7 h-7 rounded-lg" />
            <Bone className="h-4 w-14" />
          </div>
          <Bone className="h-10 w-32 rounded-xl" />
          <Bone className="h-10 w-32 rounded-xl" />
          <Bone className="h-10 w-32 rounded-xl" />
          <div className="flex items-center gap-3 lg:ml-auto">
            <Bone className="h-10 w-36 rounded-xl" />
            <Bone className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white/90 dark:bg-[#111827]/90 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Table header skeleton */}
        <div className="px-4 py-3.5 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-800 flex items-center gap-4">
          <Bone className="w-4 h-4 rounded" />
          <Bone className="h-3 w-8" />
          <Bone className="h-3 w-20" />
          <Bone className="h-3 w-24" />
          <Bone className="h-3 w-16" />
          <Bone className="h-3 w-16" />
          <Bone className="h-3 w-14" />
          <Bone className="h-3 w-16 ml-auto" />
          <Bone className="h-3 w-12" />
        </div>
        {/* Table rows skeleton */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 flex-1 overflow-hidden p-1">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-4">
              <Bone className="w-4 h-4 rounded" />
              <Bone className="h-3.5 w-10 font-mono" />
              <Bone className="h-3.5 w-24" />
              <Bone className="h-3.5 w-28" />
              <Bone className="h-5 w-16 rounded-full" />
              <Bone className="h-5 w-20 rounded-full" />
              <Bone className="h-3.5 w-16" />
              <Bone className="h-3.5 w-16 ml-auto" />
              <Bone className="h-7 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Geospatial Map Skeleton ──────────────────────────────────────────────────
function GeospatialSkeleton() {
  return (
    <div
      className="flex flex-col flex-1 min-h-0 gap-4 p-0 animate-pulse"
      aria-busy="true"
      aria-label="Loading map..."
    >
      {/* Top Toolbar Row */}
      <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 p-3.5 shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-4">
          {/* Left: Filter Controls */}
          <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:items-center md:gap-2.5">
            <Bone className="h-8 w-full md:w-28 rounded-xl" />
            <Bone className="h-8 w-full md:w-32 rounded-xl" />
          </div>

          {/* Center: Layer Toggles */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl w-full md:w-auto justify-center">
            <Bone className="h-7 w-16 sm:w-20 rounded-xl" />
            <Bone className="h-7 w-14 sm:w-16 rounded-xl" />
            <Bone className="h-7 w-14 sm:w-18 rounded-xl" />
          </div>

          {/* Right: Plotted chip */}
          <Bone className="h-7 w-24 rounded-xl hidden md:block" />
        </div>
      </div>

      {/* Map + Side Panel Grid */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left Sidebar Skeleton (3 cols, hidden on mobile) */}
        <div className="hidden lg:flex lg:col-span-3 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 flex-col overflow-hidden min-h-0">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <Bone className="h-4 w-4 rounded" />
              <Bone className="h-4 w-24" />
              <Bone className="h-4 w-6 rounded-full" />
            </div>
            <Bone className="h-6 w-6 rounded-lg" />
          </div>

          {/* Priority Legend */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100/60 dark:border-white/5">
            <Bone className="h-3 w-12" />
            <Bone className="h-3 w-10" />
            <Bone className="h-3 w-10" />
            <Bone className="h-3 w-10" />
          </div>

          {/* List items */}
          <div className="p-2.5 space-y-2 flex-1 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-100/80 dark:border-white/5 bg-slate-50/40 dark:bg-slate-800/20 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Bone className="h-2 w-2 rounded-full" />
                  <Bone className="h-3 w-10" />
                  <Bone className="h-3.5 w-24" />
                  <Bone className="h-3 w-12 ml-auto" />
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Bone className="h-4 w-20 rounded-md" />
                  <Bone className="h-4 w-12 rounded-md ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Map Canvas Shell (9 cols) */}
        <div className="col-span-12 lg:col-span-9 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 p-3 sm:p-3.5 flex flex-col overflow-hidden min-h-[500px] lg:min-h-0">
          <div className="relative flex-1 min-h-0 w-full rounded-xl overflow-hidden border border-slate-200/70 dark:border-white/10 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,113,227,0.06)_0,transparent_70%)]" />
            <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-600">
              <div className="w-12 h-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 flex items-center justify-center shadow-sm">
                <Bone className="w-6 h-6 rounded-lg" />
              </div>
              <Bone className="h-3.5 w-28" />
            </div>
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Bone className="h-8 w-8 rounded-lg" />
              <Bone className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Analytics Skeleton ────────────────────────────────────────────────────────
function AnalyticsSkeleton() {
  return (
    <div
      className="w-full space-y-6 pb-8 animate-pulse"
      aria-busy="true"
      aria-label="Loading analytics..."
    >
      {/* 1. Header & Filter Bar Skeleton Card */}
      <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 md:p-6 space-y-5">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Bone className="w-11 h-11 rounded-2xl" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Bone className="h-6 w-32" />
                <Bone className="h-5 w-24 rounded-full" />
              </div>
              <Bone className="h-3.5 w-64" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Bone className="h-8 w-24 rounded-xl" />
            <Bone className="h-8 w-28 rounded-xl" />
          </div>
        </div>

        {/* Filter row */}
        <div className="pt-4 border-t border-slate-200/60 dark:border-white/5 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Bone className="h-8 w-20 rounded-xl" />
            <Bone className="h-8 w-28 rounded-xl" />
            <Bone className="h-8 w-28 rounded-xl" />
            <Bone className="h-8 w-28 rounded-xl" />
          </div>
          <div className="flex items-center gap-3 xl:ml-auto">
            <Bone className="h-8 w-32 rounded-xl" />
            <Bone className="h-8 w-32 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 2. 5-Stat Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white/80 dark:bg-[#111827]/80 border border-slate-200/80 dark:border-white/10 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <Bone className="h-3 w-20" />
              <Bone className="w-8 h-8 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Bone className="h-7 w-14" />
              <Bone className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Charts Row Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Chart Card */}
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#111827]/80 border border-slate-200/80 dark:border-white/10 flex flex-col space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Bone className="w-8 h-8 rounded-xl" />
            <div className="space-y-1">
              <Bone className="h-4 w-44" />
              <Bone className="h-3 w-60" />
            </div>
          </div>
          <div className="h-64 flex items-end gap-3 pt-6 px-2">
            {[40, 65, 85, 30, 95, 55, 75, 45].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <Bone className="w-full rounded-t-md" style={{ height: `${h}%` }} />
                <Bone className="h-2.5 w-6" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Donut Card */}
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#111827]/80 border border-slate-200/80 dark:border-white/10 flex flex-col space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Bone className="w-8 h-8 rounded-xl" />
            <div className="space-y-1">
              <Bone className="h-4 w-40" />
              <Bone className="h-3 w-56" />
            </div>
          </div>
          <div className="h-64 flex items-center justify-center gap-6">
            <div className="w-40 h-40 rounded-full border-8 border-slate-200/60 dark:border-slate-800/80 flex items-center justify-center">
              <Bone className="w-16 h-4" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center gap-2">
                  <Bone className="w-3 h-3 rounded-full" />
                  <Bone className="h-3 w-20" />
                  <Bone className="h-3 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────
export type PageLoaderVariant = 'dashboard' | 'messenger' | 'scraper' | 'incidents' | 'geospatial' | 'analytics';

interface PageLoaderProps {
  variant: PageLoaderVariant;
}

/**
 * Render a content-shaped skeleton for the given page variant.
 * Use the early-return pattern — never wrap real content with this:
 *
 *   if (loading) return <PageLoader variant="dashboard" />;
 *   return <RealContent />;
 */
export default function PageLoader({ variant }: PageLoaderProps) {
  if (variant === 'dashboard') return <DashboardSkeleton />;
  if (variant === 'messenger') return <MessengerSkeleton />;
  if (variant === 'scraper') return <ScraperSkeleton />;
  if (variant === 'geospatial') return <GeospatialSkeleton />;
  if (variant === 'analytics') return <AnalyticsSkeleton />;
  return <IncidentsSkeleton />;
}

