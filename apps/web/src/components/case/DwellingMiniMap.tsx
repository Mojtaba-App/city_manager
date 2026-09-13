'use client';

import Link from 'next/link';
import { NavIcon } from '@/components/NavIcons';

function extractCenter(geometry: unknown): [number, number] | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    return [Number(g.coordinates[0]), Number(g.coordinates[1])];
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    const rings = g.coordinates as unknown[];
    const firstRing = rings[0];
    if (Array.isArray(firstRing) && Array.isArray(firstRing[0])) {
      const ring = firstRing as number[][];
      const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      return [lng, lat];
    }
  }
  return null;
}

export function DwellingMiniMap({
  dwellingId,
  geometry,
  address,
}: {
  dwellingId: string;
  geometry?: unknown;
  address?: string;
}) {
  const center = extractCenter(geometry);
  const mapUrl = center
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${center[0] - 0.004}%2C${center[1] - 0.003}%2C${center[0] + 0.004}%2C${center[1] + 0.003}&layer=mapnik&marker=${center[1]}%2C${center[0]}`
    : null;

  return (
    <div className="dwelling-mini-map">
      {mapUrl ? (
        <iframe
          title="نقشه ملک"
          src={mapUrl}
          loading="lazy"
          className="dwelling-mini-map-frame"
        />
      ) : (
        <div className="dwelling-mini-map-placeholder muted">
          موقعیت جغرافیایی ثبت نشده
        </div>
      )}
      <div className="dwelling-mini-map-footer">
        {address && <small>{address}</small>}
        <Link href={`/dashboard/map?dwelling=${dwellingId}`} className="btn btn-sm btn-primary">
          <NavIcon name="map" size={14} />
          باز کردن در نقشه
        </Link>
      </div>
    </div>
  );
}
