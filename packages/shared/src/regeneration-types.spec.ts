import {
  REGENERATION_PROGRAM_STATUS_LABELS,
  RegenerationProgramStatus,
  REPORT_SCHEDULE_FREQUENCY_LABELS,
  ReportScheduleFrequency,
  NEIGHBORHOOD_STATUS_LABELS,
  NeighborhoodStatus,
  MUNICIPAL_DISTRICTS,
  isMunicipalDistrict,
  isNeighborhoodStatus,
} from './regeneration-types';

describe('regeneration-types', () => {
  it('labels all program statuses', () => {
    for (const s of Object.values(RegenerationProgramStatus)) {
      expect(REGENERATION_PROGRAM_STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it('labels all schedule frequencies', () => {
    for (const f of Object.values(ReportScheduleFrequency)) {
      expect(REPORT_SCHEDULE_FREQUENCY_LABELS[f]).toBeTruthy();
    }
  });

  it('includes joint-action neighborhood status and districts 1–8', () => {
    expect(NEIGHBORHOOD_STATUS_LABELS[NeighborhoodStatus.NORMAL]).toBe('عادی');
    expect(NEIGHBORHOOD_STATUS_LABELS[NeighborhoodStatus.JOINT_ACTION]).toBe('اقدام مشترک');
    expect(isNeighborhoodStatus('normal')).toBe(true);
    expect(isNeighborhoodStatus('joint_action')).toBe(true);
    expect(MUNICIPAL_DISTRICTS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(isMunicipalDistrict(3)).toBe(true);
    expect(isMunicipalDistrict(9)).toBe(false);
  });
});
