import {
  addUniqueId,
  buildNeighborhoodMetadata,
  defaultFabricTypeForNeighborhoodKind,
  fabricTypesForNeighborhood,
  fabricsForNeighborhood,
  generateNeighborhoodCode,
  neighborhoodFabricTypeIds,
  neighborhoodProfileStats,
  NEW_LINKED_ID,
  nextRowSortDir,
  parseFabricTypeIds,
  removeId,
  resolveFabricIdForPlace,
  sortByRowNumber,
  suggestFabricName,
  syncLinkedPlaceSelection,
  withStableRowNumbers,
} from './layer-catalog';
import { NeighborhoodKind, resolveNormalFabricTypeId } from './regeneration-types';

describe('layer catalog helpers', () => {
  it('assigns stable row numbers then sorts desc by number', () => {
    const numbered = withStableRowNumbers([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(numbered.map((r) => r.rowNo)).toEqual([1, 2, 3]);
    const desc = sortByRowNumber(numbered, 'desc');
    expect(desc.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(desc.map((r) => r.rowNo)).toEqual([3, 2, 1]);
  });

  it('toggles sort direction', () => {
    expect(nextRowSortDir('asc')).toBe('desc');
    expect(nextRowSortDir('desc')).toBe('asc');
  });

  it('adds unique fabric type ids', () => {
    expect(addUniqueId(['t1'], 't1')).toEqual(['t1']);
    expect(addUniqueId(['t1'], 't2')).toEqual(['t1', 't2']);
    expect(removeId(['t1', 't2'], 't1')).toEqual(['t2']);
  });

  it('parses fabric type ids from json and metadata', () => {
    expect(parseFabricTypeIds('["a","b"]')).toEqual(['a', 'b']);
    expect(neighborhoodFabricTypeIds({ metadata: { fabricTypeIds: ['x'] } })).toEqual(['x']);
    expect(neighborhoodFabricTypeIds({ fabric_type_ids: ['y'] })).toEqual(['y']);
  });

  it('builds neighborhood population and area profile', () => {
    const stats = neighborhoodProfileStats({
      population: 2000,
      areaSqm: 40000,
      maxPopulation: 4000,
      maxAreaSqm: 80000,
    });
    expect(stats.areaHectares).toBe(4);
    expect(stats.densityPerHa).toBe(500);
    expect(stats.popShare).toBe(0.5);
    expect(stats.areaShare).toBe(0.5);
  });

  const types = [
    { id: 'normal', code: 'normal', name: 'بافت عادی' },
    { id: 'worn', code: 'worn', name: 'فرسوده' },
    { id: 'informal', code: 'informal', name: 'غیررسمی' },
  ];
  const fabrics = [
    { id: 'f1', neighborhood_id: 'n1', fabric_type_id: 'worn' },
    { id: 'f2', neighborhood_id: 'n1', fabric_type_id: 'informal' },
    { id: 'f3', neighborhood_id: 'n2', fabric_type_id: 'normal' },
  ];

  it('filters fabrics by neighborhood', () => {
    expect(fabricsForNeighborhood(fabrics, 'n1').map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(fabricsForNeighborhood(fabrics, '')).toEqual([]);
    expect(fabricsForNeighborhood(fabrics, NEW_LINKED_ID)).toEqual([]);
  });

  it('limits fabric types for urban neighborhoods to normal fabric', () => {
    const urban = { metadata: { neighborhoodKind: NeighborhoodKind.URBAN } };
    expect(fabricTypesForNeighborhood(urban, types, fabrics, 'n2').map((t) => t.id)).toEqual(['normal']);
  });

  it('resolves normal fabric type id', () => {
    expect(resolveNormalFabricTypeId(types)).toBe('normal');
    expect(defaultFabricTypeForNeighborhoodKind(NeighborhoodKind.URBAN, types)).toBe('normal');
  });

  it('syncs selection without fabric field', () => {
    const synced = syncLinkedPlaceSelection(
      { neighborhoodId: 'n1', fabricId: '', fabricTypeId: 'worn' },
      fabrics,
      { neighborhoodId: '', fabricId: '', fabricTypeId: '' },
      types,
    );
    expect(synced.fabricTypeId).toBe('worn');
    expect(synced.fabricId).toBe('');
  });

  it('defaults urban new neighborhood to normal fabric type', () => {
    const synced = syncLinkedPlaceSelection(
      {
        neighborhoodId: NEW_LINKED_ID,
        fabricId: '',
        fabricTypeId: '',
        neighborhoodKind: NeighborhoodKind.URBAN,
      },
      fabrics,
      undefined,
      types,
    );
    expect(synced.fabricTypeId).toBe('normal');
  });

  it('builds neighborhood metadata with kind and parent', () => {
    const meta = buildNeighborhoodMetadata({
      neighborhoodKind: NeighborhoodKind.REGENERATION_TARGET,
      parentUrbanNeighborhoodId: 'urban-1',
      fabricTypeIds: ['worn'],
    });
    expect(meta.neighborhoodKind).toBe(NeighborhoodKind.REGENERATION_TARGET);
    expect(meta.parentUrbanNeighborhoodId).toBe('urban-1');
    expect(meta.fabricTypeIds).toEqual(['worn']);
  });

  it('resolves fabric id from neighborhood and type', () => {
    expect(resolveFabricIdForPlace(fabrics, 'n1', 'worn')).toBe('f1');
    expect(resolveFabricIdForPlace(fabrics, 'n1', 'missing')).toBe('');
  });

  it('suggests a combined fabric name', () => {
    expect(suggestFabricName('منبع آب', 'فرسوده')).toBe('منبع آب — فرسوده');
    expect(suggestFabricName('منبع آب', '')).toBe('منبع آب');
  });

  it('generates attractive combined neighborhood codes', () => {
    const urban = generateNeighborhoodCode({ kind: NeighborhoodKind.URBAN, municipalDistrict: 3 });
    expect(urban).toMatch(/^SH-D3-[23456789A-HJ-NP-Z]{4}$/);
    const target = generateNeighborhoodCode({ kind: NeighborhoodKind.REGENERATION_TARGET });
    expect(target).toMatch(/^HD-[23456789A-HJ-NP-Z]{4}$/);
    const again = generateNeighborhoodCode({ existingCodes: [urban] });
    expect(again).not.toBe(urban);
  });
});
