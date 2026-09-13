import {
  CASE_ENTITY_TYPE_LABELS,
  CaseEntityType,
  LAND_USE_LABELS,
  LandUseType,
  getFormNextSteps,
  isCaseEntityType,
  isLandUseType,
  nextUniqueFieldKey,
} from './case-types';

describe('land use types', () => {
  it('labels every land-use option in Persian', () => {
    for (const value of Object.values(LandUseType)) {
      expect(LAND_USE_LABELS[value]).toBeTruthy();
    }
    expect(LAND_USE_LABELS[LandUseType.RESIDENTIAL]).toBe('مسکونی');
    expect(isLandUseType('mixed')).toBe(true);
    expect(isLandUseType('unknown')).toBe(false);
  });
});

describe('form entity helpers', () => {
  it('labels case entity types and next steps', () => {
    expect(isCaseEntityType('household')).toBe(true);
    expect(isCaseEntityType('nope')).toBe(false);
    expect(CASE_ENTITY_TYPE_LABELS[CaseEntityType.HOUSEHOLD]).toBe('خانوار');
    const steps = getFormNextSteps(CaseEntityType.HOUSEHOLD);
    expect(steps[0].href).toBe('/dashboard/households/new');
    expect(nextUniqueFieldKey([{ key: 'field_1' }, { key: 'field_2' }])).toBe('field_3');
  });
});
