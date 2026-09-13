import type { LayerVisibility } from '@/lib/gis-api';
import {
  BASEMAPS,
  BasemapId,
  BasemapVisibility,
  defaultBasemapVisibility,
} from './basemaps';

const STORAGE_KEY = 'city-manager.gis-layer-visibility';

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  neighborhoods: true,
  fabrics: true,
  dwellings: true,
  urban: true,
};

export type GisLayerPrefs = {
  visibility: LayerVisibility;
  urbanLayerVisibility: Record<string, boolean>;
  fabricTypeFilter: string[];
  basemaps: BasemapVisibility;
};

function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function parseVisibility(raw: unknown): LayerVisibility | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (
    !isBool(o.neighborhoods)
    || !isBool(o.fabrics)
    || !isBool(o.dwellings)
    || !isBool(o.urban)
  ) {
    return null;
  }
  return {
    neighborhoods: o.neighborhoods,
    fabrics: o.fabrics,
    dwellings: o.dwellings,
    urban: o.urban,
  };
}

function parseBasemaps(raw: unknown): BasemapVisibility | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const next = defaultBasemapVisibility();
  let any = false;
  for (const b of BASEMAPS) {
    const on = o[b.id];
    if (isBool(on)) {
      next[b.id] = on;
      any = true;
    }
  }
  return any ? next : null;
}

function parseUrbanVisibility(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const next: Record<string, boolean> = {};
  for (const [id, on] of Object.entries(raw as Record<string, unknown>)) {
    if (id && isBool(on)) next[id] = on;
  }
  return next;
}

function parseFabricFilter(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** Load persisted GIS layer display prefs (client-only). */
export function loadGisLayerPrefs(): GisLayerPrefs {
  const fallback: GisLayerPrefs = {
    visibility: { ...DEFAULT_LAYER_VISIBILITY },
    urbanLayerVisibility: {},
    fabricTypeFilter: [],
    basemaps: defaultBasemapVisibility(),
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<GisLayerPrefs>;
    return {
      visibility: parseVisibility(parsed.visibility) ?? fallback.visibility,
      urbanLayerVisibility: parseUrbanVisibility(parsed.urbanLayerVisibility),
      fabricTypeFilter: parseFabricFilter(parsed.fabricTypeFilter),
      basemaps: parseBasemaps(parsed.basemaps) ?? fallback.basemaps,
    };
  } catch {
    return fallback;
  }
}

/** Persist GIS layer display prefs. */
export function saveGisLayerPrefs(prefs: GisLayerPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}

export type { BasemapId };
