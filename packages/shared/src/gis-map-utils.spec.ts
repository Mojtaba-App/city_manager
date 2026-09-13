import { countFeaturesByLayer, featureSearchHaystack, toggleExclusiveFilter } from './gis-map-utils';

describe('toggleExclusiveFilter', () => {
  it('unchecks one item when empty filter means all', () => {
    expect(toggleExclusiveFilter(['a', 'b', 'c'], [], 'b', false)).toEqual(['a', 'c']);
  });

  it('collapses a complete selection back to the all-on sentinel', () => {
    expect(toggleExclusiveFilter(['a', 'b', 'c'], ['a', 'c'], 'b', true)).toEqual([]);
  });

  it('does not collapse to empty when unchecking the last selected item', () => {
    const result = toggleExclusiveFilter(['a', 'b', 'c'], ['b'], 'b', false);
    expect(result).toEqual(['b']); // keeps current selection, cannot hide everything
  });

  it('allows unchecking to a single item (not all)', () => {
    expect(toggleExclusiveFilter(['a', 'b', 'c'], ['a', 'b'], 'b', false)).toEqual(['a']);
  });

  it('checking an already-included item is a no-op', () => {
    expect(toggleExclusiveFilter(['a', 'b', 'c'], ['a', 'b'], 'a', true)).toEqual(['a', 'b']);
  });

  it('handles empty allIds gracefully', () => {
    expect(toggleExclusiveFilter([], ['x'], 'x', false)).toEqual(['x']);
  });
});

describe('gis-map-utils', () => {

  it('builds a searchable haystack including urban layer name', () => {

    expect(featureSearchHaystack({ name: 'قطعه ۱', layerName: 'کاربری اراضی', code: 'LU-9' }))
      .toContain('کاربری اراضی');
  });

  it('counts visible features by operational layer', () => {
    expect(countFeaturesByLayer([
      { properties: { layer: 'urban' } },
      { properties: { layer: 'urban' } },
      { properties: { layer: 'fabrics' } },
      { properties: { layer: 'dwellings' } },
    ])).toEqual({ total: 4, urban: 2, fabrics: 1, neighborhoods: 0, dwellings: 1 });
  });
});
