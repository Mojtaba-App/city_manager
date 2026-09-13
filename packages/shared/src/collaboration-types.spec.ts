import {
  CONSENT_PURPOSE_LABELS,
  CONSENT_STATUS_LABELS,
  ConsentPurpose,
  ConsentStatus,
  NOTIFICATION_TYPE_LABELS,
  NotificationType,
  REFERRAL_STATUS_LABELS,
  ReferralStatus,
  REFERRAL_DATA_SCOPE_LABELS,
  REFERRAL_DESTINATION_KIND_LABELS,
  ReferralDestinationKind,
  consentCoversScopes,
  formatReferralDestinationLabel,
  listMunicipalReferralDestinations,
  missingConsentScopes,
  municipalReferralDestinationCode,
  normalizeReferralScopes,
} from './collaboration-types';

describe('collaboration-types', () => {
  it('labels all notification types', () => {
    for (const t of Object.values(NotificationType)) {
      expect(NOTIFICATION_TYPE_LABELS[t]).toBeTruthy();
    }
  });

  it('labels consent purposes and statuses', () => {
    for (const p of Object.values(ConsentPurpose)) {
      expect(CONSENT_PURPOSE_LABELS[p]).toBeTruthy();
    }
    for (const s of Object.values(ConsentStatus)) {
      expect(CONSENT_STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it('labels referral statuses and scopes', () => {
    for (const s of Object.values(ReferralStatus)) {
      expect(REFERRAL_STATUS_LABELS[s]).toBeTruthy();
    }
    expect(Object.keys(REFERRAL_DATA_SCOPE_LABELS).length).toBeGreaterThanOrEqual(4);
  });

  it('lists municipal district destinations 1–8 for partner routing', () => {
    const destinations = listMunicipalReferralDestinations();
    expect(destinations).toHaveLength(8);
    expect(destinations[2]).toMatchObject({
      kind: ReferralDestinationKind.MUNICIPAL_DISTRICT,
      municipalDistrict: 3,
      code: municipalReferralDestinationCode(3),
    });
    expect(REFERRAL_DESTINATION_KIND_LABELS[ReferralDestinationKind.PARTNER_AGENCY]).toContain('ارگان');
  });

  it('checks consent scope coverage and normalizes scopes', () => {
    expect(consentCoversScopes(['case_summary', 'member_count'], ['case_summary'])).toBe(true);
    expect(missingConsentScopes(['case_summary'], ['case_summary', 'contact_phone'])).toEqual(['contact_phone']);
    expect(normalizeReferralScopes(['case_summary', 'bogus', 'case_summary'])).toEqual(['case_summary']);
    expect(normalizeReferralScopes([])).toEqual(['case_summary', 'member_count']);
    expect(formatReferralDestinationLabel({
      destinationKind: ReferralDestinationKind.MUNICIPAL_DISTRICT,
      municipalDistrict: 5,
    })).toBe('منطقه 5 شهرداری');
  });
});
