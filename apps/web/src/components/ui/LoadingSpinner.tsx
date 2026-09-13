'use client';

import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { toPersianDigits } from '@/lib/format';

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
};

const SIZE_CLASS = {
  sm: 'ui-spinner-sm',
  md: 'ui-spinner-md',
  lg: 'ui-spinner-lg',
} as const;

export function LoadingSpinner({ size = 'md', label, className = '' }: LoadingSpinnerProps) {
  return (
    <span
      className={`ui-spinner-wrap ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? 'در حال بارگذاری'}
    >
      <span className={`ui-spinner ${SIZE_CLASS[size]}`} aria-hidden />
      {label ? <span className="ui-spinner-label">{label}</span> : null}
    </span>
  );
}

/** Circular upload progress (0–100). Spins gently while below 100%. */
export function ProgressRing({
  value,
  size = 18,
  className = '',
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const stroke = 2.25;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <span
      className={`ui-progress-ring ${className}`.trim()}
      style={{ width: size, height: size } as CSSProperties}
      aria-hidden
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="ui-progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ui-progress-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </span>
  );
}

type ImportBusyLabelProps = {
  percent: number;
  phase?: 'upload' | 'processing' | 'done';
};

export function ImportBusyLabel({ percent, phase = 'upload' }: ImportBusyLabelProps) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const phaseLabel =
    phase === 'processing' ? 'پردازش' : phase === 'done' ? 'تمام' : 'آپلود';
  return (
    <span className="gis-import-busy">
      <ProgressRing value={pct} size={16} />
      <span className="gis-import-busy-text">
        <span>{phaseLabel}</span>
        <span className="gis-import-pct" dir="ltr">
          <span className="gis-import-pct-sign">٪</span>
          <span className="gis-import-pct-num">{toPersianDigits(pct)}</span>
        </span>
      </span>
    </span>
  );
}

type LoadingOverlayProps = {
  open: boolean;
  label?: string;
  hint?: string;
};

export function LoadingOverlay({ open, label = 'در حال پردازش…', hint }: LoadingOverlayProps) {
  if (!open) return null;
  return (
    <div className="ui-loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="ui-loading-card">
        <LoadingSpinner size="lg" />
        <strong>{label}</strong>
        {hint ? <p>{hint}</p> : null}
      </div>
    </div>
  );
}

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
};

export function LoadingButton({
  loading,
  loadingLabel,
  children,
  disabled,
  className = '',
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      type="button"
      className={`ui-loading-btn ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          <span>{loadingLabel ?? 'در حال پردازش…'}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
