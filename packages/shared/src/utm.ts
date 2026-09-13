/** WGS84 ↔ UTM (northern/southern hemisphere). Iran typically uses zones 38–41N. */

export type UtmHemisphere = 'N' | 'S';

export interface UtmCoordinate {
  easting: number;
  northing: number;
  zone: number;
  hemisphere: UtmHemisphere;
}

export const IRAN_UTM_ZONES = [38, 39, 40, 41] as const;

const WGS84_A = 6378137;
const WGS84_E2 = 0.0066943799901413165;
const K0 = 0.9996;

export function utmZoneFromLongitude(lng: number): number {
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) {
    throw new Error('طول جغرافیایی خارج از محدوده است');
  }
  return Math.min(60, Math.max(1, Math.floor((lng + 180) / 6) + 1));
}

export function assertUtmZone(zone: number): number {
  if (!Number.isInteger(zone) || zone < 1 || zone > 60) {
    throw new Error('زون UTM باید بین ۱ تا ۶۰ باشد');
  }
  return zone;
}

export function wgs84ToUtm(lng: number, lat: number, zone?: number): UtmCoordinate {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('مختصات جغرافیایی نامعتبر است');
  }
  if (Math.abs(lng) > 180 || Math.abs(lat) > 84) {
    throw new Error('مختصات خارج از محدوده UTM است');
  }
  const z = assertUtmZone(zone ?? utmZoneFromLongitude(lng));
  const hemisphere: UtmHemisphere = lat >= 0 ? 'N' : 'S';
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const lon0 = (((z - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = (WGS84_E2 / (1 - WGS84_E2)) * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lngRad - lon0);
  const M =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * WGS84_E2 ** 2) / 64 - (5 * WGS84_E2 ** 3) / 256) * latRad -
      ((3 * WGS84_E2) / 8 + (3 * WGS84_E2 ** 2) / 32 + (45 * WGS84_E2 ** 3) / 1024) * Math.sin(2 * latRad) +
      ((15 * WGS84_E2 ** 2) / 256 + (45 * WGS84_E2 ** 3) / 1024) * Math.sin(4 * latRad) -
      ((35 * WGS84_E2 ** 3) / 3072) * Math.sin(6 * latRad));
  const ep2 = WGS84_E2 / (1 - WGS84_E2);
  const easting =
    K0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) +
    500000;
  let northing =
    K0 *
    (M +
      N *
        Math.tan(latRad) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));
  if (hemisphere === 'S') northing += 10_000_000;
  return { easting, northing, zone: z, hemisphere };
}

export function utmToWgs84(
  easting: number,
  northing: number,
  zone: number,
  hemisphere: UtmHemisphere = 'N',
): { lng: number; lat: number } {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    throw new Error('مختصات UTM نامعتبر است');
  }
  const z = assertUtmZone(zone);
  if (easting < 100_000 || easting > 900_000) {
    throw new Error('Easting خارج از محدوده UTM است');
  }
  if (northing < 0 || northing > 10_000_000) {
    throw new Error('Northing خارج از محدوده UTM است');
  }
  const x = easting - 500000;
  let y = northing;
  if (hemisphere === 'S') y -= 10_000_000;
  const lon0 = (((z - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const e2 = WGS84_E2;
  const ep2 = e2 / (1 - e2);
  const M = y / K0;
  const mu = M / (WGS84_A * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const fp =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(fp) ** 2;
  const T1 = Math.tan(fp) ** 2;
  const N1 = WGS84_A / Math.sqrt(1 - e2 * Math.sin(fp) ** 2);
  const R1 = (WGS84_A * (1 - e2)) / (1 - e2 * Math.sin(fp) ** 2) ** 1.5;
  const D = x / (N1 * K0);
  const lat =
    fp -
    ((N1 * Math.tan(fp)) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6) / 720);
  const lng =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5) / 120) /
      Math.cos(fp);
  return { lng: (lng * 180) / Math.PI, lat: (lat * 180) / Math.PI };
}

export type CoordSystem = 'wgs84' | 'utm';

export function parseCoordinateText(
  text: string,
  options?: {
    system?: CoordSystem;
    swapLatLng?: boolean;
    utmZone?: number;
    utmHemisphere?: UtmHemisphere;
  },
): { ok: true; points: Array<[number, number]> } | { ok: false; error: string } {
  const raw = text.trim();
  if (!raw) return { ok: false, error: 'متنی وارد نشده است' };
  const system = options?.system ?? 'wgs84';

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const pairs = normalizeJsonPairs(parsed);
      if (!pairs.length) return { ok: false, error: 'آرایه مختصات خالی است' };
      return convertPairs(pairs, system, options);
    } catch {
      return { ok: false, error: 'JSON مختصات نامعتبر است' };
    }
  }

  const lines = raw.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
  const pairs: Array<[number, number]> = [];
  for (const line of lines) {
    const parts = line.split(/[,،\s]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return { ok: false, error: `سطر نامعتبر: ${line}` };
    const n1 = Number(parts[0]);
    const n2 = Number(parts[1]);
    if (!Number.isFinite(n1) || !Number.isFinite(n2)) {
      return { ok: false, error: `عدد نامعتبر در: ${line}` };
    }
    pairs.push([n1, n2]);
  }
  return convertPairs(pairs, system, options);
}

function convertPairs(
  pairs: Array<[number, number]>,
  system: CoordSystem,
  options?: {
    swapLatLng?: boolean;
    utmZone?: number;
    utmHemisphere?: UtmHemisphere;
  },
): { ok: true; points: Array<[number, number]> } | { ok: false; error: string } {
  const points: Array<[number, number]> = [];
  if (system === 'utm') {
    let zone: number;
    try {
      zone = assertUtmZone(options?.utmZone ?? 39);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'زون UTM نامعتبر است' };
    }
    const hemisphere = options?.utmHemisphere ?? 'N';
    for (const [easting, northing] of pairs) {
      try {
        const { lng, lat } = utmToWgs84(easting, northing, zone, hemisphere);
        points.push([lng, lat]);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'تبدیل UTM ناموفق بود' };
      }
    }
    return { ok: true, points };
  }

  for (const [a, b] of pairs) {
    const lng = options?.swapLatLng ? b : a;
    const lat = options?.swapLatLng ? a : b;
    if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      return { ok: false, error: `مختصات خارج از محدوده: ${a}, ${b}` };
    }
    points.push([lng, lat]);
  }
  return { ok: true, points };
}

function normalizeJsonPairs(parsed: unknown): Array<[number, number]> {
  if (!Array.isArray(parsed)) return [];
  if (parsed.length >= 2 && typeof parsed[0] === 'number') {
    return [[Number(parsed[0]), Number(parsed[1])]];
  }
  const out: Array<[number, number]> = [];
  for (const item of parsed) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const a = Number(item[0]);
    const b = Number(item[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    out.push([a, b]);
  }
  return out;
}
