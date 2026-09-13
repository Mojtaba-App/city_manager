/** Toggleable basemap raster layers for MapLibre */

export type BasemapId = 'osm' | 'googleSatellite' | 'googleHybrid' | 'googleTerrain';

export interface BasemapDef {
  id: BasemapId;
  label: string;
  description: string;
  tiles: string[];
  tileSize?: number;
  attribution: string;
  maxzoom?: number;
  defaultOn?: boolean;
}

/**
 * Google tile endpoints (lyrs):
 * m = roadmap, s = satellite, y = hybrid, p = terrain, t = terrain only
 * Note: for production Google Maps Platform / licensed tiles are preferred.
 */
export const BASEMAPS: BasemapDef[] = [
  {
    id: 'osm',
    label: 'خیابان (OSM)',
    description: 'نقشه خیابان‌های OpenStreetMap',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© OpenStreetMap',
    maxzoom: 19,
    defaultOn: true,
  },
  {
    id: 'googleSatellite',
    label: 'ماهواره گوگل',
    description: 'تصویر ماهواره‌ای طبیعی',
    tiles: [
      'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    ],
    tileSize: 256,
    attribution: '© Google',
    maxzoom: 20,
    defaultOn: false,
  },
  {
    id: 'googleTerrain',
    label: 'طبیعی / زمین گوگل',
    description: 'نقشه طبیعی و پستی‌بلندی',
    tiles: [
      'https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    ],
    tileSize: 256,
    attribution: '© Google',
    maxzoom: 20,
    defaultOn: false,
  },
  {
    id: 'googleHybrid',
    label: 'ترکیبی گوگل',
    description: 'ماهواره + برچسب معابر',
    tiles: [
      'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    ],
    tileSize: 256,
    attribution: '© Google',
    maxzoom: 20,
    defaultOn: false,
  },
];

export type BasemapVisibility = Record<BasemapId, boolean>;

export function defaultBasemapVisibility(): BasemapVisibility {
  return BASEMAPS.reduce((acc, b) => {
    acc[b.id] = Boolean(b.defaultOn);
    return acc;
  }, {} as BasemapVisibility);
}

export function sourceId(id: BasemapId) {
  return `basemap-${id}`;
}

export function layerId(id: BasemapId) {
  return `basemap-layer-${id}`;
}
