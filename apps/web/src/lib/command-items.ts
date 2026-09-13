'use client';

import {
  COMMAND_PALETTE_ACTION_SECTION,
  canViewDashboardPath,
  getCommandPaletteActions,
  getQuickActionsForPersona,
  GlobalSearchResultItem,
  normalizeDigitsForSearch,
  UxPersona,
} from '@city-manager/shared';
import { NavGroup, flattenNavItems } from '@/lib/nav-config';
import { RecentHouseholdItem } from '@/lib/recent-items';

export interface CommandItem {
  id: string;
  label: string;
  section: string;
  href?: string;
  subtitle?: string;
  keywords?: string[];
  disabled?: boolean;
  onSelect?: () => void;
}

function canSeeNav(
  href: string,
  hasPermission: (p: string | string[]) => boolean,
  hasAny: (ps: string[]) => boolean,
): boolean {
  return canViewDashboardPath(href, { hasPermission, hasAnyPermission: hasAny });
}

export function buildCommandItems(opts: {
  navGroups: NavGroup[];
  persona: UxPersona;
  hasPermission: (p: string | string[]) => boolean;
  hasAnyPermission: (ps: string[]) => boolean;
  recentHouseholds: RecentHouseholdItem[];
  searchResults?: GlobalSearchResultItem[];
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}): CommandItem[] {
  const items: CommandItem[] = [];
  const ctx = { hasPermission: opts.hasPermission, hasAnyPermission: opts.hasAnyPermission };
  const navItems = flattenNavItems(opts.navGroups).filter((i) =>
    canSeeNav(i.href, opts.hasPermission, opts.hasAnyPermission),
  );

  for (const nav of navItems) {
    items.push({
      id: `nav-${nav.href}`,
      label: nav.label,
      section: 'رفتن به',
      href: nav.href,
      keywords: [nav.label, nav.href],
    });
  }

  for (const action of getQuickActionsForPersona(opts.persona)) {
    if (!canViewDashboardPath(action.href, ctx)) continue;
    items.push({
      id: `action-${action.id}`,
      label: action.label,
      section: 'میانبر',
      href: action.href,
      keywords: [action.label, action.id],
    });
  }

  if (opts.theme && opts.onToggleTheme) {
    for (const action of getCommandPaletteActions(opts.theme)) {
      items.push({
        id: `palette-${action.id}`,
        label: action.label,
        subtitle: action.subtitle,
        section: COMMAND_PALETTE_ACTION_SECTION,
        keywords: action.keywords,
        onSelect: opts.onToggleTheme,
      });
    }
  }

  if (canViewDashboardPath('/dashboard/households', ctx)) {
    for (const recent of opts.recentHouseholds) {
      items.push({
        id: `recent-${recent.id}`,
        label: recent.label ?? `پرونده ${recent.caseNumber}`,
        subtitle: recent.caseNumber,
        section: 'اخیر',
        href: `/dashboard/households/${recent.id}`,
        keywords: [recent.caseNumber, recent.label ?? ''],
      });
    }
  }

  if (opts.searchResults?.length) {
    for (const hit of opts.searchResults) {
      if (hit.href && hit.href !== '#' && !canViewDashboardPath(hit.href, ctx)) continue;
      items.push({
        id: `search-${hit.type}-${hit.id}`,
        label: hit.title,
        subtitle: hit.subtitle,
        section: 'جستجو',
        href: hit.href,
        disabled: hit.masked || hit.href === '#',
        keywords: [hit.title, hit.subtitle ?? '', hit.type],
      });
    }
  }

  return items;
}

export function filterCommandItems(items: CommandItem[], query: string): CommandItem[] {
  const q = normalizeDigitsForSearch(query.trim());
  if (!q) return items;
  return items.filter((item) => {
    const hay = normalizeDigitsForSearch(
      [item.label, item.subtitle ?? '', item.section, ...(item.keywords ?? [])].join(' '),
    );
    return hay.includes(q);
  });
}

export function groupCommandItems(items: CommandItem[]): Array<{ section: string; items: CommandItem[] }> {
  const order = ['جستجو', 'عملیات', 'رفتن به', 'میانبر', 'اخیر'];
  const map = new Map<string, CommandItem[]>();
  for (const item of items) {
    const list = map.get(item.section) ?? [];
    list.push(item);
    map.set(item.section, list);
  }
  const sections = [...map.keys()].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sections.map((section) => ({ section, items: map.get(section) ?? [] }));
}
