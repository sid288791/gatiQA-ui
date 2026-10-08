/**
 * Lightweight dependency-free charts: SVG donut, stacked vertical bars,
 * and a horizontal 100% stacked bar. Colors are passed as hex so the
 * components stay Tailwind-agnostic.
 */

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  size = 132,
  strokeWidth = 18,
  centerLabel,
  centerSub,
}: {
  segments: ChartSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {total > 0 &&
          segments.map((s) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>{`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && <span className="text-2xl font-semibold text-slate-900">{centerLabel}</span>}
          {centerSub && <span className="text-xs text-slate-500">{centerSub}</span>}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ segments, compact = false }: { segments: ChartSegment[]; compact?: boolean }) {
  if (compact) {
    return (
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="font-medium text-slate-900">{s.value}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-1.5">
      {segments.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
          <span className="flex-1 text-slate-600">{s.label}</span>
          <span className="font-medium text-slate-900">{s.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function StackedBarHorizontal({ segments }: { segments: ChartSegment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
      {total > 0 &&
        segments.map(
          (s) =>
            s.value > 0 && (
              <div
                key={s.label}
                style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
                title={`${s.label}: ${s.value}`}
              />
            ),
        )}
    </div>
  );
}
