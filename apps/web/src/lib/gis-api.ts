import { GeoJsonFeatureCollection, GisFeatureType, IngestTargetType, asFeatureCollection, parseApiResult } from '@city-manager/shared';
import { API_URL, apiFetch, sessionHeaders } from './api';

export interface FabricType {
  id: string;
  code: string;
  name: string;
  colorHex: string;
  fillOpacity: number;
}

export interface LayerVisibility {
  neighborhoods: boolean;
  fabrics: boolean;
  dwellings: boolean;
  urban: boolean;
}

export interface UrbanLayerBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface UrbanLayer {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: import('@city-manager/shared').UrbanLayerCategory;
  color_hex: string;
  fill_opacity: number;
  stroke_hex: string;
  stroke_width?: number;
  is_active: boolean;
  feature_count?: number;
  published_version?: number | null;
  sort_order?: number;
  bounds?: UrbanLayerBounds | null;
}

export interface MapFeatureProperties {
  featureType: GisFeatureType;
  id: string;
  name?: string;
  code?: string;
  colorHex?: string;
  fillOpacity?: number;
  layer: string;
  layerId?: string;
  layerName?: string;
  category?: string;
  [key: string]: unknown;
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function isAbortLike(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

export async function fetchGeoJson(params?: {
  layers?: string;
  neighborhoodIds?: string;
  fabricTypeIds?: string;
  urbanLayerIds?: string;
  /** minLng,minLat,maxLng,maxLat */
  bbox?: string;
  zoom?: number;
  signal?: AbortSignal;
}) {
  const qs = new URLSearchParams();
  if (params?.layers) qs.set('layers', params.layers);
  if (params?.neighborhoodIds) qs.set('neighborhoodIds', params.neighborhoodIds);
  if (params?.fabricTypeIds) qs.set('fabricTypeIds', params.fabricTypeIds);
  if (params?.urbanLayerIds) qs.set('urbanLayerIds', params.urbanLayerIds);
  if (params?.bbox) qs.set('bbox', params.bbox);
  if (params?.zoom != null && Number.isFinite(params.zoom)) qs.set('zoom', String(params.zoom));
  const q = qs.toString();

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (params?.signal?.aborted) throw abortError();
      const res = await fetch(`${API_URL}/gis/geojson${q ? `?${q}` : ''}`, {
        headers: sessionHeaders(),
        credentials: 'include',
        signal: params?.signal,
      });
      if (params?.signal?.aborted) throw abortError();

      const raw = await res.text();
      if (params?.signal?.aborted) throw abortError();

      let json: unknown = null;
      if (raw.trim()) {
        try {
          json = JSON.parse(raw);
        } catch {
          if (params?.signal?.aborted) throw abortError();
          json = null;
        }
      }

      const parsed = parseApiResult<unknown>(json, res.ok);
      if (!parsed.success) {
        const err = new Error(parsed.error?.message ?? `geojson ${res.status}`);
        if (res.status >= 500 && attempt < 2) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
          continue;
        }
        throw err;
      }

      const fc = asFeatureCollection(parsed.data ?? json);
      return fc as GeoJsonFeatureCollection;
    } catch (err) {
      if (isAbortLike(err, params?.signal)) throw abortError();
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /ECONNRESET|EACCES|fetch failed|network|502|503|504|ارتباط با سرور/i.test(msg);
      if (!retryable || attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error('geojson failed');
}

export async function fetchFabricTypes() {
  const res = await fetch(`${API_URL}/gis/fabric-types`, { headers: sessionHeaders(), credentials: 'include' });
  if (!res.ok) return [] as FabricType[];
  const json = await res.json().catch(() => null);
  return (json?.data ?? []) as FabricType[];
}

export async function fetchFeatureDetail(type: GisFeatureType, id: string) {
  const res = await fetch(`${API_URL}/gis/features/${type}/${id}`, { headers: sessionHeaders(), credentials: 'include' });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchNeighborhoodContained(id: string) {
  const res = await fetch(`${API_URL}/gis/neighborhoods/${id}/contained`, { headers: sessionHeaders(), credentials: 'include' });
  return res.json().catch(() => ({ success: false }));
}

export async function spatialSearch(lat: number, lng: number, radiusMeters = 500) {
  const res = await fetch(
    `${API_URL}/gis/spatial/search?lat=${lat}&lng=${lng}&radiusMeters=${radiusMeters}`,
    { headers: sessionHeaders(), credentials: 'include' },
  );
  return res.json().catch(() => ({ success: false }));
}

export async function updateNeighborhoodGeometry(id: string, geometry: object) {
  return apiFetch(`/gis/neighborhoods/${id}/geometry`, {
    method: 'PATCH',
    body: JSON.stringify({ geometry }),
  });
}

export async function updateFabricGeometry(id: string, geometry: object) {
  return apiFetch(`/gis/fabrics/${id}/geometry`, {
    method: 'PATCH',
    body: JSON.stringify({ geometry }),
  });
}

export async function updateDwellingLocation(id: string, geometry: object) {
  return apiFetch(`/gis/dwellings/${id}/location`, {
    method: 'PATCH',
    body: JSON.stringify({ geometry }),
  });
}

export async function updateNeighborhood(id: string, payload: {
  name?: string;
  status?: string;
  municipalDistrict?: number;
  population?: number;
  householdCount?: number;
  avgIncome?: number;
  literacyRate?: number;
  areaSqm?: number;
  metadata?: Record<string, unknown>;
}) {
  return apiFetch(`/gis/neighborhoods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createNeighborhood(payload: {
  code: string;
  name: string;
  status?: string;
  municipalDistrict?: number;
  population?: number;
  householdCount?: number;
  avgIncome?: number;
  literacyRate?: number;
  areaSqm?: number;
  geometry?: object;
  metadata?: Record<string, unknown>;
}) {
  return apiFetch<{ id: string; code: string; name: string; has_geometry?: boolean }>('/gis/neighborhoods', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createDwelling(payload: {
  geometry?: object;
  title?: string;
  fullAddress?: string;
  dwellingCode?: string;
  neighborhoodId?: string;
  buildingType?: string;
  metadata?: Record<string, unknown>;
}) {
  return apiFetch<{ id: string; title?: string; has_geometry?: boolean }>('/gis/dwellings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createFabric(payload: {
  fabricTypeId: string;
  geometry?: object;
  name?: string;
  code?: string;
  neighborhoodId?: string;
}) {
  return apiFetch<{ id: string; name?: string; has_geometry?: boolean }>('/gis/fabrics', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type IngestProgress = {
  /** Overall 0–100 spanning upload + server processing */
  percent: number;
  phase: 'upload' | 'processing' | 'done';
};

export async function ingestSpatialFile(
  file: File,
  targetType: IngestTargetType,
  options?: {
    fabricTypeId?: string;
    neighborhoodId?: string;
    defaultName?: string;
    layerId?: string;
    layerCode?: string;
    layerName?: string;
    category?: string;
    colorHex?: string;
    onProgress?: (progress: IngestProgress) => void;
  },
) {
  const form = new FormData();
  form.append('file', file);
  const qs = new URLSearchParams({ targetType });
  if (options?.fabricTypeId) qs.set('fabricTypeId', options.fabricTypeId);
  if (options?.neighborhoodId) qs.set('neighborhoodId', options.neighborhoodId);
  if (options?.defaultName) qs.set('defaultName', options.defaultName);
  if (options?.layerId) qs.set('layerId', options.layerId);
  if (options?.layerCode) qs.set('layerCode', options.layerCode);
  if (options?.layerName) qs.set('layerName', options.layerName);
  if (options?.category) qs.set('category', options.category);
  if (options?.colorHex) qs.set('colorHex', options.colorHex);

  const report = options?.onProgress;
  /** Upload bytes map to 0–75; remaining reserved for server parse/import. */
  const UPLOAD_CAP = 75;

  return new Promise<ApiResultUnknown>((resolve) => {
    const xhr = new XMLHttpRequest();
    let processingTimer: ReturnType<typeof setInterval> | null = null;
    let processingPct = UPLOAD_CAP;

    const clearProcessingTick = () => {
      if (processingTimer != null) {
        clearInterval(processingTimer);
        processingTimer = null;
      }
    };

    const finish = (result: ApiResultUnknown) => {
      clearProcessingTick();
      if (result.success) report?.({ percent: 100, phase: 'done' });
      resolve(result);
    };

    xhr.open('POST', `${API_URL}/gis/ingest?${qs.toString()}`);
    xhr.withCredentials = true;
    const headers = sessionHeaders(false);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable || !report) return;
      const ratio = Math.min(1, ev.loaded / Math.max(1, ev.total));
      report({
        percent: Math.min(UPLOAD_CAP - 1, Math.round(ratio * UPLOAD_CAP)),
        phase: 'upload',
      });
    };

    xhr.upload.onload = () => {
      report?.({ percent: UPLOAD_CAP, phase: 'processing' });
      processingPct = UPLOAD_CAP;
      // Slow crawl 75→98 while Nest parses/inserts (no server-side progress stream yet).
      clearProcessingTick();
      processingTimer = setInterval(() => {
        processingPct = Math.min(98, processingPct + 1);
        report?.({ percent: processingPct, phase: 'processing' });
        if (processingPct >= 98) clearProcessingTick();
      }, 900);
    };

    xhr.onload = () => {
      const status = xhr.status;
      const text = xhr.responseText?.trim() ?? '';

      // Avoid JSON.parse on plain-text proxy errors (shows SyntaxError in console).
      if (!text || (text[0] !== '{' && text[0] !== '[')) {
        const lower = text.toLowerCase();
        const isInternal = lower.startsWith('internal server') || status >= 500;
        finish({
          success: false,
          error: {
            code: status === 413 ? 'PAYLOAD_TOO_LARGE' : isInternal ? 'INTERNAL_ERROR' : 'INVALID_RESPONSE',
            message:
              status === 413
                ? 'حجم فایل بیش از حد مجاز است (حداکثر ۱۰۰ مگابایت).'
                : status === 502 || status === 504
                  ? 'زمان پردازش فایل به‌پایان رسید. دوباره تلاش کنید.'
                  : isInternal
                    ? 'خطای داخلی سرور هنگام import. اگر فایل خیلی بزرگ است چند دقیقه صبر کنید و دوباره تلاش کنید.'
                    : `پاسخ نامعتبر از سرور${status ? ` (کد ${status})` : ''}`,
          },
        });
        return;
      }

      let json: unknown = {};
      try {
        json = JSON.parse(text);
      } catch {
        finish({
          success: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: `پاسخ نامعتبر از سرور${status ? ` (کد ${status})` : ''}`,
          },
        });
        return;
      }
      finish(parseApiResult(json, status >= 200 && status < 300));
    };

    xhr.onerror = () => {
      finish({
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'خطا در ارتباط هنگام آپلود' },
      });
    };

    xhr.onabort = () => {
      finish({
        success: false,
        error: { code: 'ABORTED', message: 'آپلود لغو شد' },
      });
    };

    report?.({ percent: 0, phase: 'upload' });
    xhr.send(form);
  });
}

type ApiResultUnknown = {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
};

export async function fetchUrbanLayers() {
  return apiFetch<UrbanLayer[]>('/gis/urban-layers', {});
}

export async function createUrbanLayer(payload: {
  code: string;
  name: string;
  category?: string;
  colorHex?: string;
  strokeHex?: string;
  fillOpacity?: number;
  description?: string;
}) {
  return apiFetch<UrbanLayer>('/gis/urban-layers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUrbanLayer(
  id: string,
  payload: {
    name?: string;
    isActive?: boolean;
    colorHex?: string;
    fillOpacity?: number;
    strokeWidth?: number;
    category?: string;
    strokeHex?: string;
  },
) {
  return apiFetch<UrbanLayer>(`/gis/urban-layers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteUrbanLayer(id: string) {
  return apiFetch<{ id: string }>(`/gis/urban-layers/${id}`, {
    method: 'DELETE',
  });
}

export async function createFabricType(payload: {
  code: string;
  name: string;
  colorHex?: string;
  fillOpacity?: number;
}) {
  return apiFetch<{ id: string; code: string; name: string; colorHex: string; fillOpacity: number }>('/gis/fabric-types', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFabricType(
  id: string,
  payload: { name?: string; colorHex?: string; fillOpacity?: number },
) {
  return apiFetch(`/gis/fabric-types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateFabric(
  id: string,
  payload: { fabricTypeId?: string; name?: string },
) {
  return apiFetch(`/gis/fabrics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchAreaProjects(params?: { targetType?: string; targetId?: string; programId?: string }) {
  const qs = new URLSearchParams();
  if (params?.targetType) qs.set('targetType', params.targetType);
  if (params?.targetId) qs.set('targetId', params.targetId);
  if (params?.programId) qs.set('programId', params.programId);
  const q = qs.toString();
  return apiFetch<import('@city-manager/shared').AreaProjectDto[]>(
    `/gis/projects${q ? `?${q}` : ''}`,
    {},
  );
}

export async function createAreaProject(payload: Record<string, unknown>) {
  return apiFetch<import('@city-manager/shared').AreaProjectDto>('/gis/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAreaProject(id: string, payload: Record<string, unknown>) {
  return apiFetch<import('@city-manager/shared').AreaProjectDto>(`/gis/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAreaProject(id: string) {
  return apiFetch<{ id: string }>(`/gis/projects/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteMapFeature(type: GisFeatureType, id: string) {
  return apiFetch<{ id: string }>(`/gis/features/${type}/${id}`, {
    method: 'DELETE',
  });
}
