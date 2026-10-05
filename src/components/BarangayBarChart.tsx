import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
} from 'recharts';
import { MapPin, X, BarChart3, type LucideIcon } from 'lucide-react';
import { useReports } from '../context/ReportsContext';

export type AnalyticsReport = {
  id: string;
  barangay: string;
  type: string;
  urgency: string;
  source: string;
  time: string;
  status: string;
  verifiedAt?: string | null;
};

const ACCENT_BLUE = '#0071E3';
const RED = '#DC2626';

const URGENCY_BAR_COLOR: Record<string, string> = {
  High: RED,
  Moderate: '#F59E0B',
  Low: '#10B981',
};

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

function formatBarangayLabel(name: string, isMobile: boolean) {
  if (!name) return '';
  if (!isMobile) return name;
  const cleaned = name
    .replace(/^Poblacion\s+Barangay\s+/i, 'Brgy ')
    .replace(/^Barangay\s+/i, 'Brgy ')
    .replace(/^Sta\.\s+/i, 'Sta. ')
    .replace(/^Santa\s+/i, 'Sta. ');
  return cleaned.length > 8 ? `${cleaned.slice(0, 7)}…` : cleaned;
}

function AppleCard({
  children,
  className = '',
  specular = true,
}: {
  children: ReactNode;
  className?: string;
  specular?: boolean;
}) {
  return (
    <div
      className={`relative backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] ${
        specular ? 'border-t border-t-white/80 dark:border-t-white/10' : ''
      } transition-all ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
  iconColor = ACCENT_BLUE,
  iconBg,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  badge?: ReactNode;
  iconColor?: string;
  iconBg?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2.5 sm:gap-3 mb-2.5 sm:mb-4 shrink-0">
      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs"
          style={{
            background: iconBg ?? `${iconColor}14`,
            borderColor: `${iconColor}24`,
            color: iconColor,
          }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-slate-900 dark:text-white truncate">
            {title}
          </h2>
          {description && (
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
              {description}
            </p>
          )}
        </div>
      </div>
      {badge}
    </div>
  );
}

interface CTP {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: any;
    color?: string;
  }>;
  label?: string;
}

function BarangayTooltip({ active, payload }: CTP) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload as { name?: string; count?: number; dominantUrgency?: string } | undefined;
  if (!item) return null;
  const barColor = URGENCY_BAR_COLOR[item.dominantUrgency ?? ''] ?? ACCENT_BLUE;
  return (
    <div className="backdrop-blur-xl bg-white/95 dark:bg-slate-850/95 border border-slate-200/80 dark:border-white/15 px-3.5 py-2.5 rounded-xl shadow-xl text-xs space-y-1">
      <p className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</p>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-700/60">
        <span className="text-slate-500 dark:text-slate-400">Total reports:</span>
        <span className="font-bold text-slate-900 dark:text-white tabular-nums">{item.count}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-500 dark:text-slate-400">Dominant:</span>
        <span className="font-semibold text-[11px] px-1.5 py-0.5 rounded" style={{ color: barColor, background: `${barColor}18` }}>
          {item.dominantUrgency} Urgency
        </span>
      </div>
    </div>
  );
}

export interface BarangayBarChartProps {
  reports?: AnalyticsReport[];
  interactive?: boolean;
  activeBarangay?: string | null;
  onSelectBarangay?: (barangay: string | null) => void;
  className?: string;
}

export function BarangayBarChart({
  reports: propReports,
  interactive = true,
  activeBarangay = null,
  onSelectBarangay,
  className = '',
}: BarangayBarChartProps) {
  const { reports: contextReports } = useReports();
  const isMobile = useIsMobile();
  const rawReports = propReports ?? (contextReports as unknown as AnalyticsReport[]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { count: number; urgencyCounts: Record<string, number> }> = {};
    (rawReports || []).forEach((r) => {
      const n = r.barangay || 'Unknown';
      if (!grouped[n]) grouped[n] = { count: 0, urgencyCounts: {} };
      grouped[n].count++;
      const urg = r.urgency || 'Low';
      grouped[n].urgencyCounts[urg] = (grouped[n].urgencyCounts[urg] || 0) + 1;
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, v]) => {
        const dominantUrgency = Object.entries(v.urgencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Low';
        return { name, count: v.count, dominantUrgency };
      });
  }, [rawReports]);

  return (
    <AppleCard className={`p-3 sm:p-5 lg:p-6 flex flex-col min-h-0 ${className}`}>
      <SectionHeader
        icon={MapPin}
        title="Incident Frequency per Barangay"
        description={
          interactive
            ? 'Click any bar to filter all analytics to that specific location'
            : 'Distribution of reported incidents across Talisay barangays'
        }
        iconColor="#0071E3"
        badge={
          interactive && activeBarangay ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0071E3]/10 text-[#0071E3] dark:text-sky-400 border border-[#0071E3]/20 text-xs font-semibold">
              <span>Filtered: {activeBarangay}</span>
              <button
                onClick={() => onSelectBarangay?.(null)}
                className="hover:opacity-75 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : null
        }
      />

      {chartData.length ? (
        <div className="w-full flex-1 min-w-0 min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 8,
                right: 8,
                left: isMobile ? -26 : -14,
                bottom: isMobile ? 44 : 36,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-slate-200/50 dark:text-slate-800/60"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: isMobile ? 9.5 : 11, fill: '#94a3b8' }}
                axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
                tickLine={false}
                angle={isMobile ? -40 : -30}
                textAnchor="end"
                interval={0}
                tickFormatter={(val) => formatBarangayLabel(val, isMobile)}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: isMobile ? 9.5 : 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 24 : 32}
              />
              <Tooltip content={<BarangayTooltip />} cursor={{ fill: 'rgba(0,113,227,0.06)' }} />
              <Bar
                dataKey="count"
                radius={[5, 5, 0, 0]}
                barSize={isMobile ? 16 : 24}
                maxBarSize={isMobile ? 18 : 28}
                cursor={interactive ? 'pointer' : 'default'}
                onClick={
                  interactive
                    ? (d: { name?: string }) => {
                        if (!d?.name) return;
                        onSelectBarangay?.(activeBarangay === d.name ? null : (d.name ?? null));
                      }
                    : undefined
                }
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={URGENCY_BAR_COLOR[entry.dominantUrgency] ?? ACCENT_BLUE}
                    opacity={interactive && activeBarangay && activeBarangay !== entry.name ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 text-xs gap-2 flex-1">
          <BarChart3 className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600" />
          <span>No incident records match current filters.</span>
        </div>
      )}

      {/* Urgency Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mt-2 sm:mt-4 pt-2 sm:pt-3.5 border-t border-slate-100 dark:border-white/5 shrink-0">
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Urgency Legend
        </span>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
          {Object.entries(URGENCY_BAR_COLOR).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </AppleCard>
  );
}

export default BarangayBarChart;
