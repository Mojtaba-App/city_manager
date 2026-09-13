import locations from '@/data/iran-locations.json';

export type IranProvinceRow = {
  province: string;
  cities: string[];
};

const rows = locations as IranProvinceRow[];

/** Province names sorted for Persian locale */
export const IRAN_PROVINCE_NAMES = rows
  .map((r) => r.province)
  .sort((a, b) => a.localeCompare(b, 'fa'));

export function getCitiesForProvince(province: string): string[] {
  const row = rows.find((r) => r.province === province);
  if (!row) return [];
  return [...row.cities].sort((a, b) => a.localeCompare(b, 'fa'));
}

/** Municipal districts (Tehran-style zones 1–8) */
export const IRAN_DISTRICTS = Array.from({ length: 8 }, (_, i) => `منطقه ${i + 1}`);
