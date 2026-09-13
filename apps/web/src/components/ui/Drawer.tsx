'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** RTL: panel slides from inline-start (right) by default */
  side?: 'start' | 'end';
  className?: string;
  width?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'start',
  className = '',
  width = 'min(420px, 92vw)',
}: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`ui-drawer-root ${className}`.trim()} data-side={side}>
      <button
        type="button"
        className="ui-drawer-backdrop"
        aria-label="بستن"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="ui-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={{ width }}
      >
        <header className="ui-drawer-header">
          {title ? <h2 id={titleId} className="ui-drawer-title">{title}</h2> : <span />}
          <button type="button" className="ui-drawer-close" onClick={onClose} aria-label="بستن">
            ×
          </button>
        </header>
        <div className="ui-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
