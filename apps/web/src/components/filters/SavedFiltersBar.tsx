'use client';

import { useEffect, useState } from 'react';
import { SavedFilterPreset } from '@city-manager/shared';
import { useFeedback } from '@/components/ui/Feedback';
import { useAuth } from '@/lib/auth';
import {
  deleteFilterPreset,
  loadSavedFilters,
  saveFilterPreset,
} from '@/lib/saved-filters';

interface SavedFiltersBarProps<T> {
  scope: string;
  currentFilter: T;
  onApply: (filter: T) => void;
  equals: (a: T, b: T) => boolean;
  describe: (filter: T) => string;
  isDefault: (filter: T) => boolean;
}

export function SavedFiltersBar<T>({
  scope,
  currentFilter,
  onApply,
  equals,
  describe,
  isDefault,
}: SavedFiltersBarProps<T>) {
  const feedback = useFeedback();
  const { profile } = useAuth();
  const userId = profile?.id;
  const [presets, setPresets] = useState<SavedFilterPreset<T>[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPresets(loadSavedFilters<T>(scope, userId));
  }, [scope, userId]);

  async function handleSave() {
    if (isDefault(currentFilter)) {
      feedback.error('ابتدا فیلتری غیر از پیش‌فرض انتخاب کنید', 'ذخیره فیلتر');
      return;
    }
    const name = await feedback.prompt('نام این فیلتر را وارد کنید', {
      title: 'ذخیره فیلتر',
      defaultValue: describe(currentFilter).slice(0, 40),
    });
    if (!name?.trim()) return;
    const duplicate = presets.find((p) => p.name === name.trim());
    if (duplicate) {
      const ok = await feedback.confirm('فیلتری با این نام وجود دارد. بازنویسی شود؟', 'ذخیره فیلتر');
      if (!ok) return;
      deleteFilterPreset(scope, duplicate.id, userId);
    }
    const next = saveFilterPreset(scope, name.trim(), currentFilter, userId);
    setPresets(next);
    feedback.success('فیلتر ذخیره شد');
    setOpen(false);
  }

  async function handleDelete(id: string, name: string) {
    const ok = await feedback.confirm(`فیلتر «${name}» حذف شود؟`, 'حذف فیلتر');
    if (!ok) return;
    setPresets(deleteFilterPreset(scope, id, userId) as SavedFilterPreset<T>[]);
    feedback.success('فیلتر حذف شد');
  }

  const activePresetId = presets.find((p) => equals(p.filter, currentFilter))?.id;

  return (
    <div className="saved-filters-bar">
      <div className="saved-filters-chips">
        {presets.length === 0 ? (
          <span className="muted saved-filters-empty">فیلتر ذخیره‌شده‌ای نیست</span>
        ) : presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`saved-filter-chip ${activePresetId === preset.id ? 'active' : ''}`}
            onClick={() => onApply(preset.filter)}
            title={describe(preset.filter)}
          >
            {preset.name}
          </button>
        ))}
      </div>
      <div className="saved-filters-actions">
        <button type="button" className="btn btn-sm" onClick={() => void handleSave()} disabled={isDefault(currentFilter)}>
          ذخیره فیلتر
        </button>
        {presets.length > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
            مدیریت
          </button>
        )}
      </div>
      {open && presets.length > 0 && (
        <ul className="saved-filters-manage">
          {presets.map((preset) => (
            <li key={preset.id}>
              <span>{preset.name}</span>
              <small className="muted">{describe(preset.filter)}</small>
              <button type="button" className="btn btn-sm" onClick={() => void handleDelete(preset.id, preset.name)}>
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
