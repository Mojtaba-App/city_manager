import {
  clampScrollTop,
  isRangeOutsideView,
  parseSidebarNavScroll,
} from './sidebar-nav-scroll';

describe('sidebar nav scroll helpers', () => {
  it('clamps saved offset into the scrollable range', () => {
    expect(clampScrollTop(80, 400, 200)).toBe(80);
    expect(clampScrollTop(999, 400, 200)).toBe(200);
    expect(clampScrollTop(-10, 400, 200)).toBe(0);
    expect(clampScrollTop(50, 100, 200)).toBe(0);
  });

  it('detects when the active item is outside the visible nav', () => {
    expect(isRangeOutsideView(0, 300, 20, 50)).toBe(false);
    expect(isRangeOutsideView(0, 300, 280, 320)).toBe(true);
    expect(isRangeOutsideView(100, 400, 40, 80)).toBe(true);
  });

  it('parses persisted scroll values', () => {
    expect(parseSidebarNavScroll('142')).toBe(142);
    expect(parseSidebarNavScroll('nope')).toBeNull();
    expect(parseSidebarNavScroll(null)).toBeNull();
  });
});
