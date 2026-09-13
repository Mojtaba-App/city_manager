'use client';

import { TrajectoryTimelineItem, LIFE_EVENT_LABELS, LifeEventType } from '@city-manager/shared';
import { formatDate, formatNumber } from '@/lib/format';

const EVENT_COLORS: Partial<Record<LifeEventType, string>> = {
  job_change: '#2563eb',
  income_change: '#059669',
  housing_change: '#d97706',
  qol_change: '#7c3aed',
  support_status_change: '#dc2626',
  education_change: '#0891b2',
};

function eventColor(type?: LifeEventType): string {
  if (type && EVENT_COLORS[type]) return EVENT_COLORS[type]!;
  return '#64748b';
}

export function TimelineView({ items }: { items: TrajectoryTimelineItem[] }) {
  if (items.length === 0) {
    return <p className="muted">هنوز رویدادی ثبت نشده است.</p>;
  }

  return (
    <div className="timeline-track">
      {items.map((item, idx) => (
        <div key={item.id} className="timeline-item">
          <div className="timeline-axis">
            <span
              className="timeline-dot"
              style={{ background: eventColor(item.eventType) }}
            />
            {idx < items.length - 1 && <span className="timeline-line" />}
          </div>
          <div className="timeline-body card">
            <div className="timeline-header">
              <strong>{item.title}</strong>
              <time>{item.eventDate ? formatDate(item.eventDate) : '—'}</time>
            </div>
            {item.memberName && (
              <span className="timeline-member badge">{item.memberName}</span>
            )}
            {item.summary && <p className="timeline-summary">{item.summary}</p>}
            {item.qualityOfLifeScore != null && (
              <div className="timeline-qol">
                <span>کیفیت زندگی</span>
                <div className="qol-bar">
                  <div className="qol-fill" style={{ width: `${item.qualityOfLifeScore * 10}%` }} />
                </div>
                <span>{formatNumber(item.qualityOfLifeScore)}/{formatNumber(10)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventTypeLegend() {
  const types = Object.entries(LIFE_EVENT_LABELS).slice(0, 6) as [LifeEventType, string][];
  return (
    <div className="timeline-legend">
      {types.map(([type, label]) => (
        <span key={type} className="legend-item">
          <i style={{ background: eventColor(type) }} />
          {label}
        </span>
      ))}
    </div>
  );
}
