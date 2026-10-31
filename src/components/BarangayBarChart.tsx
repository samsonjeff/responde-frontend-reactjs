import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
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
const RED = '#EF4444';

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

/**
 * Modern fluid wave bar with dual counter-flowing waves,
 * specular top highlight, and hover glow for Barangay frequency.
 */
function BarangayModernWaveBar(props: any) {
  const { x, y, width, height, payload, activeBarangay } = props;
  if (x == null || y == null || width == null || height == null || height <= 0 || !payload) {
    return null;
  }

  const name: string = payload.name || 'Barangay';
  const dominantUrgency: string = payload.dominantUrgency || 'Low';
  const color: string = URGENCY_BAR_COLOR[dominantUrgency] ?? ACCENT_BLUE;
  const isDimmed = activeBarangay && activeBarangay.toLowerCase() !== name.toLowerCase();
  const isSelected = activeBarangay && activeBarangay.toLowerCase() === name.toLowerCase();

  const w = Math.max(width, 14);
  const h = Math.max(height, 6);
  const r = Math.min(6, w / 2, h / 2);
  const bottomY = y + h;

  // Fluid water wave amplitude
  const amp = Math.min(3.6, Math.max(1.8, Math.min(h * 0.1, w * 0.11)));
  const waveY = y + amp + 1;

  const clipId = `brgy-bar-clip-${name.replace(/[^a-zA-Z0-9]/g, '')}`;

  const clipRectPath = `
    M ${x},${bottomY}
    L ${x},${y + r}
    Q ${x},${y} ${x + r},${y}
    L ${x + w - r},${y}
    Q ${x + w},${y} ${x + w},${y + r}
    L ${x + w},${bottomY}
    Z
  `;

  const buildWavePath = (yLine: number, waveAmp: number) => `
    M ${x},${yLine}
    Q ${x + w * 0.25},${yLine - waveAmp} ${x + w * 0.5},${yLine}
    T ${x + w},${yLine}
    Q ${x + w * 1.25},${yLine - waveAmp} ${x + w * 1.5},${yLine}
    T ${x + w * 2},${yLine}
    L ${x + w * 2},${bottomY + 2}
    L ${x},${bottomY + 2}
    Z
  `;

  return (
    <g
      className="minimal-2d-bar-group cursor-pointer"
      style={
        {
          opacity: isDimmed ? 0.35 : 1,
          '--bar-hover-shadow': `${color}66`,
          filter: isSelected ? `drop-shadow(0 0 10px ${color})` : undefined,
        } as React.CSSProperties
      }
    >
      <defs>
        <clipPath id={clipId}>
          <path d={clipRectPath} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Secondary counter-flowing water wave */}
        <path d={buildWavePath(waveY - amp * 0.4, amp * 0.85)} fill={color} fillOpacity={0.42}>
          <animateTransform
            attributeName="transform"
            type="translate"
            from={`${-w} 0`}
            to="0 0"
            dur="3.4s"
            repeatCount="indefinite"
          />
        </path>

        {/* Primary flowing wave surface */}
        <path d={buildWavePath(waveY, amp)} fill={color} fillOpacity={1}>
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to={`${-w} 0`}
            dur="2.4s"
            repeatCount="indefinite"
          />
        </path>

        {/* Specular curved light sheen along upper crest */}
        <path
          d={`M ${x + r},${y + 1.5} Q ${x + w * 0.5},${y + 1} ${x + w - r},${y + 1.5}`}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1.5}
          strokeLinecap="round"
          pointerEvents="none"
        />
      </g>

      {/* Selected outline ring */}
      {isSelected && (
        <path
          d={clipRectPath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      )}
    </g>
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
    <div className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-white/15 px-3.5 py-2.5 rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.18)] text-xs space-y-1.5 min-w-[155px]">
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}88` }}
        />
        <p className="font-bold text-slate-900 dark:text-white text-xs truncate">{item.name}</p>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="text-slate-500 dark:text-slate-400">Total reports:</span>
        <span className="font-bold text-slate-900 dark:text-white tabular-nums">{item.count}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-500 dark:text-slate-400">Dominant Urgency:</span>
        <span
          className="font-semibold text-[11px] px-2 py-0.5 rounded-md"
          style={{ color: barColor, background: `${barColor}18` }}
        >
          {item.dominantUrgency}
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
  const rawReports = propReports ?? (contextReports as unknown as AnalyticsReport[]).filter((r) => r.status === 'verified');

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
                type="button"
                onClick={() => onSelectBarangay?.(null)}
                className="hover:opacity-75 transition-opacity cursor-pointer p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : null
        }
      />

      {chartData.length ? (
        <div className="w-full flex-1 min-w-0 min-h-0 relative" style={{ minHeight: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 14,
                right: 12,
                left: isMobile ? -24 : -12,
                bottom: isMobile ? 48 : 38,
              }}
              onClick={(state: any) => {
                if (!interactive) return;
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clicked = state.activePayload[0].payload.name;
                  onSelectBarangay?.(activeBarangay === clicked ? null : clicked);
                }
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
                angle={isMobile ? -35 : -25}
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
                barSize={isMobile ? 22 : 32}
                maxBarSize={38}
                cursor={interactive ? 'pointer' : 'default'}
                isAnimationActive={false}
                shape={<BarangayModernWaveBar activeBarangay={activeBarangay} />}
              />
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
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
              <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </AppleCard>
  );
}

export default BarangayBarChart;
