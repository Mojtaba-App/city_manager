'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { globalSearch } from '@/lib/regeneration-api';
import { GlobalSearchResultItem, toLatinDigits } from '@city-manager/shared';
import { NavGroup } from '@/lib/nav-config';
import { useAuth } from '@/lib/auth';
import { useUxPersona } from '@/lib/use-ux-persona';
import { loadRecentHouseholds } from '@/lib/recent-items';
import {
  buildCommandItems,
  filterCommandItems,
  groupCommandItems,
  CommandItem,
} from '@/lib/command-items';
import { useTheme } from '@/lib/theme';

interface CommandPaletteProps {
  navGroups: NavGroup[];
}

export function CommandPalette({ navGroups }: CommandPaletteProps) {
  const router = useRouter();
  const { hasPermission, hasAnyPermission } = useAuth();
  const { persona } = useUxPersona();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const recentHouseholds = useMemo(() => (open ? loadRecentHouseholds() : []), [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSearchResults([]);
    setActiveIdx(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const t = window.setTimeout(() => {
      void globalSearch(toLatinDigits(query.trim()), 8).then((res) => {
        if (res.success && res.data) {
          setSearchResults(res.data.items.filter((i) => i.href !== '#'));
        } else {
          setSearchResults([]);
        }
        setSearchLoading(false);
      });
    }, 240);
    return () => window.clearTimeout(t);
  }, [open, query]);

  const allItems = useMemo(() => buildCommandItems({
    navGroups,
    persona,
    hasPermission,
    hasAnyPermission,
    recentHouseholds,
    searchResults: query.trim().length >= 2 ? searchResults : undefined,
    theme,
    onToggleTheme: toggleTheme,
  }), [navGroups, persona, hasPermission, hasAnyPermission, recentHouseholds, searchResults, query, theme, toggleTheme]);

  const visibleItems = useMemo(
    () => filterCommandItems(allItems, query),
    [allItems, query],
  );

  const grouped = useMemo(() => groupCommandItems(visibleItems), [visibleItems]);
  const flatList = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, flatList.length]);

  const runItem = useCallback((item: CommandItem) => {
    if (item.disabled) return;
    setOpen(false);
    if (item.onSelect) {
      item.onSelect();
      return;
    }
    if (item.href) router.push(item.href);
  }, [router]);

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(flatList.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatList[activeIdx]) {
      e.preventDefault();
      runItem(flatList[activeIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) {
    return (
      <button
        type="button"
        className="cmd-palette-trigger"
        onClick={() => setOpen(true)}
        aria-label="Command Palette — Ctrl+K"
        title="Command Palette (Ctrl+K)"
      >
        <span className="cmd-palette-trigger-label">جستجو و دستورات</span>
        <kbd>Ctrl+K</kbd>
      </button>
    );
  }

  let flatIndex = -1;

  return (
    <div className="cmd-palette-root" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="cmd-palette-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cmd-palette-input-wrap">
          <input
            ref={inputRef}
            type="search"
            className="cmd-palette-input"
            placeholder="جستجو، رفتن به صفحه، میانبر…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            aria-autocomplete="list"
            aria-controls="cmd-palette-list"
          />
          {searchLoading && <span className="cmd-palette-loading muted">…</span>}
        </div>
        <div ref={listRef} id="cmd-palette-list" className="cmd-palette-list" role="listbox">
          {flatList.length === 0 ? (
            <p className="muted cmd-palette-empty">دستوری یافت نشد</p>
          ) : grouped.map((group) => (
            <div key={group.section} className="cmd-palette-group">
              <div className="cmd-palette-group-title">{group.section}</div>
              <ul>
                {group.items.map((item) => {
                  flatIndex += 1;
                  const idx = flatIndex;
                  return (
                    <li key={item.id} role="option" aria-selected={idx === activeIdx}>
                      <button
                        type="button"
                        data-cmd-idx={idx}
                        className={idx === activeIdx ? 'active' : ''}
                        disabled={item.disabled}
                        onClick={() => runItem(item)}
                        onMouseEnter={() => setActiveIdx(idx)}
                      >
                        <strong>{item.label}</strong>
                        {item.subtitle && <small>{item.subtitle}</small>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <footer className="cmd-palette-footer muted">
          <span>↑↓ حرکت</span>
          <span>Enter انتخاب</span>
          <span>Esc بستن</span>
        </footer>
      </div>
    </div>
  );
}
