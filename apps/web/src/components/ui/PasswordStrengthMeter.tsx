'use client';

import { useMemo, useState } from 'react';
import {
  evaluatePasswordStrength,
  generateStrongPassword,
  passwordRequirementChecks,
  type PasswordStrengthLevel,
} from '@city-manager/shared';

export function PasswordStrengthMeter({
  password,
  onGenerated,
  showGenerator = false,
}: {
  password: string;
  onGenerated?: (value: string) => void;
  showGenerator?: boolean;
}) {
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const checks = useMemo(() => passwordRequirementChecks(password), [password]);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function generate() {
    const next = generateStrongPassword(16);
    onGenerated?.(next);
  }

  if (strength.level === 'empty' && !showGenerator) return null;

  return (
    <div className="password-strength" role="status" aria-live="polite">
      {showGenerator && (
        <div className="password-gen-actions">
          <button type="button" className="btn btn-sm" onClick={generate}>
            تولید رمز قوی
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void copyPassword()} disabled={!password}>
            {copied ? 'کپی شد' : 'کپی رمز'}
          </button>
        </div>
      )}
      {strength.level !== 'empty' && (
        <>
          <div className="password-strength-track" aria-hidden>
            <div
              className={`password-strength-fill level-${strength.level}`}
              style={{ width: `${Math.max(strength.score, 8)}%` }}
            />
          </div>
          <span className={`password-strength-label level-${strength.level}`}>
            {strength.label}
          </span>
          <ul className="password-req-list">
            {checks.map((c) => (
              <li key={c.id} className={c.met ? 'met' : ''}>
                <span className="password-req-tick" aria-hidden>{c.met ? '✓' : '○'}</span>
                {c.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export type { PasswordStrengthLevel };
