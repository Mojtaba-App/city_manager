import {
  IRAN_UTM_ZONES,
  parseCoordinateText,
  utmToWgs84,
  utmZoneFromLongitude,
  wgs84ToUtm,
} from './utm';

describe('UTM', () => {
  it('picks Iran zones from longitude', () => {
    expect(utmZoneFromLongitude(45.1)).toBe(38);
    expect(utmZoneFromLongitude(48.669)).toBe(39);
    expect(utmZoneFromLongitude(51.389)).toBe(39);
    expect(utmZoneFromLongitude(54.4)).toBe(40);
    expect(utmZoneFromLongitude(60.1)).toBe(41);
    expect(IRAN_UTM_ZONES).toEqual([38, 39, 40, 41]);
  });

  it('round-trips Ahvaz WGS84 through UTM 39N', () => {
    const lng = 48.669;
    const lat = 31.32;
    const utm = wgs84ToUtm(lng, lat);
    expect(utm.zone).toBe(39);
    expect(utm.hemisphere).toBe('N');
    expect(utm.easting).toBeGreaterThan(200_000);
    expect(utm.easting).toBeLessThan(800_000);
    const back = utmToWgs84(utm.easting, utm.northing, utm.zone, utm.hemisphere);
    expect(Math.abs(back.lng - lng)).toBeLessThan(1e-7);
    expect(Math.abs(back.lat - lat)).toBeLessThan(1e-7);
  });

  it('round-trips a western-hemisphere point in zone 18N', () => {
    const lng = -74.0445;
    const lat = 40.6892;
    const utm = wgs84ToUtm(lng, lat, 18);
    expect(utm.zone).toBe(18);
    expect(utm.hemisphere).toBe('N');
    const back = utmToWgs84(utm.easting, utm.northing, 18, 'N');
    expect(Math.abs(back.lng - lng)).toBeLessThan(1e-7);
    expect(Math.abs(back.lat - lat)).toBeLessThan(1e-7);
  });

  it('parses swapped lat,lng WGS84', () => {
    const res = parseCoordinateText('31.320, 48.669', { swapLatLng: true });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.points[0]).toEqual([48.669, 31.32]);
  });

  it('parses WGS84 lng,lat lines', () => {
    const res = parseCoordinateText('48.669, 31.320\n48.675, 31.326');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.points[0]).toEqual([48.669, 31.32]);
      expect(res.points).toHaveLength(2);
    }
  });

  it('parses UTM easting,northing into WGS84', () => {
    const utm = wgs84ToUtm(48.669, 31.32);
    const res = parseCoordinateText(`${utm.easting}, ${utm.northing}`, {
      system: 'utm',
      utmZone: 39,
      utmHemisphere: 'N',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Math.abs(res.points[0][0] - 48.669)).toBeLessThan(1e-6);
      expect(Math.abs(res.points[0][1] - 31.32)).toBeLessThan(1e-6);
    }
  });

  it('rejects invalid UTM easting', () => {
    const res = parseCoordinateText('50, 3465000', { system: 'utm', utmZone: 39 });
    expect(res.ok).toBe(false);
  });
});
