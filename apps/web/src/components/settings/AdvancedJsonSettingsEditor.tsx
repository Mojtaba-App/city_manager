'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { upsertSetting } from '@/lib/admin-api';

export function AdvancedJsonSettingsEditor({
  items,
  canWrite,
  onSaved,
}: {
  items: Array<{ key: string; value: Record<string, unknown>; description?: string }>;
  canWrite: boolean;
  onSaved?: () => void;
}) {
  const feedback = useFeedback();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('{\n  \n}');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function textFor(key: string, value: Record<string, unknown>) {
    return drafts[key] ?? JSON.stringify(value ?? {}, null, 2);
  }

  async function saveKey(key: string, raw: string, description?: string) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSON باید یک آبجکت باشد');
      }
    } catch (err) {
      await feedback.alert(err instanceof Error ? err.message : 'JSON نامعتبر است', 'ویرایشگر JSON');
      return;
    }
    setBusyKey(key);
    const res = await upsertSetting({ key, value: parsed, description });
    setBusyKey(null);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ذخیره ناموفق', 'ویرایشگر JSON');
      return;
    }
    feedback.success(`کلید «${key}» ذخیره شد`);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    onSaved?.();
  }

  async function createKey() {
    const key = newKey.trim();
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) {
      await feedback.alert('کلید باید با حرف لاتین شروع شود و فقط حرف/رقم/_ باشد', 'کلید جدید');
      return;
    }
    await saveKey(key, newValue, 'کلید پیشرفته سفارشی');
    setNewKey('');
    setNewValue('{\n  \n}');
  }

  return (
    <div className="settings-grid">
      {items.map((s) => (
        <div key={s.key} className="settings-extra-item">
          <div className="card-head">
            <div>
              <h3>{s.key}</h3>
              <p className="muted">{s.description || 'تنظیم سفارشی'}</p>
            </div>
          </div>
          <textarea
            className="settings-json-editor"
            dir="ltr"
            rows={8}
            disabled={!canWrite}
            value={textFor(s.key, s.value)}
            onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
          />
          {canWrite && (
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busyKey === s.key}
                onClick={() => void saveKey(s.key, textFor(s.key, s.value), s.description)}
              >
                {busyKey === s.key ? '…' : 'ذخیره JSON'}
              </button>
            </div>
          )}
        </div>
      ))}

      {canWrite && (
        <div className="settings-extra-item">
          <div className="card-head">
            <div>
              <h3>کلید جدید</h3>
              <p className="muted">افزودن تنظیم پیشرفته با ویرایشگر JSON</p>
            </div>
          </div>
          <label className="form-group">
            <span>نام کلید</span>
            <input dir="ltr" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="password_policy" />
          </label>
          <textarea
            className="settings-json-editor"
            dir="ltr"
            rows={6}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <div className="form-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void createKey()}>
              ایجاد کلید
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
