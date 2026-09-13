'use client';

import { useEffect, useMemo, useState } from 'react';
import { NavIcon } from '@/components/NavIcons';
import { useFeedback } from '@/components/ui/Feedback';
import { upsertSetting } from '@/lib/admin-api';
import {
  SIDEBAR_ICON_OPTIONS,
  SidebarNavSetting,
  flattenNavItems,
} from '@/lib/nav-config';
import { SettingsAccordion } from './SettingsAccordion';

type DraftRow = {
  href: string;
  defaultLabel: string;
  label: string;
  icon: string;
  hidden: boolean;
};

export function SidebarNavSettings({
  initial,
  canWrite,
  onSaved,
}: {
  initial?: SidebarNavSetting | null;
  canWrite: boolean;
  onSaved?: () => void;
}) {
  const feedback = useFeedback();
  const defaults = useMemo(() => flattenNavItems(), []);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const items = initial?.items ?? {};
    const order = initial?.order ?? defaults.map((d) => d.href);
    const byHref = new Map(
      defaults.map((d) => [
        d.href,
        {
          href: d.href,
          defaultLabel: d.label,
          label: items[d.href]?.label ?? d.label,
          icon: items[d.href]?.icon ?? d.icon,
          hidden: Boolean(items[d.href]?.hidden),
        } satisfies DraftRow,
      ]),
    );
    const ordered: DraftRow[] = [];
    for (const href of order) {
      const row = byHref.get(href);
      if (row) {
        ordered.push(row);
        byHref.delete(href);
      }
    }
    ordered.push(...byHref.values());
    setRows(ordered);
  }, [defaults, initial]);

  function updateRow(href: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.href === href ? { ...r, ...patch } : r)));
  }

  function move(href: string, dir: -1 | 1) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.href === href);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  async function save() {
    setSaving(true);
    const items: Record<string, { label?: string; icon?: string; hidden?: boolean }> = {};
    for (const row of rows) {
      const base = defaults.find((d) => d.href === row.href);
      if (!base) continue;
      const label = row.label.trim() || base.label;
      const icon = row.icon.trim() || base.icon;
      const changed = label !== base.label || icon !== base.icon || row.hidden;
      if (changed) {
        items[row.href] = {
          ...(label !== base.label ? { label } : {}),
          ...(icon !== base.icon ? { icon } : {}),
          ...(row.hidden ? { hidden: true } : {}),
        };
      }
    }
    const value: SidebarNavSetting = {
      items,
      order: rows.map((r) => r.href),
    };
    const res = await upsertSetting({
      key: 'sidebar_nav',
      value: value as Record<string, unknown>,
      description: 'برچسب، ترتیب و نمایش آیتم‌های سایدبار',
    });
    setSaving(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ذخیره ناموفق بود', 'خطا');
      return;
    }
    feedback.success('تغییرات منو ذخیره شد', 'سایدبار به‌روز شد');
    onSaved?.();
    window.dispatchEvent(new CustomEvent('cm:sidebar-nav-updated'));
  }

  return (
    <SettingsAccordion
      title="منوی سایدبار"
      description="ترتیب، مخفی‌سازی، عنوان و آیکن هر بخش منو"
      icon="layers"
    >
      <div className="sidebar-nav-editor">
        {rows.map((row, index) => (
          <div key={row.href} className={`sidebar-nav-editor-row${row.hidden ? ' is-hidden' : ''}`}>
            <div className="sidebar-nav-editor-preview" title={row.href}>
              <NavIcon name={row.icon} size={18} />
              <span>{row.defaultLabel}</span>
            </div>
            <label>
              <span>عنوان نمایشی</span>
              <input
                type="text"
                value={row.label}
                disabled={!canWrite}
                onChange={(e) => updateRow(row.href, { label: e.target.value })}
              />
            </label>
            <label>
              <span>آیکن</span>
              <select
                value={row.icon}
                disabled={!canWrite}
                onChange={(e) => updateRow(row.href, { icon: e.target.value })}
              >
                {SIDEBAR_ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>
            <label className="sidebar-nav-hide">
              <input
                type="checkbox"
                checked={row.hidden}
                disabled={!canWrite}
                onChange={(e) => updateRow(row.href, { hidden: e.target.checked })}
              />
              <span>مخفی</span>
            </label>
            {canWrite && (
              <div className="sidebar-nav-order">
                <button type="button" className="btn btn-sm" disabled={index === 0} onClick={() => move(row.href, -1)}>↑</button>
                <button type="button" className="btn btn-sm" disabled={index === rows.length - 1} onClick={() => move(row.href, 1)}>↓</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'در حال ذخیره…' : 'ذخیره منوی سایدبار'}
          </button>
        </div>
      )}
    </SettingsAccordion>
  );
}
