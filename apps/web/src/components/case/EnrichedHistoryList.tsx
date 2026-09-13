'use client';

import { EnrichedChangeLogEntry } from '@city-manager/shared';
import { formatDateTime } from '@/lib/format';

const ACTION_LABELS: Record<string, string> = {
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  update_location: 'تغییر موقعیت',
};

export function EnrichedHistoryList({ entries }: { entries: EnrichedChangeLogEntry[] }) {
  if (!entries.length) {
    return <p className="muted">تاریخچه‌ای موجود نیست</p>;
  }

  return (
    <ul className="history-list enriched-history">
      {entries.map((entry) => (
        <li key={entry.id} className="enriched-history-item">
          <div className="enriched-history-head">
            <strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong>
            <span className="muted">{formatDateTime(entry.changedAt)}</span>
          </div>
          {entry.changedByName && (
            <small className="muted">توسط {entry.changedByName}</small>
          )}
          {entry.fieldChanges && entry.fieldChanges.length > 0 && (
            <ul className="field-changes">
              {entry.fieldChanges.map((fc) => (
                <li key={fc.field}>
                  <span>{fc.label}</span>
                  <span className="field-change-values">
                    {fc.oldValue != null && <del>{String(fc.oldValue)}</del>}
                    {fc.newValue != null && <ins>{String(fc.newValue)}</ins>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
