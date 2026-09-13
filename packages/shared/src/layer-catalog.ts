export type RowSortDir = 'asc' | 'desc';

import {
  NeighborhoodKind,
  neighborhoodKind,
  resolveNormalFabricTypeId,
} from './regeneration-types';

export const NEW_LINKED_ID = '__new__';

const NEIGHBORHOOD_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXY';

function randomCodeSegment(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += NEIGHBORHOOD_CODE_ALPHABET[Math.floor(Math.random() * NEIGHBORHOOD_CODE_ALPHABET.length)];
  }
  return out;
}

/** کد ترکیبی محله — مثلاً SH-D3-K7NP (شهری) یا HD-D2-X9RT (هدف بازآفرینی) */
export function generateNeighborhoodCode(input?: {
  kind?: NeighborhoodKind;
  municipalDistrict?: string | number;
  existingCodes?: string[];
}): string {
  const kind = input?.kind ?? NeighborhoodKind.URBAN;
  const prefix = kind === NeighborhoodKind.URBAN ? 'SH' : 'HD';
  const districtRaw = input?.municipalDistrict;
  const districtNum =
    districtRaw != null && String(districtRaw).trim() !== '' ? Number(districtRaw) : null;
  const districtPart =
    districtNum != null && Number.isInteger(districtNum) && districtNum >= 1 && districtNum <= 8
      ? `D${districtNum}`
      : '';
  const taken = new Set(
    (input?.existingCodes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean),
  );

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const core = `${randomCodeSegment(2)}${randomCodeSegment(2)}`;
    const code = [prefix, districtPart, core].filter(Boolean).join('-');
    if (!taken.has(code.toUpperCase())) return code;
  }

  return [prefix, districtPart || randomCodeSegment(2), randomCodeSegment(4), randomCodeSegment(2)]
    .filter(Boolean)
    .join('-');
}

export function withStableRowNumbers<T>(items: T[]): Array<T & { rowNo: number }> {
  return items.map((item, index) => ({ ...item, rowNo: index + 1 }));
}

export function sortByRowNumber<T extends { rowNo: number }>(items: T[], dir: RowSortDir): T[] {
  return [...items].sort((a, b) => (dir === 'asc' ? a.rowNo - b.rowNo : b.rowNo - a.rowNo));
}

export function nextRowSortDir(dir: RowSortDir): RowSortDir {
  return dir === 'asc' ? 'desc' : 'asc';
}

export function addUniqueId(ids: string[], id: string): string[] {
  const next = id.trim();
  if (!next || ids.includes(next)) return ids;
  return [...ids, next];
}

export function removeId(ids: string[], id: string): string[] {
  return ids.filter((value) => value !== id);
}

export function parseFabricTypeIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return parseFabricTypeIds(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

export function neighborhoodFabricTypeIds(row: {
  metadata?: unknown;
  fabric_type_ids?: unknown;
  fabricTypeIds?: unknown;
}): string[] {
  if (row.fabric_type_ids != null) return parseFabricTypeIds(row.fabric_type_ids);
  if (row.fabricTypeIds != null) return parseFabricTypeIds(row.fabricTypeIds);
  const meta = row.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return parseFabricTypeIds((meta as { fabricTypeIds?: unknown }).fabricTypeIds);
  }
  return [];
}

function presentNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface NeighborhoodProfileStats {
  population: number | null;
  areaSqm: number | null;
  areaHectares: number | null;
  densityPerHa: number | null;
  popShare: number;
  areaShare: number;
}

export function neighborhoodProfileStats(input: {
  population?: unknown;
  areaSqm?: unknown;
  maxPopulation?: number;
  maxAreaSqm?: number;
}): NeighborhoodProfileStats {
  const population = presentNumber(input.population);
  const areaSqm = presentNumber(input.areaSqm);
  const areaHectares = areaSqm != null ? areaSqm / 10000 : null;
  const densityPerHa =
    population != null && areaHectares != null && areaHectares > 0
      ? population / areaHectares
      : null;
  const maxPop = input.maxPopulation && input.maxPopulation > 0 ? input.maxPopulation : 0;
  const maxArea = input.maxAreaSqm && input.maxAreaSqm > 0 ? input.maxAreaSqm : 0;
  return {
    population,
    areaSqm,
    areaHectares,
    densityPerHa,
    popShare: population != null && maxPop > 0 ? Math.min(1, population / maxPop) : 0,
    areaShare: areaSqm != null && maxArea > 0 ? Math.min(1, areaSqm / maxArea) : 0,
  };
}

export type LinkedPlaceIds = {
  neighborhoodId: string;
  /** @deprecated فقط برای سازگاری داخلی؛ در UI نمایش داده نمی‌شود */
  fabricId: string;
  fabricTypeId: string;
  neighborhoodKind?: import('./regeneration-types').NeighborhoodKind;
  parentUrbanNeighborhoodId?: string;
};

export type LinkedFabricRef = {
  id: string;
  neighborhood_id?: string | null;
  fabric_type_id?: string | null;
};

export function isPersistedLinkedId(id: string | undefined | null): boolean {
  return Boolean(id && id !== NEW_LINKED_ID);
}

export function fabricsForNeighborhood<T extends LinkedFabricRef>(
  fabrics: T[],
  neighborhoodId: string,
): T[] {
  if (!isPersistedLinkedId(neighborhoodId)) return [];
  return fabrics.filter((f) => f.neighborhood_id === neighborhoodId);
}

