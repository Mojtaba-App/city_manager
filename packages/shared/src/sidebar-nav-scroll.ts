/** Keep a scroll offset inside a scrollable container. */
export function clampScrollTop(
  saved: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  if (!Number.isFinite(saved) || saved <= 0) return 0;
  const max = Math.max(0, scrollHeight - clientHeight);
  return Math.min(saved, max);
}

/** True when the item box is not fully inside the container box (viewport). */
export function isRangeOutsideView(
  containerTop: number,
  containerBottom: number,
  itemTop: number,
  itemBottom: number,
): boolean {
  return itemTop < containerTop || itemBottom > containerBottom;
}

export const SIDEBAR_NAV_SCROLL_KEY = 'city-manager.sidebar-nav-scroll';

export function parseSidebarNavScroll(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
