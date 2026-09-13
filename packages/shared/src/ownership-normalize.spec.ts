import { OwnershipType, normalizeOwnershipType } from './case-types';

describe('normalizeOwnershipType', () => {
  it('maps aliases and Persian labels', () => {
    expect(normalizeOwnershipType('tenant')).toBe(OwnershipType.TENANT);
    expect(normalizeOwnershipType('مالک')).toBe(OwnershipType.OWNER);
    expect(normalizeOwnershipType('rent-free')).toBe(OwnershipType.OTHER);
    expect(normalizeOwnershipType('rent_free')).toBe(OwnershipType.RENT_FREE);
  });
});
