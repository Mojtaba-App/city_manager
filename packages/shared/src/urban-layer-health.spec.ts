import { boundsFromUrbanLayer, urbanLayerHealth, urbanLayerHealthMessage } from './urban-layer-health';

describe('urban-layer-health', () => {
  it('flags empty published layer', () => {
    expect(urbanLayerHealth({ is_active: true, feature_count: 0, published_version: 1 })).toBe('empty');
    expect(urbanLayerHealthMessage('empty')).toMatch(/import/);
  });

  it('flags inactive layer', () => {
    expect(urbanLayerHealth({ is_active: false, feature_count: 10, published_version: 1 })).toBe('inactive');
  });

  it('accepts layer inside Ahvaz bounds', () => {
    expect(
      urbanLayerHealth({
        is_active: true,
        feature_count: 5,
        published_version: 1,
        bounds: { west: 48.5, south: 31.2, east: 48.9, north: 31.4 },
      }),
    ).toBe('ok');
  });

  it('flags layer outside Ahvaz', () => {
    expect(
      urbanLayerHealth({
        is_active: true,
        feature_count: 5,
        published_version: 1,
        bounds: { west: 51, south: 35, east: 52, north: 36 },
      }),
    ).toBe('off_map');
  });

  it('parses bounds from layer row', () => {
    expect(boundsFromUrbanLayer({ bounds: { west: 48.1, south: 31.1, east: 48.2, north: 31.2 } })).toEqual({
      west: 48.1,
      south: 31.1,
      east: 48.2,
      north: 31.2,
    });
  });
});
