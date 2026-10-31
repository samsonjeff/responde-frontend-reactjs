/**
 * PageLoader — shared skeleton loading component
 *
 * Apple-grade soft shimmer skeletons matching the exact geometry, typography
 * rhythm, and card proportions of each page. Eliminates layout shift (CLS = 0)
 * when real data finishes hydrating.
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
      className={`skeleton-bone rounded-xl ${className}`}
      {...props}
    />
  );
}

// ── Variant skeletons ────────────────────────────────────────────────────────

/**
 * Mirrors Dashboard:
 * 1. Top personalized greeting header
 * 2. 4 raised stat cards (Total Incidents, Under Review, Verified Incidents, High Urgency)
 * 3. Main 2-column section (8-col Latest Reports table + 4-col Reports by Type bar chart)
 */
function DashboardSkeleton() {
  return (
    <div className="dashboard-soft flex flex-col flex-1 min-h-0 w-full h-full relative" aria-busy="true" aria-label="Loading dashboard...">
      <div className="flex flex-col flex-1 min-h-0 space-y-4 sm:space-y-5 w-full h-full">
        {/* ── Top Header Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-1.5">
            <Bone className="h-7 w-48 rounded-xl" />
            <Bone className="h-4 w-72 sm:w-96 rounded-lg" />
          </div>
        </div>

        {/* ── Row 1: 4 Raised Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 shrink-0">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between min-w-0"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <Bone className="h-3 w-20 rounded-md" />
                <Bone className="h-7 sm:h-8 w-16 rounded-lg" />
                <div className="flex items-center gap-1.5">
                  <Bone className="w-1.5 h-1.5 rounded-full shrink-0" />
                  <Bone className="h-3 w-24 rounded-full" />
                </div>
              </div>
              <Bone className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl shrink-0" />
            </div>
          ))}
        </div>

        {/* ── Row 2: Main 2-Column Section (8-col Latest Reports & 4-col Reports by Type) ── */}
        <div className="grid grid-cols-12 gap-4 sm:gap-5 lg:gap-6 flex-1 min-h-0 w-full items-stretch">
          {/* Left Column: Latest Reports Table (Col 8) */}
          <div className="col-span-12 lg:col-span-8 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden h-full">
            {/* Header Row */}
            <div className="p-4 sm:p-5 border-b border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <Bone className="h-5 w-32 rounded-lg" />
              {/* Urgency Pill [All] [High] [Low] */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl gap-1">
                <Bone className="h-6 w-10 rounded-lg" />
                <Bone className="h-6 w-12 rounded-lg" />
                <Bone className="h-6 w-10 rounded-lg" />
              </div>
            </div>

            {/* Table Header Row */}
            <div className="px-4 sm:px-6 py-3 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.01]">
              <Bone className="h-3 w-10 rounded-md" />
              <Bone className="h-3 w-28 rounded-md" />
              <Bone className="h-3 w-16 rounded-md hidden sm:block" />
              <Bone className="h-3 w-16 rounded-md hidden md:block" />
              <Bone className="h-3 w-14 rounded-md hidden sm:block" />
              <Bone className="h-3 w-12 rounded-md" />
            </div>

            {/* Table Rows (8 rows mirroring real dashboard) */}
            <div className="divide-y divide-slate-100/80 dark:divide-white/5 flex-1 overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                  <Bone className="h-5 w-16 sm:w-20 rounded-md" />
                  <Bone className="h-4 w-28 sm:w-36 rounded-md" />
                  <Bone className="h-5 w-16 rounded-full hidden sm:block" />
                  <Bone className="h-5 w-20 rounded-full hidden md:block" />
                  <Bone className="h-3.5 w-16 rounded-md hidden sm:block" />
                  <Bone className="h-7 w-16 rounded-lg shrink-0" />
                </div>
              ))}
            </div>

            {/* Table Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/30 dark:bg-white/[0.01]">
              <Bone className="h-3.5 w-36 rounded-md" />
              <Bone className="h-3.5 w-44 rounded-md" />
            </div>
          </div>

          {/* Right Column: Reports by Type Card (Col 4) */}
          <div className="col-span-12 lg:col-span-4 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden h-full">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
              <Bone className="h-5 w-32 rounded-lg" />
              <div className="flex items-center gap-2">
                <Bone className="h-6 w-8 rounded-lg" />
                <Bone className="h-4 w-16 rounded-md" />
              </div>
            </div>

            {/* Instruction subtext */}
            <div className="px-4 sm:px-5 pt-4 pb-2">
              <Bone className="h-3 w-56 rounded-md" />
            </div>

            {/* Vertical Bar Chart area */}
            <div className="p-4 sm:px-6 flex-1 flex items-end justify-between gap-2 sm:gap-3 min-h-[220px]">
              {[80, 42, 28, 26, 20, 12, 8].map((pct, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <Bone
                    className="w-full max-w-[36px] rounded-t-lg"
                    style={{ height: `${pct}%` }}
                  />
                  <Bone className="h-2.5 w-8 rounded-md" />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/30 dark:bg-white/[0.01]">
              <Bone className="h-3 w-48 rounded-md" />
              <Bone className="h-3 w-16 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors MessengerBotLogs:
 * 1. Top Page Header with MessageSquare icon
 * 2. Filter Bar with responsive pill dropdowns
 * 3. 2-column split pane (5-col conversation list + 7-col chat feed & detail panel)
 */
function MessengerSkeleton() {
  return (
    <div className="messenger-soft flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full relative" aria-busy="true" aria-label="Loading messenger logs...">
      <div className="flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full">
        {/* Top Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <Bone className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl shrink-0" />
            <div className="space-y-1.5">
              <Bone className="h-6 sm:h-7 w-48 rounded-xl" />
              <Bone className="h-3.5 w-72 sm:w-96 rounded-md" />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-3 sm:p-4 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Bone className="h-9 w-20 rounded-xl" />
            <Bone className="h-9 w-28 sm:w-32 rounded-xl" />
            <Bone className="h-9 w-28 sm:w-32 rounded-xl" />
            <Bone className="h-9 w-28 sm:w-32 rounded-xl" />
            <Bone className="h-9 w-28 sm:w-32 rounded-xl" />
            <div className="flex items-center gap-2.5 sm:ml-auto">
              <Bone className="h-9 w-32 rounded-xl" />
              <Bone className="h-9 w-32 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Split Pane: 5-col conversation list + 7-col chat feed */}
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-3 sm:gap-3.5 min-h-0 items-stretch">
          {/* Left: Conversation List (5 cols) */}
          <div className="lg:col-span-5 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden h-full">
            {/* Segmented switcher & action */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02]">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <Bone className="h-7 w-20 rounded-lg" />
                <Bone className="h-7 w-20 rounded-lg" />
              </div>
              <Bone className="h-4 w-20 rounded-md" />
            </div>

            {/* Conversation Items */}
            <div className="flex-1 p-2 sm:p-2.5 space-y-1.5 overflow-hidden">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl border border-slate-100/80 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.01]"
                >
                  <Bone className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <Bone className="h-3.5 w-28 rounded-md" />
                      <Bone className="h-3 w-12 rounded-md shrink-0" />
                    </div>
                    <Bone className="h-3 w-full rounded-md" />
                    <div className="flex items-center gap-2 pt-0.5">
                      <Bone className="h-4 w-16 rounded-full" />
                      <Bone className="h-4 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Chat Feed & Triage Detail (7 cols) */}
          <div className="hidden lg:flex lg:col-span-7 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex-col overflow-hidden h-full">
            {/* Chat Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Bone className="w-10 h-10 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Bone className="h-4 w-32 rounded-md" />
                  <Bone className="h-3 w-24 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Bone className="h-8 w-20 rounded-xl" />
                <Bone className="h-8 w-24 rounded-xl" />
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-5 space-y-4 overflow-hidden bg-slate-50/30 dark:bg-slate-900/20">
              {/* NLP Triage Callout Banner */}
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <Bone className="h-4 w-36 rounded-md" />
                  <Bone className="h-4 w-16 rounded-full" />
                </div>
                <Bone className="h-3 w-full rounded-md" />
              </div>

              {/* Chat bubbles */}
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`flex items-end gap-2.5 ${i % 2 === 0 ? 'justify-end' : ''}`}>
                  {i % 2 !== 0 && <Bone className="w-8 h-8 rounded-full shrink-0" />}
                  <div className={`space-y-1.5 ${i % 2 === 0 ? 'items-end' : ''}`}>
                    <Bone className={`h-11 rounded-2xl ${i % 2 === 0 ? 'w-56' : 'w-64'}`} />
                    <Bone className="h-2.5 w-12 rounded-md" />
                  </div>
                  {i % 2 === 0 && <Bone className="w-8 h-8 rounded-full shrink-0" />}
                </div>
              ))}
            </div>

            {/* Action footer */}
            <div className="p-3.5 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02]">
              <Bone className="h-9 w-32 rounded-xl" />
              <Bone className="h-9 w-28 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors ScraperFeed:
 * 1. Top Page Header with Globe icon
 * 2. Filter Bar
 * 3. 2-column split pane (5-col social post feed + 7-col post detail inspector)
 */