export function linkedTypeIdsForNeighborhood(
  neighborhood: { metadata?: unknown; fabric_type_ids?: unknown; fabricTypeIds?: unknown } | undefined,
  fabrics: LinkedFabricRef[],
  neighborhoodId: string,
): string[] {
  const fromMeta = neighborhood ? neighborhoodFabricTypeIds(neighborhood) : [];
  const fromFabrics = fabrics
    .filter((f) => f.neighborhood_id === neighborhoodId && f.fabric_type_id)
    .map((f) => String(f.fabric_type_id));
  return [...new Set([...fromMeta, ...fromFabrics])];
}

export function fabricTypesForNeighborhood<T extends { id: string }>(
  neighborhood: { metadata?: unknown; fabric_type_ids?: unknown; fabricTypeIds?: unknown } | undefined,
  fabricTypes: T[],
  fabrics: LinkedFabricRef[],
  neighborhoodId: string,
): T[] {
  if (!isPersistedLinkedId(neighborhoodId)) return fabricTypes;
  if (neighborhood && neighborhoodKind(neighborhood) === NeighborhoodKind.URBAN) {
    const normalId = resolveNormalFabricTypeId(fabricTypes);
    if (normalId) {
      const normal = fabricTypes.find((t) => t.id === normalId);
      return normal ? [normal] : fabricTypes;
    }
  }
  const ids = new Set(linkedTypeIdsForNeighborhood(neighborhood, fabrics, neighborhoodId));
  if (ids.size === 0) return fabricTypes;
  const matched = fabricTypes.filter((t) => ids.has(t.id));
  return matched.length > 0 ? matched : fabricTypes;
}

export function defaultFabricTypeForNeighborhoodKind(
  kind: NeighborhoodKind,
  fabricTypes: Array<{ id: string; code?: string; name?: string }>,
): string {
  if (kind === NeighborhoodKind.URBAN) {
    return resolveNormalFabricTypeId(fabricTypes) ?? '';
  }
  return '';
}

export function buildNeighborhoodMetadata(input: {
  neighborhoodKind: NeighborhoodKind;
  parentUrbanNeighborhoodId?: string;
  fabricTypeIds?: string[];
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    neighborhoodKind: input.neighborhoodKind,
    ...(input.extra ?? {}),
  };
  if (input.neighborhoodKind === NeighborhoodKind.REGENERATION_TARGET && input.parentUrbanNeighborhoodId) {
    meta.parentUrbanNeighborhoodId = input.parentUrbanNeighborhoodId;
  }
  if (input.fabricTypeIds?.length) {
    meta.fabricTypeIds = input.fabricTypeIds;
  }
  return meta;
}

export function resolveFabricIdForPlace(
  fabrics: LinkedFabricRef[],
  neighborhoodId: string,
  fabricTypeId: string,
): string {
  if (!isPersistedLinkedId(neighborhoodId) || !isPersistedLinkedId(fabricTypeId)) return '';
  return fabrics.find(
    (f) => f.neighborhood_id === neighborhoodId && f.fabric_type_id === fabricTypeId,
  )?.id ?? '';
}

export function suggestFabricName(neighborhoodName: string, fabricTypeName: string): string {
  const n = neighborhoodName.trim();
  const t = fabricTypeName.trim();
  if (n && t) return `${n} — ${t}`;
  return n || t;
}

export function syncLinkedPlaceSelection(
  next: LinkedPlaceIds,
  fabrics: LinkedFabricRef[],
  previous?: LinkedPlaceIds,
  fabricTypes: Array<{ id: string; code?: string; name?: string }> = [],
): LinkedPlaceIds {
  const neighborhoodId = next.neighborhoodId;
  if (!isPersistedLinkedId(neighborhoodId)) {
    const kind = next.neighborhoodKind ?? NeighborhoodKind.REGENERATION_TARGET;
    let fabricTypeId = next.fabricTypeId;
    if (kind === NeighborhoodKind.URBAN) {
      fabricTypeId = defaultFabricTypeForNeighborhoodKind(NeighborhoodKind.URBAN, fabricTypes) || fabricTypeId;
    }
    return {
      neighborhoodId: neighborhoodId || '',
      fabricId: '',
      fabricTypeId,
      neighborhoodKind: kind,
      parentUrbanNeighborhoodId: next.parentUrbanNeighborhoodId,
    };
  }

  const neighborhoodChanged = Boolean(previous && previous.neighborhoodId !== neighborhoodId);
  let fabricTypeId = next.fabricTypeId;

  if (neighborhoodChanged) {
    const inNbh = fabricsForNeighborhood(fabrics, neighborhoodId);
    if (isPersistedLinkedId(next.fabricTypeId)) {
      fabricTypeId = next.fabricTypeId;
    } else if (inNbh.length === 1 && inNbh[0].fabric_type_id) {
      fabricTypeId = inNbh[0].fabric_type_id;
    } else {
      fabricTypeId = '';
    }
  } else if (isPersistedLinkedId(next.fabricTypeId)) {
    fabricTypeId = next.fabricTypeId;
  }

  return {
    neighborhoodId,
    fabricId: '',
    fabricTypeId,
    neighborhoodKind: next.neighborhoodKind,
    parentUrbanNeighborhoodId: next.parentUrbanNeighborhoodId,
  };
}
