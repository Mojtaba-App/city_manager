import {
  URBAN_LAYER_CATEGORY_GROUPS,
  URBAN_LAYER_CATEGORY_LABELS,
  UrbanLayerCategory,
  isUrbanLayerCategory,
  urbanLayerCategoryLabel,
} from './urban-layer-category';

describe('urban layer categories', () => {
  it('covers every enum value in labels and groups without duplicates', () => {
    const fromGroups = URBAN_LAYER_CATEGORY_GROUPS.flatMap((g) => g.categories);
    const unique = new Set(fromGroups);
    expect(unique.size).toBe(fromGroups.length);
    expect(fromGroups.sort()).toEqual(Object.values(UrbanLayerCategory).sort());
    for (const c of Object.values(UrbanLayerCategory)) {
      expect(URBAN_LAYER_CATEGORY_LABELS[c]).toBeTruthy();
    }
  });

  it('includes regeneration and master plan categories', () => {
    expect(urbanLayerCategoryLabel(UrbanLayerCategory.PLAN_REGENERATION)).toContain('بازآفرینی');
    expect(urbanLayerCategoryLabel(UrbanLayerCategory.PLAN_MASTER)).toContain('جامع');
    expect(isUrbanLayerCategory('plan_tod')).toBe(true);
    expect(isUrbanLayerCategory('unknown')).toBe(false);
  });

  it('keeps legacy base categories', () => {
    expect(isUrbanLayerCategory(UrbanLayerCategory.CITY_BOUNDARY)).toBe(true);
    expect(isUrbanLayerCategory(UrbanLayerCategory.CUSTOM)).toBe(true);
  });
});
