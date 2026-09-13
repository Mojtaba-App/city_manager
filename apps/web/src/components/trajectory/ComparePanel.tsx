'use client';

import { TrajectoryCompareResult } from '@city-manager/shared';
import { formatDate, formatNumber } from '@/lib/format';

export function ComparePanel({ data }: { data: TrajectoryCompareResult }) {
  const changed = data.changes.filter((c) => c.changed);

  return (
    <div className="compare-panel card">
      <h4>مقایسه وضعیت</h4>
      <p className="muted compare-range">
        از {formatDate(data.baselineDate)}
        {' '}تا {formatDate(data.currentDate)}
      </p>

      {changed.length === 0 ? (
        <p className="muted">تغییر معناداری در این بازه ثبت نشده</p>
      ) : (
        <table className="case-table compare-table">
          <thead>
            <tr><th>شاخص</th><th>گذشته</th><th>فعلی</th></tr>
          </thead>
          <tbody>
            {changed.map((c) => (
              <tr key={c.field}>
                <td>{c.label}</td>
                <td>{formatVal(c.before)}</td>
                <td className="compare-after">{formatVal(c.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.eventsBetween.length > 0 && (
        <div className="compare-events">
          <strong>{formatNumber(data.eventsBetween.length)} رویداد در این بازه</strong>
          <ul className="simple-list">
            {data.eventsBetween.slice(0, 5).map((e) => (
              <li key={e.id}>
                {e.title} — {e.eventDate ? formatDate(e.eventDate) : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'بله' : 'خیر';
  return String(v);
}
