import {
  computeVulnerabilityScore,
  VulnerabilityLevel,
  vulnerabilityLevelRank,
} from './operations-types';

describe('computeVulnerabilityScore', () => {
  it('returns low level for low dimension scores', () => {
    const result = computeVulnerabilityScore({
      incomeScore: 10,
      housingScore: 15,
      healthScore: 10,
      employmentScore: 10,
      educationScore: 10,
      familySizeScore: 10,
    });
    expect(result.level).toBe(VulnerabilityLevel.LOW);
    expect(result.totalScore).toBeLessThan(35);
  });

  it('returns critical level for high dimension scores', () => {
    const result = computeVulnerabilityScore({
      incomeScore: 95,
      housingScore: 90,
      healthScore: 85,
      employmentScore: 80,
      educationScore: 75,
      familySizeScore: 90,
    });
    expect(result.level).toBe(VulnerabilityLevel.CRITICAL);
    expect(result.totalScore).toBeGreaterThanOrEqual(75);
  });

  it('clamps out-of-range values', () => {
    const result = computeVulnerabilityScore({
      incomeScore: 200,
      housingScore: -5,
      healthScore: 50,
      employmentScore: 50,
      educationScore: 50,
      familySizeScore: 50,
    });
    expect(result.breakdown.income).toBe(100);
    expect(result.breakdown.housing).toBe(0);
  });
});

describe('vulnerabilityLevelRank', () => {
  it('orders levels correctly', () => {
    expect(vulnerabilityLevelRank(VulnerabilityLevel.CRITICAL)).toBeGreaterThan(
      vulnerabilityLevelRank(VulnerabilityLevel.HIGH),
    );
  });
});
