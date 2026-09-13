import {
  SHARE_REPORT_SECTION_LABELS,
  SHARE_VIEW_KIND_LABELS,
  ShareViewKind,
  ShareViewStatus,
  buildShareViewPath,
  isShareViewExpired,
  normalizeShareReportSections,
  sanitizeShareHtml,
} from './share-view-types';

describe('share-view-types', () => {
  it('labels kinds and report sections', () => {
    expect(SHARE_VIEW_KIND_LABELS[ShareViewKind.REPORT]).toContain('گزارش');
    expect(SHARE_REPORT_SECTION_LABELS.kpis).toBeTruthy();
  });

  it('builds public share path and normalizes sections', () => {
    expect(buildShareViewPath('sv_abc')).toBe('/share/sv_abc');
    expect(normalizeShareReportSections(['kpis', 'bogus', 'kpis'])).toEqual(['kpis']);
    expect(normalizeShareReportSections([])).toEqual(['kpis', 'map_inset']);
  });

  it('detects expiry and sanitizes html scripts', () => {
    expect(isShareViewExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isShareViewExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
    expect(sanitizeShareHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
    expect(ShareViewStatus.ACTIVE).toBe('active');
  });
});
