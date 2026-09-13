'use client';

import { DistributionBucket, TimeSeriesPoint } from '@city-manager/shared';
import { formatNumber } from '@/lib/format';
import { formatJalaliMonthPeriod } from '@/lib/jalali';

const COLORS = ['#0f4c5c', '#c46b2b', '#175cd3', '#0f7a4c', '#b54708', '#6941c6', '#dd2590', '#5b6b7a'];

export function BarChart({
  title,
  subtitle,
  data,
  color = '#0f4c5c',
}: {
  title: string;
  subtitle?: string;
  data: DistributionBucket[];
  color?: string;
}) {
  const items = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  const max = Math.max(...items.map((d) => d.count), 1);
  return (
    <div className="card analytics-chart">
      <h3>{title}</h3>
      {subtitle && <p className="analytics-chart-sub muted">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="muted">داده‌ای برای این فیلتر نیست</p>
      ) : (
        <div className="bar-chart">
          {items.map((d) => (
            <div key={d.key} className="bar-row">
              <span className="bar-label" title={d.label}>{d.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(d.count / max) * 100}%`, background: color }} />
              </div>
              <span className="bar-value">{formatNumber(d.count)} <small>({formatNumber(d.percent)}٪)</small></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DonutChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: DistributionBucket[];
}) {
  const items = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  const total = items.reduce((s, d) => s + d.count, 0) || 1;
  const size = 160;
  const r = 58;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="card analytics-chart">
      <h3>{title}</h3>
      {subtitle && <p className="analytics-chart-sub muted">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="muted">داده‌ای برای این فیلتر نیست</p>
      ) : (
        <div className="donut-wrap">
          <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" role="img" aria-label={title}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f5" strokeWidth={18} />
            {items.map((d, i) => {
              const len = (d.count / total) * c;
              const el = (
                <circle
                  key={d.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={18}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += len;
              return el;
            })}
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="donut-center">
              {formatNumber(total)}
            </text>
          </svg>
          <ul className="donut-legend">
            {items.map((d, i) => (
              <li key={d.key}>
                <i style={{ background: COLORS[i % COLORS.length] }} />
                {d.label} — {formatNumber(d.count)} ({formatNumber(d.percent)}٪)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LineChart({
  title,
  series,
  color = '#175cd3',
}: {
  title: string;
  series: TimeSeriesPoint[];
  color?: string;
}) {
  const width = 420;
  const height = 200;
  const pad = { top: 16, right: 16, bottom: 44, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  if (series.length === 0) {
    return (
      <div className="card analytics-chart">
        <h3>{title}</h3>
        <p className="muted">سری زمانی برای این فیلتر خالی است</p>
      </div>
    );
  }

  const values = series.map((s) => s.value);
  const max = Math.max(...values, 1);
  const min = 0;
  const coords = series.map((s, i) => {
    const x = pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const y = pad.top + innerH - ((s.value - min) / (max - min || 1)) * innerH;
    return { x, y, ...s };
  });
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const labelStep = Math.max(1, Math.ceil(coords.length / 5));

  return (
    <div className="card analytics-chart">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="line-svg" role="img" aria-label={title}>
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} />
        {coords.map((c) => (
          <circle key={c.period} cx={c.x} cy={c.y} r={3.5} fill={color}>
            <title>{formatJalaliMonthPeriod(c.period)}: {formatNumber(c.value)}</title>
          </circle>
        ))}
        {coords.map((c, i) => (
          (i % labelStep === 0 || i === coords.length - 1) ? (
            <text
              key={`lbl-${c.period}`}
              x={c.x}
              y={height - 12}
              textAnchor="middle"
              className="chart-axis-label"
              fontSize={9}
              fill="#5b6b7a"
            >
              {formatJalaliMonthPeriod(c.period)}
            </text>
          ) : null
        ))}
      </svg>
    </div>
  );
}
