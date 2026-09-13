import {
  CHANGE_FIELD_LABELS,
  DwellingSource,
  PII_ACCESS_PURPOSE_LABELS,
  PiiAccessPurpose,
} from './quality-types';

describe('quality-types', () => {
  it('labels dwelling sources', () => {
    expect(Object.keys(DwellingSource).length).toBeGreaterThan(0);
    for (const s of Object.values(DwellingSource)) {
      expect(typeof s).toBe('string');
    }
  });

  it('labels PII access purposes', () => {
    for (const p of Object.values(PiiAccessPurpose)) {
      expect(PII_ACCESS_PURPOSE_LABELS[p]).toBeTruthy();
    }
  });

  it('has change field labels for common fields', () => {
    expect(CHANGE_FIELD_LABELS.status).toBeTruthy();
    expect(CHANGE_FIELD_LABELS.plaque).toBeTruthy();
  });
});
