'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import {
  fetchGeoJson,
  fetchFabricTypes,
  fetchFeatureDetail,
  fetchNeighborhoodContained,
  fetchUrbanLayers,
  updateUrbanLayer,
  createDwelling,
  createFabric,
  updateNeighborhoodGeometry,
  updateFabricGeometry,
  updateDwellingLocation,
  deleteMapFeature,
  MapFeatureProperties,
  FabricType,
  LayerVisibility,
  UrbanLayer,
} from '@/lib/gis-api';
import { GisFeatureType, GeoJsonFeatureCollection, HouseholdDetailTab, buildMapCaseUrl, getCasePresentationMode, GIS_HOVER_LAYER_IDS, mapHoverCursor, applyLayerStyleToFeatures, buildMapLegendItems, buildLayersGeoJson, mergeByLayers, resolveMapViewport, partitionFeaturesByGeometry, getGeometryBounds, buildViewportRequestKey, GIS_DEFAULT_CENTER, GIS_DEFAULT_ZOOM, GIS_VIEWPORT_LAYER_KEYS, MapPrintLayoutSettings, PrintFormat, normalizeDigitsForSearch, featureSearchHaystack } from '@city-manager/shared';
import './gis-map.css';
import { LayerControlPanel } from './LayerControlPanel';
import { FeaturePopup } from './FeaturePopup';
import { SpatialFileUpload } from './SpatialFileUpload';
import { DrawToolbar, DrawTool, toolHint } from './DrawToolbar';
import { CoordinateInputModal } from './CoordinateInputModal';
import { MapPrintLayoutModal, type PrintPreviewSource } from './MapPrintLayoutModal';
import { mapDrawStyles, DRAW_PREVIEW } from './map-draw-styles';
import { captureMapCanvas, exportMapWithLayout } from './map-export';
import {
  BASEMAPS,
  BasemapVisibility,
  layerId as basemapLayerId,
  sourceId as basemapSourceId,
} from './basemaps';
import {
  DEFAULT_LAYER_VISIBILITY,
  loadGisLayerPrefs,
  saveGisLayerPrefs,
} from './gis-layer-prefs';
import {
  circlePolygon,
  LngLat,
  rectanglePolygon,
  squarePolygon,
} from './draw-geometry';
import { formatNumber } from '@/lib/format';
import { useFeedback } from '@/components/ui/Feedback';
import { LoadingOverlay, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { boundsFromUrbanLayer } from '@city-manager/shared';
import { Drawer } from '@/components/ui/Drawer';
import { HouseholdDetailPanel } from '@/components/case/HouseholdDetailPanel';
import { useUxPersona } from '@/lib/use-ux-persona';
import { useAuth } from '@/lib/auth';
import { useDashboardAccess } from '@/lib/use-dashboard-access';

const MAP_CASE_SPLIT_MQ = '(min-width: 1100px)';

const VIEWPORT_DEBOUNCE_MS = 420;
const VIEWPORT_LAYER_KEYS = GIS_VIEWPORT_LAYER_KEYS;
const LAYERS_LOADING_DELAY_MS = 320;

function resolveMapViewportFromMap(map: maplibregl.Map | null): { bbox: string; zoom: number; key: string } {
  if (!map) return resolveMapViewport(null, GIS_DEFAULT_ZOOM);
  const b = map.getBounds();
  return resolveMapViewport(
    { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
    map.getZoom(),
  );
}

function attachDrawControl(map: maplibregl.Map): MapboxDraw {
  const drawConstants = (MapboxDraw as unknown as { constants: { classes: Record<string, string> } }).constants;
  drawConstants.classes.CANVAS = 'maplibregl-canvas';
  drawConstants.classes.CONTROL_BASE = 'maplibregl-ctrl';
  drawConstants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
  drawConstants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';
  drawConstants.classes.ATTRIBUTION = 'maplibregl-ctrl-attrib';

  const draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {},
    defaultMode: 'simple_select',
    styles: mapDrawStyles,
    boxSelect: true,
    keybindings: true,
    touchEnabled: true,
  });
  map.addControl(draw as unknown as maplibregl.IControl, 'top-left');
  return draw;
}

type AttachTarget = {
  kind: 'neighborhood' | 'fabric' | 'dwelling';
  id: string;
  name: string;
  next?: { kind: 'neighborhood' | 'fabric' | 'dwelling'; id: string; name: string };
};

function buildInitialStyle(): maplibregl.StyleSpecification {
  const sources: maplibregl.StyleSpecification['sources'] = {};
  const layers: maplibregl.LayerSpecification[] = [];
  for (const b of BASEMAPS) {
    sources[basemapSourceId(b.id)] = {
      type: 'raster',
      tiles: b.tiles,
      tileSize: b.tileSize ?? 256,
      attribution: b.attribution,
      maxzoom: b.maxzoom ?? 19,
    };
    layers.push({
      id: basemapLayerId(b.id),
      type: 'raster',
      source: basemapSourceId(b.id),
      layout: { visibility: b.defaultOn ? 'visible' : 'none' },
      paint: { 'raster-opacity': 1 },
    });
  }
  return {
    version: 8,
    sources,
    layers,
  };
}

