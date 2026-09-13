'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { globalSearch } from '@/lib/regeneration-api';
import { GlobalSearchResultItem, toLatinDigits } from '@city-manager/shared';
import { useAuth } from '@/lib/auth';

const TYPE_LABELS: Record<string, string> = {
  household: 'خانوار',
  member: 'عضو',
  dwelling: 'ملک',
  neighborhood: 'محله',
  project: 'پروژه',
  program: 'برنامه',
};

export function GlobalSearch() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canPii = hasPermission('members:read_pii');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GlobalSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = canPii
    ? 'جستجوی پرونده، ملک، محله، کد ملی…'
    : 'جستجوی پرونده، ملک، محله…';

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      setActiveIdx(-1);
      return;
    }
    const t = window.setTimeout(() => {
      setLoading(true);
      void globalSearch(toLatinDigits(q.trim()), 12).then((res) => {
        if (res.success && res.data) {
          setItems(res.data.items.filter((i) => i.href !== '#'));
          setActiveIdx(-1);
        }
        setLoading(false);
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const navigate = useCallback((item: GlobalSearchResultItem) => {
    if (item.masked || item.href === '#') return;
    setOpen(false);
    setQ('');
    router.push(item.href);
  }, [router]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      navigate(items[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="global-search" ref={wrapRef}>
      <input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        value={q}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        aria-label="جستجوی سراسری"
        aria-expanded={open}
        aria-controls="global-search-results"
        role="combobox"
      />
      {open && q.trim().length >= 2 && (
        <div className="global-search-panel" id="global-search-results" role="listbox">
          {loading ? <p className="muted">در حال جستجو…</p> : items.length === 0 ? (
            <p className="muted">نتیجه‌ای یافت نشد</p>
          ) : (
            <ul>
              {items.map((item, idx) => (
                <li key={`${item.type}-${item.id}`} role="option" aria-selected={idx === activeIdx}>
                  <button
                    type="button"
                    className={idx === activeIdx ? 'active' : ''}
                    onClick={() => navigate(item)}
                    disabled={item.masked}
                  >
                    <span className="gs-type">{TYPE_LABELS[item.type] ?? item.type}</span>
                    <strong>{item.title}</strong>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
