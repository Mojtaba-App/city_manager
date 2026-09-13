import {
  PAPER_SIZE_MM,
  buildMapLegendItems,
  computePrintLayoutBoxes,
  formatMapExtent,
  formatScaleBarLabel,
  formatScaleRatio,
  mapFrameMetersPerPixel,
  metersPerPixel,
  niceScaleMeters,
  paperSizePx,
  DEFAULT_MAP_PRINT_LAYOUT,
} from './map-print-layout';

describe('map-print-layout', () => {
  it('converts A4 landscape at 150 dpi to expected pixel size', () => {
    const s = paperSizePx('a4', 'landscape', 150);
    expect(s.widthMm).toBe(297);
    expect(s.heightMm).toBe(210);
    expect(s.width).toBe(Math.round((297 / 25.4) * 150));
    expect(s.height).toBe(Math.round((210 / 25.4) * 150));
  });

  it('swaps A4 sides for portrait', () => {
    const s = paperSizePx('a4', 'portrait', 150);
    expect(s.widthMm).toBe(210);
    expect(s.heightMm).toBe(297);
  });

  it('keeps paper millimetre constants for A3', () => {
    expect(PAPER_SIZE_MM.a3).toEqual({ w: 420, h: 297 });
  });

  it('reserves a legend column and footer in the layout boxes', () => {
    const page = paperSizePx('a4', 'landscape', 150);
    const boxes = computePrintLayoutBoxes({ showLegend: true, showLogo: true, dpi: 150 }, page.width, page.height);
    expect(boxes.legend).not.toBeNull();
    expect(boxes.logo).not.toBeNull();
    expect(boxes.map.w + (boxes.legend?.w ?? 0)).toBeLessThan(page.width);
    expect(boxes.map.y + boxes.map.h).toBeLessThanOrEqual(boxes.footer.y);
  });

  it('omits legend and logo boxes when disabled', () => {
    const boxes = computePrintLayoutBoxes({ showLegend: false, showLogo: false, dpi: 150 }, 800, 600);
    expect(boxes.legend).toBeNull();
    expect(boxes.logo).toBeNull();
    expect(boxes.map.w).toBeGreaterThan(500);
  });

  it('picks cartographic nice scale values', () => {
    expect(niceScaleMeters(120)).toBe(100);
    expect(niceScaleMeters(450)).toBe(500);
    expect(niceScaleMeters(1800)).toBe(2000);
  });

  it('computes web-mercator meters per pixel', () => {
    const equatorZ0 = metersPerPixel(0, 0);
    expect(equatorZ0).toBeCloseTo(156543.03392, 3);
    expect(metersPerPixel(0, 1)).toBeCloseTo(equatorZ0 / 2, 3);
  });

  it('scales meters-per-pixel when the map is fitted into a smaller frame', () => {
    const mpp = mapFrameMetersPerPixel({
      latitude: 0,
      zoom: 0,
      sourceWidthPx: 1000,
      drawnWidthPx: 500,
    });
    expect(mpp).toBeCloseTo(metersPerPixel(0, 0) * 2, 3);
  });

  it('formats representative fraction and extent', () => {
    expect(formatScaleRatio(1000, 1)).toBe('1:1,000');
    expect(formatMapExtent({ west: 48.1, south: 31.2, east: 48.3, north: 31.4 })).toContain('W 48.1000°');
    expect(formatScaleBarLabel(500)).toContain('متر');
    expect(formatScaleBarLabel(2000)).toContain('کیلومتر');
  });

  it('builds legend rows only for visible layers', () => {
    const items = buildMapLegendItems({
      neighborhoodsOn: true,
      fabricsOn: true,
      dwellingsOn: false,
      urbanOn: true,
      fabricTypes: [{ id: 't1', name: 'فرسوده', colorHex: '#aa0000' }],
      selectedFabricTypeIds: [],
      urbanLayers: [
        { id: 'u1', name: 'مرز شهر', colorHex: '#0033aa', visible: true },
        { id: 'u2', name: 'مخفی', colorHex: '#000', visible: false },
      ],
    });
    expect(items.some((i) => i.id === 'neighborhoods')).toBe(true);
    expect(items.some((i) => i.label === 'فرسوده')).toBe(true);
    expect(items.some((i) => i.label === 'مرز شهر')).toBe(true);
    expect(items.some((i) => i.label === 'مخفی')).toBe(false);
    expect(items.some((i) => i.id === 'dwellings')).toBe(false);
  });

  it('has north arrow and scale enabled in the default layout', () => {
    expect(DEFAULT_MAP_PRINT_LAYOUT.showNorthArrow).toBe(true);
    expect(DEFAULT_MAP_PRINT_LAYOUT.showScale).toBe(true);
    expect(DEFAULT_MAP_PRINT_LAYOUT.showLegend).toBe(true);
    expect(DEFAULT_MAP_PRINT_LAYOUT.showBorder).toBe(true);
  });
});
