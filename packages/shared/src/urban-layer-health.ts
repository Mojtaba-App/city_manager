/** Urban layer map readiness — bounds check uses Ahvaz envelope. */

export type UrbanLayerBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const AHVaz_BOUNDS = { west: 48.2, south: 31.0, east: 49.1, north: 31.6 };

export type UrbanLayerHealth = 'ok' | 'inactive' | 'empty' | 'no_publish' | 'off_map';

export function urbanLayerHealth(layer: {
  is_active: boolean;
  feature_count?: number;
  published_version?: number | null;
  bounds?: UrbanLayerBounds | null;
}): UrbanLayerHealth {
  if (!layer.is_active) return 'inactive';
  if (!layer.published_version) return 'no_publish';
  if (!layer.feature_count) return 'empty';
  const b = layer.bounds;
  if (b && Number.isFinite(b.west) && Number.isFinite(b.east)) {
    const inAhvaz =
      b.east >= AHVaz_BOUNDS.west
      && b.west <= AHVaz_BOUNDS.east
      && b.north >= AHVaz_BOUNDS.south
      && b.south <= AHVaz_BOUNDS.north;
    if (!inAhvaz) return 'off_map';
  }
  return 'ok';
}

export function urbanLayerHealthMessage(health: UrbanLayerHealth): string {
  switch (health) {
    case 'inactive':
      return 'لایه در سامانه غیرفعال است — دکمه «فعال» را بزنید.';
    case 'empty':
      return 'عارضه‌ای ثبت نشده — فایل KML/GeoJSON را دوباره import کنید.';
    case 'no_publish':
      return 'نسخه منتشرشده ندارد — import را تکمیل یا دوباره انجام دهید.';
    case 'off_map':
      return 'محدوده لایه خارج از اهواز است — احتمالاً مختصات فایل اشتباه است؛ re-import با WGS84.';
    default:
      return '';
  }
}

export function boundsFromUrbanLayer(layer: { bounds?: UrbanLayerBounds | null }): UrbanLayerBounds | null {
  const b = layer.bounds;
  if (!b) return null;
  const { west, south, east, north } = b;
  if (![west, south, east, north].every((n) => Number.isFinite(Number(n)))) return null;
  return { west: Number(west), south: Number(south), east: Number(east), north: Number(north) };
}
