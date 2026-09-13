'use client';

import { TrajectoryTrendPoint } from '@city-manager/shared';
import { formatDate, formatNumber } from '@/lib/format';

interface Props {
  title: string;
  points: TrajectoryTrendPoint[];
  valueKey: 'income' | 'qualityOfLifeScore';
  color?: string;
  maxValue?: number;
}

export function TrendChart({ title, points, valueKey, color = '#2563eb', maxValue }: Props) {
  if (points.length === 0) {
    return (
      <div className="trend-chart card">
        <h4>{title}</h4>
        <p className="muted">داده‌ای برای نمایش وجود ندارد</p>
      </div>
    );
  }

  const width = 360;
  const height = 160;
  const pad = { top: 20, right: 16, bottom: 28, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const values = points.map((p) => (valueKey === 'income' ? p.income : p.qualityOfLifeScore) ?? 0);
  const max = maxValue ?? Math.max(...values, 1);
  const min = Math.min(...values, 0);

  const coords = points.map((p, i) => {
    const v = (valueKey === 'income' ? p.income : p.qualityOfLifeScore) ?? 0;
    const x = pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = pad.top + innerH - ((v - min) / (max - min || 1)) * innerH;
    return { x, y, v, date: p.date };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${pad.top + innerH} L ${coords[0].x} ${pad.top + innerH} Z`;

  return (
    <div className="trend-chart card">
      <h4>{title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg" role="img" aria-label={title}>
        <path d={areaPath} fill={color} fillOpacity={0.12} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={4} fill={color} />
            <title>{formatDate(c.date)}: {formatNumber(c.v)}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
