import {
  applyLayerStyleToFeatures,
  asFeatureCollection,
  buildUrbanPolygonLineWidthExpression,
  clampOpacity,
  clampStrokeWidth,
  GIS_HOVER_LAYER_IDS,
  isNoFill,
  layerColorPatch,
  mapHoverCursor,
  normalizeHexColor,
  opacityToTransparency,
  restoreFillOpacity,
  transparencyToOpacity,
  defaultLayerLabelVisibility,
  featureMapLabel,
  isFeatureLabelOn,
  withMapLabels,
} from './layer-style';

describe('layer-style', () => {
  it('clamps opacity to 0–1', () => {
    expect(clampOpacity(-1)).toBe(0);
    expect(clampOpacity(2)).toBe(1);
    expect(clampOpacity(0.333)).toBe(0.33);
    expect(clampOpacity(Number.NaN)).toBe(0.35);
  });

  it('converts fill opacity and transparency as complements', () => {
    expect(opacityToTransparency(0.25)).toBe(0.75);
    expect(transparencyToOpacity(0.4)).toBe(0.6);
  });

  it('treats zero fill opacity as outline-only', () => {
    expect(isNoFill(0)).toBe(true);
    expect(isNoFill(0.25)).toBe(false);
    expect(restoreFillOpacity(0)).toBe(0.35);
    expect(restoreFillOpacity(0.2)).toBe(0.2);
  });

  it('clamps stroke width between 0.5 and 8 pixels', () => {
    expect(clampStrokeWidth(0)).toBe(0.5);
    expect(clampStrokeWidth(2.55)).toBe(2.6);
    expect(clampStrokeWidth(12)).toBe(8);
  });

  it('builds urban polygon line-width expression with per-layer stroke widths', () => {
    const expr = buildUrbanPolygonLineWidthExpression([
      { id: 'layer-a', strokeWidth: 3.5 },
      { id: 'layer-b', strokeWidth: 6 },
    ]);
    expect(expr[0]).toBe('case');
    expect(JSON.stringify(expr)).toContain('layer-a');
    expect(JSON.stringify(expr)).toContain('3.5');
    expect(JSON.stringify(expr)).toContain('6');
  });

  it('normalizes hex colors', () => {
    expect(normalizeHexColor('#AABBCC')).toBe('#aabbcc');
    expect(normalizeHexColor('1a5276')).toBe('#1a5276');
    expect(normalizeHexColor('bad')).toBe('#2e86ab');
  });

  it('uses pointer over features and grab on empty map', () => {
    expect(mapHoverCursor({ drawingToolActive: false, overFeature: true })).toBe('pointer');
    expect(mapHoverCursor({ drawingToolActive: false, overFeature: false })).toBe('grab');
    expect(mapHoverCursor({ drawingToolActive: true, overFeature: true })).toBe('crosshair');
  });

  it('lists hoverable GIS layers', () => {
    expect(GIS_HOVER_LAYER_IDS).toContain('gis-polygons-fill');
    expect(GIS_HOVER_LAYER_IDS).toContain('gis-points-circle');
  });

  it('parses nested ApiResponse into a FeatureCollection', () => {
    const parsed = asFeatureCollection({
      success: true,
      data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: '1' } }] },
    });
    expect(parsed.features).toHaveLength(1);
  });

  it('returns empty collection when payload is missing', () => {
    expect(asFeatureCollection(undefined).features).toEqual([]);
    expect(asFeatureCollection({ success: false }).features).toEqual([]);
  });

  it('applies zero fill opacity for outline-only layers', () => {
    const next = applyLayerStyleToFeatures(
      [{ properties: { layerId: 'u1', fillOpacity: 0.2 } }],
      { layerId: 'u1' },
      { fillOpacity: 0 },
    );
    expect(next[0].properties?.fillOpacity).toBe(0);
  });

  it('builds a matching fill and stroke color patch', () => {
    expect(layerColorPatch('#AABBCC')).toEqual({ colorHex: '#aabbcc', strokeHex: '#aabbcc' });
  });

  it('applies stroke hex so outline-only layers can recolor the border', () => {
    const next = applyLayerStyleToFeatures(
      [{ properties: { layerId: 'u1', colorHex: '#111111', strokeHex: '#111111' } }],
      { layerId: 'u1' },
      { colorHex: '#00ff00' },
    );
    expect(next[0].properties?.colorHex).toBe('#00ff00');
    expect(next[0].properties?.strokeHex).toBe('#00ff00');
  });

  it('applies color and fill opacity to matching urban layer features', () => {
    const next = applyLayerStyleToFeatures(
      [{ properties: { layerId: 'u1', colorHex: '#111111', fillOpacity: 0.2 } }],
      { layerId: 'u1' },
      { colorHex: '#ff0000', fillOpacity: 0.5 },
    );
    expect(next[0].properties?.colorHex).toBe('#ff0000');
    expect(next[0].properties?.fillOpacity).toBe(0.5);
  });

  it('matches popup titles: feature name, GIS attributes, then code', () => {
    expect(featureMapLabel({
      layer: 'neighborhoods',
      layerName: 'محلات هدف',
      name: 'خشايار (کوي انقلاب)',
    })).toBe('خشايار (کوي انقلاب)');
    expect(featureMapLabel({
      layer: 'urban',
      layerName: 'مناطق شهری',
      name: 'منطقه 3',
    })).toBe('منطقه ۳');
    expect(featureMapLabel({
      layer: 'urban',
      layerName: 'بلوک',
      name: '',
      code: 'غرب007',
    })).toBe('غرب۰۰۷');
    expect(featureMapLabel({
      layer: 'urban',
      layerName: 'مناطق',
      attributes: { Name: 'منطقه 3' },
    })).toBe('منطقه ۳');
    expect(featureMapLabel({
      layer: 'urban',
      layerName: 'محلات',
      name: 'خشايار (کوي انقلاب)',
      attributes: { Name: 'چیز دیگر' },
    })).toBe('خشايار (کوي انقلاب)');
    expect(featureMapLabel({ layer: 'dwellings', title: 'پلاک ۱۲' })).toBe('پلاک ۱۲');
    expect(featureMapLabel({ layer: 'urban', layerName: 'فقط نام لایه' })).toBe('');
    expect(featureMapLabel({ name: 'ملاشیه 11' })).toBe('ملاشیه ۱۱');
  });

  it('turns labels on only for the selected layer', () => {
    const labels = defaultLayerLabelVisibility();
    labels.urban.u1 = true;
    labels.neighborhoods = true;
    expect(isFeatureLabelOn({ layer: 'urban', layerId: 'u1' }, labels)).toBe(true);
    expect(isFeatureLabelOn({ layer: 'urban', layerId: 'u2' }, labels)).toBe(false);
    expect(isFeatureLabelOn({ layer: 'neighborhoods' }, labels)).toBe(true);
    expect(isFeatureLabelOn({ layer: 'fabrics', fabricTypeId: 't1' }, labels)).toBe(false);
  });

  it('annotates features with mapLabel and showLabel flags', () => {
    const labels = defaultLayerLabelVisibility();
    labels.urban.u1 = true;
    const next = withMapLabels(
      [{ properties: { layer: 'urban', layerId: 'u1', layerName: 'رودخانه', name: 'شاخه شرقی' } as Record<string, unknown> }],
      labels,
    );
    expect(next[0].properties?.mapLabel).toBe('شاخه شرقی');
    expect(next[0].properties?.showLabel).toBe(1);
  });
});
