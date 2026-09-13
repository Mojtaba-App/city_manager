'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  USER_INACTIVE_REASON_PRESETS,
  resolveInactiveReason,
  type UserInactiveReasonPresetId,
} from '@city-manager/shared';

export type UserAccountReasonDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function UserAccountReasonDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: UserAccountReasonDialogProps) {
  const [presetId, setPresetId] = useState<UserInactiveReasonPresetId>('left_org');
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPresetId('left_org');
    setCustomText('');
    setError('');
  }, [open]);

  if (!open) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const resolved = resolveInactiveReason(presetId, customText);
    if (resolved.error || !resolved.reason) {
      setError(resolved.error ?? 'دلیل نامعتبر است');
      return;
    }
    setError('');
    onConfirm(resolved.reason);
  }

  return (
    <div className="ui-dialog-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="ui-dialog-card user-reason-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-reason-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 id="user-reason-dialog-title">{title}</h3>
        <p className="ui-dialog-message">{message}</p>

        <fieldset className="user-reason-presets">
          <legend>دلیل</legend>
          {USER_INACTIVE_REASON_PRESETS.map((p) => (
            <label key={p.id} className="user-reason-preset">
              <input
                type="radio"
                name="inactive-reason-preset"
                value={p.id}
                checked={presetId === p.id}
                onChange={() => {
                  setPresetId(p.id);
                  setError('');
                }}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </fieldset>

        {presetId === 'custom' && (
          <label className="form-group user-reason-custom">
            <span>توضیح دلیل</span>
            <textarea
              rows={3}
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
                setError('');
              }}
              placeholder="دلیل را به‌صورت دستی وارد کنید…"
              autoFocus
            />
          </label>
        )}

        {error && <p className="error-message">{error}</p>}

        <div className="ui-dialog-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            انصراف
          </button>
          <button
            type="submit"
            className={`btn ${danger ? 'regen-btn-danger' : 'btn-primary'}`}
            disabled={busy}
          >
            {busy ? 'در حال ثبت…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
