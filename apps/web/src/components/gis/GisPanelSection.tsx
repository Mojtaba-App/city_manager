'use client';

import { ReactNode, useId, useState } from 'react';

export function GisPanelSection({
  title,
  summary,
  badge,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  summary?: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className={`gis-panel-section${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="gis-panel-section-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="gis-panel-section-title">{title}</span>
        {badge != null && badge !== '' ? (
          <span className="gis-panel-section-badge">{badge}</span>
        ) : null}
        <span className={`gis-panel-section-chevron${open ? ' open' : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {summary ? <p className="gis-panel-section-summary">{summary}</p> : null}
      <div id={panelId} className={`gis-panel-section-body${open ? '' : ' collapsed'}`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