function ScraperSkeleton() {
  return (
    <div className="scraper-soft flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full relative" aria-busy="true" aria-label="Loading scraper feed...">
      <div className="flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full">
        {/* Top Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <Bone className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl shrink-0" />
            <div className="space-y-1.5">
              <Bone className="h-6 sm:h-7 w-40 rounded-xl" />
              <Bone className="h-3.5 w-72 sm:w-96 rounded-md" />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-3 sm:p-4 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Bone className="h-9 w-20 rounded-xl" />
            <Bone className="h-9 w-28 sm:w-32 rounded-xl" />
            <Bone className="h-9 w-28 sm:w-32 rounded-xl" />
            <Bone className="h-9 w-28 sm:w-32 rounded-xl" />
            <Bone className="h-9 w-28 sm:w-32 rounded-xl" />
            <div className="flex items-center gap-2.5 sm:ml-auto">
              <Bone className="h-9 w-32 rounded-xl" />
              <Bone className="h-9 w-32 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Split Pane: 5-col post feed + 7-col post inspector */}
        <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-3 sm:gap-3.5 min-h-0 items-stretch">
          {/* Left: Scraped Post Feed (5 cols) */}
          <div className="md:col-span-5 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden h-full">
            {/* Segmented switcher */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02]">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <Bone className="h-7 w-20 rounded-lg" />
                <Bone className="h-7 w-20 rounded-lg" />
              </div>
              <Bone className="h-4 w-20 rounded-md" />
            </div>

            {/* Post Feed Items */}
            <div className="flex-1 p-2 sm:p-2.5 space-y-2 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="p-3 sm:p-3.5 rounded-xl border border-slate-100/80 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.01] space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <Bone className="w-8 h-8 rounded-full shrink-0" />
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <Bone className="h-3.5 w-24 rounded-md" />
                        <Bone className="h-3 w-12 rounded-md" />
                      </div>
                      <Bone className="h-2.5 w-20 rounded-md" />
                    </div>
                  </div>
                  <Bone className="h-3 w-full rounded-md" />
                  <Bone className="h-3 w-4/5 rounded-md" />
                  <div className="flex items-center gap-2 pt-1">
                    <Bone className="h-4 w-14 rounded-full" />
                    <Bone className="h-4 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination footer */}
            <div className="px-3.5 py-2.5 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.02] flex items-center justify-between shrink-0">
              <Bone className="h-3 w-24 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Bone className="h-7 w-7 rounded-lg" />
                <Bone className="h-7 w-7 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Right: Post Inspector (7 cols) */}
          <div className="hidden md:flex md:col-span-7 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex-col overflow-hidden h-full">
            {/* Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Bone className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Bone className="h-4 w-32 rounded-md" />
                  <Bone className="h-3 w-24 rounded-md" />
                </div>
              </div>
              <Bone className="h-8 w-24 rounded-xl" />
            </div>

            {/* Post Content */}
            <div className="flex-1 p-5 space-y-4 overflow-hidden">
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] space-y-2">
                <Bone className="h-3.5 w-full rounded-md" />
                <Bone className="h-3.5 w-full rounded-md" />
                <Bone className="h-3.5 w-3/4 rounded-md" />
              </div>

              {/* NLP Triage Panel */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-900/30 space-y-3">
                <div className="flex items-center justify-between">
                  <Bone className="h-4 w-32 rounded-md" />
                  <Bone className="h-4 w-20 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Bone className="h-8 rounded-xl" />
                  <Bone className="h-8 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Action footer */}
            <div className="p-4 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3 shrink-0 bg-slate-50/40 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Bone className="h-9 w-24 rounded-xl" />
                <Bone className="h-9 w-24 rounded-xl" />
              </div>
              <Bone className="h-9 w-28 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors IncidentReports:
 * 1. Top Page Header with FileText icon
 * 2. 5 Tabs segmented control (Under Review, Incomplete, Verified, Resolved, Rejected)
 * 3. Filter Toolbar Card
 * 4. Pro Data Table Card with checkbox, status pills, and pagination footer
 */
function IncidentsSkeleton() {
  return (
    <div className="incidents-soft flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full relative" aria-busy="true" aria-label="Loading incident reports...">
      <div className="flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full">
        {/* Top Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <Bone className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl shrink-0" />
            <div className="space-y-1.5">
              <Bone className="h-6 sm:h-7 w-44 rounded-xl" />
              <Bone className="h-3.5 w-72 sm:w-96 rounded-md" />
            </div>
          </div>
        </div>

        {/* 5 Segmented Tabs (Under Review, Incomplete, Verified, Resolved, Rejected) */}
        <div className="p-1 bg-slate-200/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 flex flex-wrap sm:inline-flex items-center gap-1 shrink-0 self-start">
          {[
            { w: 'w-28' },
            { w: 'w-24' },
            { w: 'w-20' },
            { w: 'w-20' },
            { w: 'w-20' },
          ].map((tab, i) => (
            <div key={i} className={`px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 ${tab.w}`}>
              <Bone className="h-4 flex-1 rounded-md" />
              <Bone className="h-4 w-6 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        {/* Filter Toolbar Card */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 shrink-0 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <Bone className="h-9 w-full lg:w-64 rounded-xl" />
            <div className="flex flex-wrap items-center gap-2.5">
              <Bone className="h-9 w-28 rounded-xl" />
              <Bone className="h-9 w-28 rounded-xl" />
              <Bone className="h-9 w-28 rounded-xl" />
              <Bone className="h-9 w-28 rounded-xl" />
            </div>
            <div className="flex items-center gap-2.5 lg:ml-auto">
              <Bone className="h-9 w-32 rounded-xl" />
              <Bone className="h-9 w-32 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Pro Data Table Card */}
        <div className="bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
          {/* Table Header Row */}
          <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bone className="w-4 h-4 rounded" />
              <Bone className="h-3 w-12 rounded-md" />
              <Bone className="h-3 w-24 rounded-md" />
            </div>
            <div className="flex items-center gap-6">
              <Bone className="h-3 w-20 rounded-md hidden md:block" />
              <Bone className="h-3 w-16 rounded-md hidden sm:block" />
              <Bone className="h-3 w-16 rounded-md hidden lg:block" />
              <Bone className="h-3 w-14 rounded-md hidden sm:block" />
              <Bone className="h-3 w-12 rounded-md" />
            </div>
          </div>

          {/* Table Rows (8 rows mirroring real table) */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 flex-1 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Bone className="w-4 h-4 rounded shrink-0" />
                  <Bone className="h-5 w-20 rounded-md font-mono shrink-0" />
                  <div className="flex items-center gap-2">
                    <Bone className="w-7 h-7 rounded-full shrink-0" />
                    <Bone className="h-3.5 w-24 rounded-md" />
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <Bone className="h-3.5 w-24 rounded-md hidden md:block" />
                  <Bone className="h-5 w-20 rounded-full hidden sm:block" />
                  <Bone className="h-5 w-20 rounded-full hidden lg:block" />
                  <Bone className="h-3.5 w-16 rounded-md hidden sm:block" />
                  <Bone className="h-7 w-16 rounded-lg shrink-0" />
                </div>
              </div>
            ))}
          </div>

          {/* Table Pagination Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between shrink-0">
            <Bone className="h-3.5 w-36 rounded-md" />
            <div className="flex items-center gap-2">
              <Bone className="h-8 w-8 rounded-lg" />
              <Bone className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors GeospatialMap:
 * 1. Top Command Toolbar with Header & Live Plotted Counters
 * 2. Filter & Layer Controls
 * 3. 2-column layout (3-col Left Incident Drawer + 9-col MapLibre Canvas Shell)
 */
function GeospatialSkeleton() {
  return (
    <div
      className="geospatial-soft flex flex-col flex-1 min-h-0 gap-3 sm:gap-4 h-full"
      aria-busy="true"
      aria-label="Loading geospatial map..."
    >
      <div className="flex flex-col flex-1 min-h-0 gap-3 sm:gap-4 h-full">
        {/* Top Command Toolbar Panel */}
        <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-4 sm:p-5 space-y-4 shrink-0">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
            <div className="flex items-center gap-3.5">
              <Bone className="w-11 h-11 rounded-2xl shrink-0" />
              <div className="space-y-1.5">
                <Bone className="h-6 w-36 rounded-xl" />
                <Bone className="h-3.5 w-72 sm:w-96 rounded-md" />
              </div>
            </div>
            {/* Live Count Chips */}
            <div className="flex items-center gap-2 shrink-0">
              <Bone className="h-8 w-24 rounded-xl" />
              <Bone className="h-8 w-24 rounded-xl" />
            </div>
          </div>

          {/* Filter & Layer Controls Row */}
          <div className="pt-3.5 border-t border-slate-200/60 dark:border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <Bone className="h-8 w-28 rounded-xl" />
              <Bone className="h-8 w-28 rounded-xl" />
              <Bone className="h-8 w-28 rounded-xl" />
              <Bone className="h-8 w-28 rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <Bone className="h-8 w-48 rounded-2xl" />
              <Bone className="h-8 w-16 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Map & Drawer Grid */}
        <div className="grid grid-cols-12 gap-3 sm:gap-4 flex-1 min-h-0 items-stretch">
          {/* Left Drawer (3 cols, hidden on mobile) */}
          <div className="hidden lg:flex lg:col-span-3 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 flex-col overflow-hidden h-full">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-2">
                <Bone className="h-4 w-24 rounded-md" />
                <Bone className="h-4 w-6 rounded-full" />
              </div>
              <Bone className="h-6 w-6 rounded-lg" />
            </div>

            {/* Priority Legend */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100/60 dark:border-white/5 bg-white/40 dark:bg-[#0f172a]/40">
              <Bone className="h-3 w-16 rounded-md" />
              <div className="flex items-center gap-3">
                <Bone className="h-3 w-10 rounded-md" />
                <Bone className="h-3 w-10 rounded-md" />
                <Bone className="h-3 w-10 rounded-md" />
              </div>
            </div>

            {/* Incident Drawer List */}
            <div className="p-3 space-y-2.5 flex-1 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-100/80 dark:border-white/5 bg-slate-50/40 dark:bg-slate-800/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Bone className="w-6 h-6 rounded-lg shrink-0" />
                    <Bone className="h-3.5 w-24 rounded-md" />
                    <Bone className="h-4 w-12 rounded-full ml-auto" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Bone className="h-3 w-28 rounded-md" />
                    <Bone className="h-3 w-14 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Map Canvas Shell (9 cols) */}
          <div className="col-span-12 lg:col-span-9 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 p-3 sm:p-3.5 flex flex-col overflow-hidden h-full min-h-[500px]">
            <div className="relative flex-1 min-h-0 w-full rounded-xl overflow-hidden border border-slate-200/70 dark:border-white/10 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-600">
                <Bone className="w-12 h-12 rounded-2xl" />
                <Bone className="h-3.5 w-32 rounded-md" />
              </div>
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Bone className="h-8 w-8 rounded-lg" />
                <Bone className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors Analytics:
 * 1. Header & Filter Bar Card
 * 2. 4-Stat Soft Metric Cards (Total Reports, High Urgency, Verified Reports, Pending Review)
 * 3. 2-column Charts Row (Incident Frequency per Barangay + Breakdown by Incident Type donut)
 */
function AnalyticsSkeleton() {
  return (
    <div
      className="analytics-soft w-full space-y-6 pb-0"
      aria-busy="true"
      aria-label="Loading analytics..."
    >
      {/* 1. Header & Filter Bar Card */}
      <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 md:p-6 space-y-5">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Bone className="w-11 h-11 rounded-2xl shrink-0" />
            <div className="space-y-1.5">
              <Bone className="h-6 w-32 rounded-xl" />
              <Bone className="h-3.5 w-72 sm:w-96 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Bone className="h-10 w-28 rounded-xl" />
            <Bone className="h-10 w-32 rounded-xl" />
          </div>
        </div>

        {/* Filter row */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Bone className="h-9 w-20 rounded-xl" />
            <Bone className="h-9 w-28 rounded-xl" />
            <Bone className="h-9 w-28 rounded-xl" />
            <Bone className="h-9 w-28 rounded-xl" />
          </div>
          <div className="flex items-center gap-2.5 md:ml-auto">
            <Bone className="h-9 w-32 rounded-xl" />
            <Bone className="h-9 w-32 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 2. 4-Stat Soft Metric Cards (matches grid-cols-2 lg:grid-cols-4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white/80 dark:bg-[#111827]/80 border border-slate-200/80 dark:border-white/10 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <Bone className="h-3 w-20 rounded-md" />
              <Bone className="w-8 h-8 rounded-xl shrink-0" />
            </div>
            <div className="space-y-2">
              <Bone className="h-8 w-16 rounded-lg" />
              <Bone className="h-3 w-28 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. 2-Column Charts Row (Barangay Bar Chart + Type Donut Chart) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Card: Incident Frequency per Barangay */}
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#111827]/80 border border-slate-200/80 dark:border-white/10 flex flex-col space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Bone className="w-8 h-8 rounded-xl shrink-0" />
            <div className="space-y-1 flex-1">
              <Bone className="h-4 w-48 rounded-md" />
              <Bone className="h-3 w-64 rounded-md" />
            </div>
          </div>
          <div className="h-64 flex items-end gap-3 pt-6 px-2">
            {[45, 70, 85, 30, 95, 55, 75, 40].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <Bone className="w-full rounded-t-md" style={{ height: `${h}%` }} />
                <Bone className="h-2.5 w-6 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Card: Breakdown by Incident Type */}
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#111827]/80 border border-slate-200/80 dark:border-white/10 flex flex-col space-y-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <Bone className="w-8 h-8 rounded-xl shrink-0" />
              <div className="space-y-1">
                <Bone className="h-4 w-40 rounded-md" />
                <Bone className="h-3 w-56 rounded-md" />
              </div>
            </div>
            <Bone className="h-7 w-20 rounded-lg" />
          </div>
          <div className="h-64 flex items-center justify-center gap-8">
            <div className="w-40 h-40 rounded-full border-8 border-slate-200/60 dark:border-slate-800/80 flex items-center justify-center">
              <Bone className="w-16 h-4 rounded-md" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <Bone className="w-3 h-3 rounded-full shrink-0" />
                  <Bone className="h-3 w-24 rounded-md" />
                  <Bone className="h-3 w-8 rounded-md" />
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
