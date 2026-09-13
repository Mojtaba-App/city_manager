'use client';

import { useState } from 'react';
import { NavIcon } from '@/components/NavIcons';

export function SettingsAccordion({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`settings-accordion card ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="settings-accordion-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="settings-accordion-titles">
          <h3>
            {icon && <NavIcon name={icon} size={18} />}
            {title}
          </h3>
          {description && <p className="muted">{description}</p>}
        </div>
        <span className={`settings-accordion-chevron ${open ? 'open' : ''}`} aria-hidden>
          <NavIcon name="expand" size={18} />
        </span>
      </button>
      {open && <div className="settings-accordion-body">{children}</div>}
    </section>
  );
}
