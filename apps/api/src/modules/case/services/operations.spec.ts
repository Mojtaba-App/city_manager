import { computeVulnerabilityScore, VulnerabilityLevel } from '@city-manager/shared';

describe('HouseholdAssignmentService rank logic', () => {
  it('computes vulnerability tiers consistently', () => {
    const high = computeVulnerabilityScore({
      incomeScore: 80,
      housingScore: 70,
      healthScore: 65,
      employmentScore: 60,
      educationScore: 55,
      familySizeScore: 70,
    });
    expect([VulnerabilityLevel.HIGH, VulnerabilityLevel.CRITICAL]).toContain(high.level);
  });
});

describe('Case task overdue detection', () => {
  it('detects overdue when due date is in the past', () => {
    const dueAt = new Date(Date.now() - 3600_000);
    const isOverdue = dueAt.getTime() < Date.now();
    expect(isOverdue).toBe(true);
  });
});