export function MapWorkspace() {
  const feedback = useFeedback();
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { persona, householdTabs, defaultHouseholdTab } = useUxPersona();
  const { profile } = useAuth();
  const { canWrite: canEdit } = useDashboardAccess('/dashboard/map');
  const producerDefault = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const casePresentation = getCasePresentationMode(persona, 'map');

  const caseId = searchParams.get('case');
  const dwellingIdParam = searchParams.get('dwelling');
  const tabParam = searchParams.get('tab') as HouseholdDetailTab | null;
  const caseTab = tabParam && householdTabs.includes(tabParam) ? tabParam : defaultHouseholdTab;

  const [mapCaseWide, setMapCaseWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(MAP_CASE_SPLIT_MQ);
    const sync = () => setMapCaseWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const openCaseDrawer = useCallback((householdId: string, dwellingId?: string) => {
    router.replace(buildMapCaseUrl({
      householdId,
      dwellingId: dwellingId ?? dwellingIdParam ?? undefined,
      tab: caseTab,
    }), { scroll: false });
  }, [router, dwellingIdParam, caseTab]);

  const closeCasePanel = useCallback(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete('case');
    q.delete('tab');
    const qs = q.toString();
    router.replace(`/dashboard/map${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router, searchParams]);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const geoJsonRef = useRef<GeoJsonFeatureCollection | null>(null);
  const visibilityRef = useRef<LayerVisibility>({ ...DEFAULT_LAYER_VISIBILITY });
  const urbanVisibilityRef = useRef<Record<string, boolean>>({});
  const drawToolRef = useRef<DrawTool>('select');
  const shapeStartRef = useRef<LngLat | null>(null);
  const addDwellingRef = useRef(false);
  const drawEnabledRef = useRef(false);
  const attachRef = useRef<AttachTarget | null>(null);
  const focusPendingRef = useRef<{ type: GisFeatureType; id: string } | null>(null);
  const viewportAbortRef = useRef<AbortController | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportKeyRef = useRef<string>('');
  const loadViewportLayersRef = useRef<() => Promise<void>>(async () => undefined);
  const loadDataRef = useRef<() => Promise<void>>(async () => undefined);

  const [prefsReady] = useState(() => loadGisLayerPrefs());
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([]);
  const [urbanLayers, setUrbanLayers] = useState<UrbanLayer[]>([]);
  const [urbanLayerVisibility, setUrbanLayerVisibility] = useState<Record<string, boolean>>(
    () => prefsReady.urbanLayerVisibility,
  );
  const [visibility, setVisibility] = useState<LayerVisibility>(() => prefsReady.visibility);
  const [fabricTypeFilter, setFabricTypeFilter] = useState<string[]>(() => prefsReady.fabricTypeFilter);
  const [basemaps, setBasemaps] = useState<BasemapVisibility>(() => prefsReady.basemaps);
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('select');
  const [shapePending, setShapePending] = useState(false);
  const [addDwellingMode, setAddDwellingMode] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [printLayoutOpen, setPrintLayoutOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<PrintFormat>('png');
  const [printPreview, setPrintPreview] = useState<PrintPreviewSource | null>(null);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const [deletingFeature, setDeletingFeature] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<{
    properties: MapFeatureProperties;
    detail: Record<string, unknown> | null;
    lngLat: [number, number];
  } | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedFeature?.properties?.id ?? null;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [layersLoading, setLayersLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const layersLoadingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layersLoadingVisibleRef = useRef(false);
  const [attachTarget, setAttachTarget] = useState<AttachTarget | null>(null);

  const urbanLayersRef = useRef(urbanLayers);
  urbanLayersRef.current = urbanLayers;

  const urbanActiveKey = useMemo(
    () => urbanLayers
      .filter((l) => l.is_active)
      .map((l) => l.id)
      .sort()
      .join(','),
    [urbanLayers],
  );

  const beginLayersLoading = useCallback(() => {
    if (layersLoadingVisibleRef.current || layersLoadingDelayRef.current) return;
    layersLoadingDelayRef.current = setTimeout(() => {
      layersLoadingDelayRef.current = null;
      layersLoadingVisibleRef.current = true;
      setLayersLoading(true);
    }, LAYERS_LOADING_DELAY_MS);
  }, []);

  const endLayersLoading = useCallback(() => {
    if (layersLoadingDelayRef.current) {
      clearTimeout(layersLoadingDelayRef.current);
      layersLoadingDelayRef.current = null;
    }
    if (layersLoadingVisibleRef.current) {
      layersLoadingVisibleRef.current = false;
      setLayersLoading(false);
    }
  }, []);

  visibilityRef.current = visibility;
  urbanVisibilityRef.current = urbanLayerVisibility;
  drawToolRef.current = drawTool;
  attachRef.current = attachTarget;
  addDwellingRef.current = addDwellingMode;
  drawEnabledRef.current = drawEnabled;

  useEffect(() => {
    saveGisLayerPrefs({
      visibility,
      urbanLayerVisibility,
      fabricTypeFilter,
      basemaps,
    });
  }, [visibility, urbanLayerVisibility, fabricTypeFilter, basemaps]);

  useEffect(() => {
    const kind = searchParams.get('attach');
    const id = searchParams.get('id');
    const name = searchParams.get('name') || 'مورد انتخاب‌شده';
    const nextKind = searchParams.get('nextAttach');
    const nextId = searchParams.get('nextId');
    const nextName = searchParams.get('nextName') || '';
    const next: AttachTarget['next'] =
      (nextKind === 'neighborhood' || nextKind === 'fabric' || nextKind === 'dwelling') && nextId
        ? { kind: nextKind, id: nextId, name: nextName || 'محدوده بعدی' }
        : undefined;
    if (
      (kind === 'neighborhood' || kind === 'fabric' || kind === 'dwelling')
      && id
    ) {
      setAttachTarget({ kind, id, name, next });
      setDrawEnabled(true);
      setAddDwellingMode(false);
      const tool: DrawTool = kind === 'dwelling' ? 'point' : 'polygon';
      setDrawTool(tool);
      setStatusMsg(
        kind === 'dwelling'
          ? `یک نقطه برای «${name}» بزنید و ذخیره کنید`
          : `محدوده «${name}» را بکشید و ذخیره کنید`,
      );
      setTimeout(() => {
        if (tool === 'point' || tool === 'polygon') {
          drawRef.current?.changeMode(tool === 'point' ? 'draw_point' : 'draw_polygon');
        }
      }, 400);
    }
  }, [searchParams]);

  useEffect(() => {
    const dwellingId = searchParams.get('dwelling');
    const neighborhoodId = searchParams.get('neighborhood');
    if (dwellingId) focusPendingRef.current = { type: GisFeatureType.DWELLING, id: dwellingId };
    else if (neighborhoodId) focusPendingRef.current = { type: GisFeatureType.NEIGHBORHOOD, id: neighborhoodId };
  }, [searchParams]);

  const updateMapSources = useCallback((fc: GeoJsonFeatureCollection) => {
    const map = mapRef.current;
    if (!map) return;
    const filtered = buildLayersGeoJson(fc, visibilityRef.current, urbanVisibilityRef.current);
    const selectedId = selectedIdRef.current;

    const withSelection = filtered.features.map((f) => ({
      ...f,
      properties: {
        ...(f.properties ?? {}),
        selected: String(f.properties?.id ?? '') === String(selectedId ?? ''),
      },
    }));

    const { polygons, points, lines } = partitionFeaturesByGeometry(withSelection);

    const polySource = map.getSource('gis-polygons') as maplibregl.GeoJSONSource | undefined;
    const pointSource = map.getSource('gis-points') as maplibregl.GeoJSONSource | undefined;
    const lineSource = map.getSource('gis-lines') as maplibregl.GeoJSONSource | undefined;

    if (polySource) {
      polySource.setData({ type: 'FeatureCollection', features: polygons } as GeoJSON.FeatureCollection);
    }
    if (pointSource) {
      pointSource.setData({ type: 'FeatureCollection', features: points } as GeoJSON.FeatureCollection);
    }
    if (lineSource) {
      lineSource.setData({ type: 'FeatureCollection', features: lines } as GeoJSON.FeatureCollection);
    }
    setVisibleCount(filtered.features.length);
  }, []);

  const focusFeature = useCallback(async (featureType: GisFeatureType, id: string) => {
    const map = mapRef.current;
    const fc = geoJsonRef.current;
    if (!map || !fc) {
      focusPendingRef.current = { type: featureType, id };
      return;
    }
    const match = fc.features.find(
      (f) => String(f.properties?.id) === id && String(f.properties?.featureType) === featureType,
    );
    if (!match?.geometry) {
      setStatusMsg('عارضه روی نقشه یافت نشد');
      return;
    }
    if (match.geometry.type === 'Point') {
      const coords = match.geometry.coordinates as [number, number];
      map.flyTo({ center: coords, zoom: 17 });
    } else {
      map.fitBounds(getGeometryBounds(match.geometry), { padding: 48 });
    }
    const raw = match.properties as Record<string, unknown>;
    const props: MapFeatureProperties = {
      ...raw,
      featureType,
      id,
      layer: String(raw.layer ?? ''),
    };
    try {
      const detailRes = await fetchFeatureDetail(featureType, id);
      const center = match.geometry.type === 'Point'
        ? (match.geometry.coordinates as [number, number])
        : [map.getCenter().lng, map.getCenter().lat] as [number, number];
      setSelectedFeature({
        properties: props,
        detail: detailRes.data ?? null,
        lngLat: center,
      });
    } catch {
      setSelectedFeature({
        properties: props,
        detail: null,
        lngLat: [map.getCenter().lng, map.getCenter().lat],
      });
    }
    updateMapSources(fc);
    setStatusMsg('');
  }, [updateMapSources]);

  const loadViewportLayers = useCallback(async (opts?: { force?: boolean }) => {
    const map = mapRef.current;
    const vis = visibilityRef.current;
    const urbanList = urbanLayersRef.current;
    const urbanVis = urbanVisibilityRef.current;
    const viewport = resolveMapViewportFromMap(map);

    const enabledUrbanIds = urbanList
      .filter((l) => l.is_active && urbanVis[l.id] !== false)
      .map((l) => l.id)
      .sort();
    const wantUrban = Boolean(vis.urban && enabledUrbanIds.length);
    const wantDwellings = Boolean(vis.dwellings);
    const wantNeighborhoods = Boolean(vis.neighborhoods);
    const wantFabrics = Boolean(vis.fabrics);
    const fabricTypeIds = fabricTypeFilter.length ? fabricTypeFilter.join(',') : undefined;
    const requestKey = buildViewportRequestKey(viewport.key, enabledUrbanIds, wantDwellings, {
      neighborhoods: wantNeighborhoods,
      fabrics: wantFabrics,
      fabricTypeIds,
    });

    if (!opts?.force && requestKey === viewportKeyRef.current) return;

    viewportAbortRef.current?.abort();
    const ac = new AbortController();
    viewportAbortRef.current = ac;

    if (!wantUrban && !wantDwellings && !wantNeighborhoods && !wantFabrics) {
      const cleared = mergeByLayers(
        geoJsonRef.current,
        { type: 'FeatureCollection', features: [] },
        VIEWPORT_LAYER_KEYS,
      );
      geoJsonRef.current = cleared;
      updateMapSources(cleared);
      viewportKeyRef.current = requestKey;
      endLayersLoading();
      return;
    }

    beginLayersLoading();
    try {
      const layerParts: string[] = [];
      if (wantNeighborhoods) layerParts.push('neighborhoods');
      if (wantFabrics) layerParts.push('fabrics');
      if (wantUrban) layerParts.push('urban');
      if (wantDwellings) layerParts.push('dwellings');

      const fc = await fetchGeoJson({
        layers: layerParts.join(','),
        urbanLayerIds: wantUrban ? enabledUrbanIds.join(',') : undefined,
        fabricTypeIds: wantFabrics ? fabricTypeIds : undefined,
        bbox: viewport.bbox,
        zoom: viewport.zoom,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;

      const incoming = {
        type: 'FeatureCollection' as const,
        features: fc.features ?? [],
      };
      const merged = mergeByLayers(geoJsonRef.current, incoming, VIEWPORT_LAYER_KEYS);
      geoJsonRef.current = merged;
      updateMapSources(merged);
      viewportKeyRef.current = requestKey;
      setStatusMsg((prev) => (prev.startsWith('بارگذاری') ? '' : prev));
    } catch (err) {
      if (ac.signal.aborted || (err as { name?: string })?.name === 'AbortError') return;
      console.warn('viewport layer load failed', err);
      setStatusMsg('بارگذاری لایه‌های محدوده دید ناموفق بود');
    } finally {
      endLayersLoading();
    }
  }, [beginLayersLoading, endLayersLoading, fabricTypeFilter, updateMapSources]);

  const loadBaseLayers = useCallback(async () => {
    await loadViewportLayers({ force: true });
  }, [loadViewportLayers]);

  const loadData = useCallback(async () => {
    viewportKeyRef.current = '';
    await loadViewportLayers({ force: true });
    const pending = focusPendingRef.current;
    if (pending) {
      focusPendingRef.current = null;
      void focusFeature(pending.type, pending.id);
    }
  }, [loadViewportLayers, focusFeature]);

  loadViewportLayersRef.current = () => loadViewportLayers({ force: true });
  loadDataRef.current = loadData;

  const fitUrbanLayer = useCallback((layer: UrbanLayer) => {
    const map = mapRef.current;
    const b = boundsFromUrbanLayer(layer);
    if (!map || !b) return;
    map.fitBounds(
      [[b.west, b.south], [b.east, b.north]],
      { padding: 56, duration: 900, maxZoom: 15 },
    );
    viewportKeyRef.current = '';
    window.setTimeout(() => {
      void loadViewportLayers({ force: true });
    }, 950);
  }, [loadViewportLayers]);

  async function refreshUrbanLayers() {
    const res = await fetchUrbanLayers();
    if (res.success && Array.isArray(res.data)) {
      setUrbanLayers(res.data);
      setUrbanLayerVisibility((prev) => {
        const next = { ...prev };
        for (const l of res.data!) {
          if (next[l.id] === undefined) next[l.id] = true;
        }
        return next;
      });
      return res.data;
    }
    return [] as UrbanLayer[];
  }

  useEffect(() => {
    void refreshUrbanLayers().then((layers) => {
      if (!mapRef.current || layers.length === 0) return;
      const withData = layers.filter(
        (l) => l.is_active && (l.feature_count ?? 0) > 0 && boundsFromUrbanLayer(l),
      );
      if (withData.length === 0) return;
      const west = Math.min(...withData.map((l) => boundsFromUrbanLayer(l)!.west));
      const south = Math.min(...withData.map((l) => boundsFromUrbanLayer(l)!.south));
      const east = Math.max(...withData.map((l) => boundsFromUrbanLayer(l)!.east));
      const north = Math.max(...withData.map((l) => boundsFromUrbanLayer(l)!.north));
      const map = mapRef.current;
      const center = map.getCenter();
      const inExtent =
        center.lng >= west && center.lng <= east && center.lat >= south && center.lat <= north;
      if (!inExtent) {
        map.fitBounds([[west, south], [east, north]], { padding: 48, duration: 800, maxZoom: 13 });
        viewportKeyRef.current = '';
      }
    });
    fetchFabricTypes().then(setFabricTypes).catch(console.error);
  }, []);

  function addDrawGeometry(geometry: GeoJSON.Geometry) {
    const draw = drawRef.current;
    if (!draw) return;
    draw.add({
      type: 'Feature',
      properties: {},
      geometry,
    } as GeoJSON.Feature);
    setStatusMsg('شکل به بوم رسم اضافه شد — می‌توانید ذخیره کنید');
  }

  function activateNativeMode(tool: DrawTool) {
    const draw = drawRef.current;
    if (!draw) return;
    shapeStartRef.current = null;
    setShapePending(false);
    if (tool === 'point') draw.changeMode('draw_point');
    else if (tool === 'line') draw.changeMode('draw_line_string');
    else if (tool === 'polygon') draw.changeMode('draw_polygon');
    else draw.changeMode('simple_select');
  }

  function currentPrintLegend() {
    return buildMapLegendItems({
      neighborhoodsOn: visibility.neighborhoods,
      fabricsOn: visibility.fabrics,
      dwellingsOn: visibility.dwellings,
      urbanOn: visibility.urban,
      fabricTypes: fabricTypes.map((t) => ({ id: t.id, name: t.name, colorHex: t.colorHex })),
      selectedFabricTypeIds: fabricTypeFilter,
      urbanLayers: urbanLayers.map((l) => ({
        id: l.id,
        name: l.name,
        colorHex: l.color_hex,
        isActive: l.is_active,
        visible: urbanLayerVisibility[l.id] !== false,
      })),
    });
  }

  async function openPrintLayout(format: PrintFormat) {
    const map = mapRef.current;
    if (!map) return;
    setPrintFormat(format);
    try {
      const mapCanvas = await captureMapCanvas(map);
      const b = map.getBounds();
      setPrintPreview({
        mapCanvas,
        legend: currentPrintLegend(),
        latitude: map.getCenter().lat,
        zoom: map.getZoom(),
        bounds: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
      });
      setPrintLayoutOpen(true);
    } catch {
      feedback.error('پیش‌نمایش نقشه گرفته نشد', 'خروجی نقشه');
    }
  }

  async function confirmPrintLayout(settings: MapPrintLayoutSettings, logoFile: File | null) {
    const map = mapRef.current;
    if (!map) return;
    setPrintLayoutOpen(false);
    setExporting(printFormat);
    try {
      let logo: HTMLImageElement | null = null;
      if (logoFile && settings.showLogo) {
        logo = await new Promise<HTMLImageElement>((resolve, reject) => {
          const url = URL.createObjectURL(logoFile);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('لوگو خوانده نشد'));
          };
          img.src = url;
        });
      }
      const b = map.getBounds();
      const legend = currentPrintLegend();
      await exportMapWithLayout(map, settings, {
        legend,
        latitude: map.getCenter().lat,
        zoom: map.getZoom(),
        bounds: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
        logo,
        dateLabel: new Date().toLocaleString('fa-IR'),
      }, printFormat);
      feedback.success(
        printFormat === 'pdf' ? 'فایل PDF با چیدمان نقشه ذخیره شد' : 'تصویر PNG با چیدمان نقشه ذخیره شد',
        'خروجی نقشه',
      );
    } catch {
      feedback.error('خروجی نقشه ناموفق بود', 'خروجی نقشه');
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPng() {
    openPrintLayout('png');
  }

  async function handleExportPdf() {
    openPrintLayout('pdf');
  }

  async function handleToggleUrbanActive(layer: UrbanLayer) {
    if (layer.is_active) {
      const ok = await feedback.confirm(
        `لایه «${layer.name}» غیرفعال شود؟ از نقشه کنار می‌رود ولی داده‌ها حذف نمی‌شوند.`,
        'غیرفعال‌سازی لایه',
        { confirmLabel: 'غیرفعال شود', cancelLabel: 'انصراف' },
      );
      if (!ok) return;
    }
    const res = await updateUrbanLayer(layer.id, { isActive: !layer.is_active });
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'خطا', 'لایه شهری');
      return;
    }
    feedback.success(layer.is_active ? 'لایه غیرفعال شد' : 'لایه فعال شد');
    const nextActive = !layer.is_active;
    setUrbanLayers((prev) =>
      prev.map((l) => (l.id === layer.id ? { ...l, is_active: nextActive } : l)),
    );
    // Viewport reload is handled by urbanActiveKey effect — avoid duplicate loadData().
  }

  // Map init — once only (do not remount on tool toggles)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // MapLibre ↔ mapbox-gl-draw bridge
    (window as unknown as { mapboxgl?: typeof maplibregl }).mapboxgl = maplibregl;

    try {
      const rtlStatus = maplibregl.getRTLTextPluginStatus();
      if (rtlStatus === 'unavailable') {
        const rtlUrl = `${window.location.origin}/vendor/mapbox-gl-rtl-text.js`;
        void maplibregl.setRTLTextPlugin(rtlUrl, true).catch(() => {
          /* map still works; Persian labels may not shape until plugin loads */
        });
      }
    } catch {
      /* plugin already registered */
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: buildInitialStyle(),
      center: GIS_DEFAULT_CENTER,
      zoom: GIS_DEFAULT_ZOOM,
      preserveDrawingBuffer: true,
    });
    map.on('error', (e) => {
      const message = String((e as { error?: { message?: string } }).error?.message ?? '');
      if (/rtl text plugin/i.test(message)) return;
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.FullscreenControl(), 'top-left');

    if (canEdit) {
      drawRef.current = attachDrawControl(map);
    }

    map.on('load', () => {
      map.addSource('gis-polygons', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        tolerance: 0.375,
        buffer: 64,
      });
      map.addSource('gis-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('gis-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        tolerance: 0.375,
      });
      map.addSource('gis-draw-preview', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'gis-polygons-fill',
        type: 'fill',
        source: 'gis-polygons',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'layer'], 'neighborhoods'], '#1a5276',
            ['==', ['get', 'layer'], 'fabrics'], ['coalesce', ['get', 'colorHex'], '#d4a017'],
            ['==', ['get', 'layer'], 'urban'], ['coalesce', ['get', 'colorHex'], '#2e86ab'],
            '#888',
          ],
          'fill-opacity': [
            'case',
            ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'selected'], 'true']], 0.55,
            ['==', ['get', 'layer'], 'neighborhoods'], 0.15,
            ['==', ['get', 'layer'], 'fabrics'], ['coalesce', ['get', 'fillOpacity'], 0.35],
            ['==', ['get', 'layer'], 'urban'], ['coalesce', ['get', 'fillOpacity'], 0.25],
            ['<=', ['to-number', ['coalesce', ['get', 'fillOpacity'], 1]], 0], 0,
            0.3,
          ],
        },
      });
      map.addLayer({
        id: 'gis-polygons-line',
        type: 'line',
        source: 'gis-polygons',
        paint: {
          'line-color': [
            'case',
            ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'selected'], 'true']], '#e11d48',
            ['==', ['get', 'layer'], 'neighborhoods'], '#154360',
            ['==', ['get', 'layer'], 'fabrics'], ['coalesce', ['get', 'strokeHex'], ['get', 'colorHex'], '#b7950b'],
            ['==', ['get', 'layer'], 'urban'], ['coalesce', ['get', 'strokeHex'], ['get', 'colorHex'], '#1b4f72'],
            '#333',
          ],
          'line-width': [
            'case',
            ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'selected'], 'true']], 2.5,
            ['<=', ['to-number', ['coalesce', ['get', 'fillOpacity'], 1]], 0], 2,
            0,
          ],
          'line-opacity': [
            'case',
            ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'selected'], 'true']], 0.9,
            ['<=', ['to-number', ['coalesce', ['get', 'fillOpacity'], 1]], 0], 0.85,
            0,
          ],
        },
      });
      map.addLayer({
        id: 'gis-lines-line',
        type: 'line',
        source: 'gis-lines',
        paint: {
          'line-color': '#175cd3',
          'line-width': 2.5,
        },
      });
      map.addLayer({
        id: 'gis-points-circle',
        type: 'circle',
        source: 'gis-points',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            11, 4,
            14, 7,
            17, 9,
          ],
          'circle-color': '#c0392b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
      map.addLayer({
        id: 'gis-draw-preview-halo',
        type: 'line',
        source: 'gis-draw-preview',
        paint: {
          'line-color': '#111',
          'line-width': 6,
          'line-opacity': 0.5,
        },
      });
      map.addLayer({
        id: 'gis-draw-preview-fill',
        type: 'fill',
        source: 'gis-draw-preview',
        paint: { 'fill-color': DRAW_PREVIEW, 'fill-opacity': 0.22 },
      });
      map.addLayer({
        id: 'gis-draw-preview-line',
        type: 'line',
        source: 'gis-draw-preview',
        paint: {
          'line-color': DRAW_PREVIEW,
          'line-width': 3,
          'line-dasharray': [2, 1],
        },
      });

      raiseDrawLayers(map);
      void loadDataRef.current();
    });

    const scheduleViewportReload = () => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      viewportTimerRef.current = setTimeout(() => {
        void loadViewportLayersRef.current();
      }, VIEWPORT_DEBOUNCE_MS);
    };
    map.on('moveend', scheduleViewportReload);

    map.on('click', (e) => {
      if (addDwellingRef.current) {
        void (async () => {
          const title = await feedbackRef.current.prompt('عنوان ملک را وارد کنید', {
            title: 'ثبت ملک روی نقشه',
            defaultValue: '',
          });
          if (title === null) return;
          await createDwelling({
            geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
            title: title || undefined,
          });
          feedbackRef.current.success('ملک با موفقیت ثبت شد');
          void loadDataRef.current();
        })();
        return;
      }

      const drawingShape =
        drawEnabledRef.current &&
        drawToolRef.current !== 'select' &&
        ['rectangle', 'square', 'circle', 'polygon', 'line', 'point'].includes(drawToolRef.current);

      if (drawingShape) {
        const tool = drawToolRef.current;
        if (tool !== 'rectangle' && tool !== 'square' && tool !== 'circle') return;

        const point: LngLat = [e.lngLat.lng, e.lngLat.lat];
        const start = shapeStartRef.current;
        if (!start) {
          shapeStartRef.current = point;
          setShapePending(true);
          setStatusMsg(toolHint(tool, true));
          return;
        }

        let geometry: GeoJSON.Geometry;
        if (tool === 'rectangle') geometry = rectanglePolygon(start, point);
        else if (tool === 'square') geometry = squarePolygon(start, point);
        else geometry = circlePolygon(start, point);

        addDrawGeometry(geometry);
        clearPreview(map);
        shapeStartRef.current = null;
        setShapePending(false);
        setStatusMsg(toolHint(tool, false));
        return;
      }

      // Select existing GIS features (works even if draw control layers sit on top)
      const hits = map.queryRenderedFeatures(e.point, {
        layers: ['gis-polygons-fill', 'gis-points-circle', 'gis-lines-line'].filter((id) => Boolean(map.getLayer(id))),
      });
      const hit = hits[0];
      if (!hit?.properties?.id) {
        setSelectedFeature(null);
        if (geoJsonRef.current) updateMapSources(geoJsonRef.current);
        return;
      }

      void (async () => {
        const raw = hit.properties as Record<string, unknown>;
        const featureType = String(raw.featureType || '') as GisFeatureType;
        const id = String(raw.id);
        const props: MapFeatureProperties = {
          ...raw,
          featureType,
          id,
          layer: String(raw.layer ?? ''),
        };
        try {
          const detailRes = await fetchFeatureDetail(featureType, id);
          setSelectedFeature({
            properties: props,
            detail: detailRes.data ?? null,
            lngLat: [e.lngLat.lng, e.lngLat.lat],
          });
        } catch {
          setSelectedFeature({
            properties: props,
            detail: null,
            lngLat: [e.lngLat.lng, e.lngLat.lat],
          });
        }
        if (geoJsonRef.current) updateMapSources(geoJsonRef.current);
      })();
    });

    map.on('mousemove', (e) => {
      const drawingToolActive =
        drawEnabledRef.current &&
        drawToolRef.current !== 'select' &&
        drawToolRef.current !== 'coords';
      const hoverLayers = GIS_HOVER_LAYER_IDS.filter((id) => Boolean(map.getLayer(id)));
      const overFeature = hoverLayers.length
        ? map.queryRenderedFeatures(e.point, { layers: [...hoverLayers] }).length > 0
        : false;
      map.getCanvas().style.cursor = mapHoverCursor({ drawingToolActive, overFeature });

      if (!drawEnabledRef.current) return;
      const tool = drawToolRef.current;
      const start = shapeStartRef.current;
      if (!start || (tool !== 'rectangle' && tool !== 'square' && tool !== 'circle')) return;
      const point: LngLat = [e.lngLat.lng, e.lngLat.lat];
      let geometry: GeoJSON.Geometry;
      if (tool === 'rectangle') geometry = rectanglePolygon(start, point);
      else if (tool === 'square') geometry = squarePolygon(start, point);
      else geometry = circlePolygon(start, point);
      const src = map.getSource('gis-draw-preview') as maplibregl.GeoJSONSource | undefined;
      src?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry }],
      });
    });

    map.on('mouseout', () => {
      const drawingToolActive =
        drawEnabledRef.current &&
        drawToolRef.current !== 'select' &&
        drawToolRef.current !== 'coords';
      map.getCanvas().style.cursor = mapHoverCursor({ drawingToolActive, overFeature: false });
    });

    mapRef.current = map;

    return () => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      viewportAbortRef.current?.abort();
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !canEdit || drawRef.current) return;
    drawRef.current = attachDrawControl(map);
    raiseDrawLayers(map);
  }, [canEdit]);

  // Viewport layers: base + urban/dwellings (bbox/simplify) when filters or visibility change
  useEffect(() => {
    if (!mapRef.current) return;
    void loadViewportLayers({ force: true });
  }, [
    fabricTypeFilter,
    visibility.neighborhoods,
    visibility.fabrics,
    visibility.urban,
    visibility.dwellings,
    urbanLayerVisibility,
    urbanActiveKey,
    loadViewportLayers,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    for (const b of BASEMAPS) {
      const id = basemapLayerId(b.id);
      if (!map.getLayer(id)) continue;
      map.setLayoutProperty(id, 'visibility', basemaps[b.id] ? 'visible' : 'none');
    }
  }, [basemaps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = mapHoverCursor({
      drawingToolActive: drawEnabled && drawTool !== 'select' && drawTool !== 'coords',
      overFeature: false,
    });
    if (drawEnabled) {
      raiseDrawLayers(map);
    }
    if (!drawEnabled) {
      drawRef.current?.changeMode('simple_select');
      shapeStartRef.current = null;
      setShapePending(false);
      clearPreview(map);
    }
  }, [drawEnabled, drawTool]);

  function handleToolSelect(tool: DrawTool) {
    setDrawEnabled(true);
    setAddDwellingMode(false);
    if (tool === 'coords') {
      setShowCoords(true);
      setDrawTool('coords');
      return;
    }
    setDrawTool(tool);
    setStatusMsg(toolHint(tool, false));
    if (tool === 'point' || tool === 'line' || tool === 'polygon' || tool === 'select') {
      activateNativeMode(tool);
    } else {
      drawRef.current?.changeMode('simple_select');
      shapeStartRef.current = null;
      setShapePending(false);
    }
  }

  async function handleDrawSave() {
    const draw = drawRef.current;
    if (!draw) return;
    const data = draw.getAll();
    const feature = data.features[data.features.length - 1];
    if (!feature?.geometry) {
      await feedback.alert('ابتدا یک شکل روی نقشه بکشید یا مختصات وارد کنید', 'ذخیره شکل');
      return;
    }

    const geomType = feature.geometry.type;
    const attach = attachRef.current;

    if (attach) {
      if (attach.kind === 'dwelling') {
        if (geomType !== 'Point') {
          await feedback.alert('برای ملک باید نقطه انتخاب شود', 'تعیین موقعیت');
          return;
        }
        const res = await updateDwellingLocation(attach.id, feature.geometry as object);
        if (!res.success) {
          await feedback.alert(res.error?.message ?? 'خطا', 'تعیین موقعیت');
          return;
        }
        feedback.success(`موقعیت «${attach.name}» ذخیره شد`);
      } else {
        if (geomType === 'Point' || geomType === 'LineString' || geomType === 'MultiLineString') {
          await feedback.alert('برای محدوده، چندضلعی / مستطیل / دایره بکشید', 'تعیین محدوده');
          return;
        }
        const res = attach.kind === 'neighborhood'
          ? await updateNeighborhoodGeometry(attach.id, feature.geometry as object)
          : await updateFabricGeometry(attach.id, feature.geometry as object);
        if (!res.success) {
          await feedback.alert(res.error?.message ?? 'خطا', 'تعیین محدوده');
          return;
        }
        feedback.success(`محدوده «${attach.name}» ذخیره شد`);
      }
      draw.deleteAll();
      if (attach.next) {
        const next = attach.next;
        setAttachTarget(next);
        const q = new URLSearchParams({ attach: next.kind, id: next.id, name: next.name });
        router.replace(`/dashboard/map?${q.toString()}`);
        const tool: DrawTool = next.kind === 'dwelling' ? 'point' : 'polygon';
        setDrawTool(tool);
        setStatusMsg(
          next.kind === 'dwelling'
            ? `حالا یک نقطه برای «${next.name}» بزنید`
            : `حالا محدوده «${next.name}» را بکشید`,
        );
        setTimeout(() => {
          draw.changeMode(tool === 'point' ? 'draw_point' : 'draw_polygon');
        }, 250);
        loadData();
        return;
      }
      setAttachTarget(null);
      setStatusMsg('محدوده ذخیره شد');
      router.replace('/dashboard/map');
      loadData();
      return;
    }

    if (geomType === 'Point') {
      const title = await feedback.prompt('عنوان ملک/نقطه', {
        title: 'ذخیره نقطه',
        defaultValue: 'نقطه جدید',
      });
      if (title === null) return;
      await createDwelling({
        geometry: feature.geometry as object,
        title: title || 'نقطه جدید',
      });
      feedback.success('نقطه ذخیره شد');
    } else {
      const fabricTypeId = fabricTypes[0]?.id;
      if (!fabricTypeId) {
        await feedback.alert('ابتدا نوع بافت تعریف کنید', 'ذخیره محدوده');
        return;
      }
      if (geomType === 'LineString' || geomType === 'MultiLineString') {
        await feedback.alert(
          'برای ذخیره خط، از چندضلعی/مستطیل/دایره استفاده کنید یا خط را فقط برای اندازه‌گیری بکشید.',
          'نوع هندسه',
        );
        return;
      }
      const name = await feedback.prompt('نام محدوده/بافت', {
        title: 'ذخیره محدوده',
        defaultValue: 'محدوده جدید',
      });
      if (name === null) return;
      await createFabric({
        fabricTypeId,
        geometry: feature.geometry as object,
        name: name || 'محدوده جدید',
      });
      feedback.success('محدوده ذخیره شد');
    }

    draw.deleteAll();
    setStatusMsg('ذخیره شد');
    void loadDataRef.current();
  }

  async function handleViewContained(id: string) {
    const res = await fetchNeighborhoodContained(id);
    await feedback.alert(
      `بافت‌ها: ${formatNumber(res.data?.fabrics?.length ?? 0)} | املاک: ${formatNumber(res.data?.dwellings?.length ?? 0)}`,
      'محتوای محله',
    );
  }

  async function handleDeleteSelected() {
    if (!selectedFeature) return;
    const { featureType, id, name, title } = selectedFeature.properties;
    const label = name || title || id;
    const ok = await feedback.confirm(
      `عارضه «${label}» از نقشه و پایگاه داده حذف شود؟`,
      'حذف عارضه',
    );
    if (!ok) return;
    setDeletingFeature(true);
    try {
      const res = await deleteMapFeature(featureType, id);
      if (!res.success) {
        await feedback.alert(res.error?.message ?? 'حذف ناموفق بود', 'حذف عارضه');
        return;
      }
      feedback.success('عارضه حذف شد');
      setSelectedFeature(null);
      await loadData();
    } finally {
      setDeletingFeature(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedFeature) {
        setSelectedFeature(null);
        if (geoJsonRef.current) updateMapSources(geoJsonRef.current);
        return;
      }
      if (drawEnabled) {
        setDrawEnabled(false);
        setStatusMsg('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFeature, drawEnabled, updateMapSources]);

  useEffect(() => {
    if (geoJsonRef.current) updateMapSources(geoJsonRef.current);
  }, [visibility, urbanLayerVisibility, selectedFeature?.properties?.id, updateMapSources]);

  function handleSearch() {
    const map = mapRef.current;
    const fc = geoJsonRef.current;
    if (!map || !fc || !searchQuery.trim()) return;
    const q = normalizeDigitsForSearch(searchQuery.trim());
    const match = fc.features.find((f) => {
      const hay = normalizeDigitsForSearch(featureSearchHaystack(f.properties ?? {}));
      return hay.includes(q);
    });
    if (!match?.geometry) {
      void feedback.alert('موردی با این نام یا کد یافت نشد', 'جستجو');
      return;
    }
    if (match.geometry.type === 'Point') {
      const coords = match.geometry.coordinates as [number, number];
      map.flyTo({ center: coords, zoom: 16 });
    } else {
      map.fitBounds(getGeometryBounds(match.geometry), { padding: 40 });
    }
  }

  return (
    <div className={`gis-workspace ${caseId ? 'gis-workspace--case-open' : ''}`}>
      <LoadingOverlay
        open={exporting != null}
        label={exporting === 'pdf' ? 'در حال ساخت PDF نقشه…' : 'در حال آماده‌سازی تصویر PNG…'}
        hint="لایه‌ها و محدوده دید فعلی در حال رندر شدن است"
      />
      <LayerControlPanel
        visibility={visibility}
        onChange={setVisibility}
        basemaps={basemaps}
        onBasemapChange={setBasemaps}
        fabricTypes={fabricTypes}
        selectedFabricTypeIds={fabricTypeFilter}
        onFabricTypeFilter={setFabricTypeFilter}
        urbanLayers={urbanLayers}
        urbanLayerVisibility={urbanLayerVisibility}
        onUrbanLayerVisibility={(id, on) => {
          setUrbanLayerVisibility((prev) => ({ ...prev, [id]: on }));
        }}
        onFitUrbanLayer={fitUrbanLayer}
        onSetAllUrbanLayerVisibility={(on) => {
          setUrbanLayerVisibility((prev) => {
            const next = { ...prev };
            for (const ul of urbanLayers) next[ul.id] = on;
            return next;
          });
        }}
        onToggleUrbanLayerActive={canEdit ? (layer) => void handleToggleUrbanActive(layer) : undefined}
        onUrbanStyleSaved={(updated) => {
          setUrbanLayers((prev) => {
            const next = prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));
            urbanLayersRef.current = next;
            return next;
          });
          const fc = geoJsonRef.current;
          if (!fc?.features) return;
          const next = {
            ...fc,
            features: applyLayerStyleToFeatures(fc.features, { layerId: updated.id }, {
              colorHex: updated.color_hex,
              strokeHex: updated.stroke_hex ?? updated.color_hex,
              fillOpacity: Number(updated.fill_opacity ?? 0.25),
              category: updated.category,
              layerName: updated.name,
            }),
          };
          geoJsonRef.current = next;
          updateMapSources(next);
        }}
        onFabricTypeStyleSaved={(updated) => {
          setFabricTypes((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
          const fc = geoJsonRef.current;
          if (!fc?.features) return;
          const next = {
            ...fc,
            features: applyLayerStyleToFeatures(fc.features, { fabricTypeId: updated.id }, {
              colorHex: updated.colorHex,
              fillOpacity: Number(updated.fillOpacity ?? 0.35),
              fabricTypeName: updated.name,
            }),
          };
          geoJsonRef.current = next;
          updateMapSources(next);
        }}
        onUploadClick={() => setShowUpload(true)}
        onExportPng={() => void handleExportPng()}
        onExportPdf={() => void handleExportPdf()}
        exporting={exporting}
        drawEnabled={drawEnabled}
        onDrawEnabledChange={(v) => {
          setDrawEnabled(v);
          if (v) {
            setAddDwellingMode(false);
            setDrawTool('polygon');
            setStatusMsg(toolHint('polygon', false));
            setTimeout(() => activateNativeMode('polygon'), 0);
          } else {
            setStatusMsg('');
          }
        }}
        addDwellingMode={addDwellingMode}
        onAddDwellingModeChange={(v) => {
          setAddDwellingMode(v);
          if (v) setDrawEnabled(false);
        }}
        layersLoading={layersLoading}
        canEdit={canEdit}
      />

      <div className="gis-map-area">
        {attachTarget && (
          <div className="gis-attach-banner">
            <div>
              <strong>
                {attachTarget.kind === 'dwelling' ? 'تعیین موقعیت' : 'تعیین محدوده'}:
                {' '}
                {attachTarget.name}
              </strong>
              <span className="muted">
                {attachTarget.kind === 'dwelling'
                  ? 'نقطه را روی نقشه بزنید و ذخیره کنید'
                  : 'چندضلعی/مستطیل/دایره بکشید و ذخیره کنید'}
                {attachTarget.next ? ` — سپس محدوده «${attachTarget.next.name}»` : ''}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setAttachTarget(null);
                router.replace('/dashboard/map');
              }}
            >
              انصراف
            </button>
          </div>
        )}

        <div ref={mapContainer} className="gis-map-container" />

        <div className="gis-map-overlays gis-map-overlays--top">
          <div className="gis-search-bar">
            <input
              type="search"
              placeholder="جستجوی نام، کد، لایه یا کاربری…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              aria-label="جستجو در عوارض نقشه"
            />
            <button type="button" className="btn btn-sm btn-primary" onClick={handleSearch}>
              جستجو
            </button>
          </div>

          <div className="gis-map-hud" aria-live="polite">
            <span className="gis-map-hud-item">
              {layersLoading ? (
                <span className="gis-map-hud-loading">
                  <LoadingSpinner size="sm" />
                  <span>در حال بارگذاری…</span>
                </span>
              ) : (
                `${formatNumber(visibleCount)} عارضه`
              )}
            </span>
            {statusMsg ? <span className="gis-map-hud-msg">{statusMsg}</span> : null}
          </div>
        </div>

        {canEdit && drawEnabled ? (
          <div className="gis-map-overlays gis-map-overlays--bottom">
            <DrawToolbar
              active={drawTool}
              enabled={drawEnabled}
              hint={statusMsg || toolHint(drawTool, shapePending)}
              onSelect={handleToolSelect}
              onTrash={() => {
                drawRef.current?.deleteAll();
                shapeStartRef.current = null;
                setShapePending(false);
                if (mapRef.current) clearPreview(mapRef.current);
                setStatusMsg('اشکال رسم‌شده پاک شد');
              }}
              onSave={handleDrawSave}
            />
          </div>
        ) : null}

        {selectedFeature ? (
          <div className="gis-popup-anchor gis-popup-anchor--dock-bl">
            <FeaturePopup
              properties={selectedFeature.properties}
              detail={selectedFeature.detail}
              canEdit={canEdit}
              onClose={() => {
                setSelectedFeature(null);
                if (geoJsonRef.current) updateMapSources(geoJsonRef.current);
              }}
              onViewContained={handleViewContained}
              onDelete={canEdit ? () => void handleDeleteSelected() : undefined}
              deleting={deletingFeature}
              onOpenCase={casePresentation === 'drawer' ? openCaseDrawer : undefined}
              fabricTypes={fabricTypes}
              urbanLayers={urbanLayers}
              onStyleSaved={(updated) => {
                if (!updated || updated.kind === 'reload') {
                  void loadData();
                  return;
                }
                if (updated.kind === 'urban') {
                  setUrbanLayers((prev) => {
                    const next = prev.map((l) => (l.id === updated.layer.id ? { ...l, ...updated.layer } : l));
                    urbanLayersRef.current = next;
                    return next;
                  });
                  const fc = geoJsonRef.current;
                  if (!fc?.features) return;
                  const next = {
                    ...fc,
                    features: applyLayerStyleToFeatures(fc.features, { layerId: updated.layer.id }, {
                      colorHex: updated.layer.color_hex,
                      strokeHex: updated.layer.stroke_hex ?? updated.layer.color_hex,
                      fillOpacity: Number(updated.layer.fill_opacity ?? 0.25),
                      category: updated.layer.category,
                      layerName: updated.layer.name,
                    }),
                  };
                  geoJsonRef.current = next;
                  updateMapSources(next);
                  return;
                }
                setFabricTypes((prev) => prev.map((t) => (t.id === updated.fabricType.id ? { ...t, ...updated.fabricType } : t)));
                const fc = geoJsonRef.current;
                if (!fc?.features) return;
                const next = {
                  ...fc,
                  features: applyLayerStyleToFeatures(fc.features, { fabricTypeId: updated.fabricType.id }, {
                    colorHex: updated.fabricType.colorHex,
                    fillOpacity: Number(updated.fabricType.fillOpacity ?? 0.35),
                  }),
                };
                geoJsonRef.current = next;
                updateMapSources(next);
              }}
            />
          </div>
        ) : null}
      </div>

      {caseId && mapCaseWide && (
        <aside className="gis-case-panel" aria-label="پرونده خانوار">
          <HouseholdDetailPanel
            householdId={caseId}
            variant="split"
            urlSync="map"
            dwellingId={dwellingIdParam ?? undefined}
            initialTab={caseTab}
            onClose={closeCasePanel}
            onDeleted={closeCasePanel}
          />
        </aside>
      )}

      {caseId && !mapCaseWide && (
        <Drawer open onClose={closeCasePanel} width="min(100vw, 480px)">
          <HouseholdDetailPanel
            householdId={caseId}
            variant="drawer"
            urlSync="map"
            dwellingId={dwellingIdParam ?? undefined}
            initialTab={caseTab}
            onClose={closeCasePanel}
            onDeleted={closeCasePanel}
          />
        </Drawer>
      )}

      {showUpload && canEdit && (
        <SpatialFileUpload
          fabricTypes={fabricTypes}
          urbanLayers={urbanLayers}
          onSuccess={() => {
            void refreshUrbanLayers();
            viewportKeyRef.current = '';
            void loadViewportLayers({ force: true });
          }}
          onClose={() => setShowUpload(false)}
        />
      )}

      {showCoords && (
        <CoordinateInputModal
          onApply={(geometry) => {
            setDrawEnabled(true);
            addDrawGeometry(geometry);
            setDrawTool('select');
            activateNativeMode('select');
          }}
          onClose={() => {
            setShowCoords(false);
            setDrawTool('select');
          }}
        />
      )}

      {printLayoutOpen && (
        <MapPrintLayoutModal
          format={printFormat}
          producerDefault={producerDefault}
          previewSource={printPreview}
          onConfirm={(settings, logoFile) => void confirmPrintLayout(settings, logoFile)}
          onClose={() => {
            setPrintLayoutOpen(false);
            setPrintPreview(null);
          }}
        />
      )}
    </div>
  );
}

function clearPreview(map: maplibregl.Map) {
  const src = map.getSource('gis-draw-preview') as maplibregl.GeoJSONSource | undefined;
  src?.setData({ type: 'FeatureCollection', features: [] });
}

/** Keep MapboxDraw layers above data layers so clicks reach the drawing tools */
function raiseDrawLayers(map: maplibregl.Map) {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.id.startsWith('gl-draw') || layer.id.startsWith('gis-draw-preview')) {
      try {
        map.moveLayer(layer.id);
      } catch {
        /* layer may be transient */
      }
    }
  }
}
