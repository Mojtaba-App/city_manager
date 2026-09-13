'use client';

import { useMemo, useState } from 'react';
import { FabricType, LayerVisibility, UrbanLayer, updateFabricType, updateUrbanLayer } from '@/lib/gis-api';
import {
  URBAN_LAYER_CATEGORY_GROUPS,
  URBAN_LAYER_CATEGORY_LABELS,
  UrbanLayerCategory,
  boundsFromUrbanLayer,
  clampOpacity,
  layerColorPatch,
  normalizeHexColor,
  toggleExclusiveFilter,
  urbanLayerCategoryLabel,
  urbanLayerHealth,
  urbanLayerHealthMessage,
} from '@city-manager/shared';
import { BASEMAPS, BasemapId, BasemapVisibility } from './basemaps';
import { NavIcon } from '@/components/NavIcons';
import { LayerStyleAccordion, LayerStyleControls } from './LayerStyleControls';
import { GisPanelSection } from './GisPanelSection';
import { useFeedback } from '@/components/ui/Feedback';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export type { LayerVisibility };

function fabricFilterLabel(selected: string[], total: number): string {
  if (total === 0) return '—';
  if (selected.length === 0) return 'همه';
  return `${selected.length.toLocaleString('fa-IR')} از ${total.toLocaleString('fa-IR')}`;
}

function countVisibleUrbanLayers(
  urbanLayers: UrbanLayer[],
  urbanLayerVisibility: Record<string, boolean>,
  masterOn: boolean,
): number {
  if (!masterOn) return 0;
  return urbanLayers.filter((l) => l.is_active && urbanLayerVisibility[l.id] !== false).length;
}

export function LayerControlPanel({
  visibility,
  onChange,
  basemaps,
  onBasemapChange,
  fabricTypes,
  selectedFabricTypeIds,
  onFabricTypeFilter,
  urbanLayers,
  urbanLayerVisibility,
  onUrbanLayerVisibility,
  onFitUrbanLayer,
  onSetAllUrbanLayerVisibility,
  onToggleUrbanLayerActive,
  onUrbanStyleSaved,
  onFabricTypeStyleSaved,
  onUploadClick,
  onExportPng,
  onExportPdf,
  exporting,
  drawEnabled,
  onDrawEnabledChange,
  addDwellingMode,
  onAddDwellingModeChange,
  layersLoading,
  canEdit = true,
}: {
  visibility: LayerVisibility;
  onChange: (v: LayerVisibility) => void;
  basemaps: BasemapVisibility;
  onBasemapChange: (v: BasemapVisibility) => void;
  fabricTypes: FabricType[];
  selectedFabricTypeIds: string[];
  onFabricTypeFilter: (ids: string[]) => void;
  urbanLayers: UrbanLayer[];
  urbanLayerVisibility: Record<string, boolean>;
  onUrbanLayerVisibility: (id: string, on: boolean) => void;
  onFitUrbanLayer?: (layer: UrbanLayer) => void;
  onSetAllUrbanLayerVisibility?: (on: boolean) => void;
  onToggleUrbanLayerActive?: (layer: UrbanLayer) => void;
  onUrbanStyleSaved?: (layer: UrbanLayer) => void;
  onFabricTypeStyleSaved?: (ft: FabricType) => void;
  onUploadClick: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  exporting?: 'png' | 'pdf' | null;
  drawEnabled: boolean;
  onDrawEnabledChange: (v: boolean) => void;
  addDwellingMode: boolean;
  onAddDwellingModeChange: (v: boolean) => void;
  layersLoading?: boolean;
  canEdit?: boolean;
}) {
  const feedback = useFeedback();
  const [urbanSearch, setUrbanSearch] = useState('');

  async function saveUrbanStyle(
    layer: UrbanLayer,
    patch: {
      colorHex?: string;
      fillOpacity?: number;
      category?: UrbanLayerCategory;
      name?: string;
    },
  ) {
    const colorPatch = patch.colorHex ? layerColorPatch(patch.colorHex) : null;
    const body = {
      ...patch,
      ...(colorPatch ?? {}),
      ...(patch.fillOpacity != null ? { fillOpacity: clampOpacity(patch.fillOpacity) } : {}),
    };
    const optimistic: UrbanLayer = {
      ...layer,
      ...(colorPatch
        ? { color_hex: colorPatch.colorHex, stroke_hex: colorPatch.strokeHex }
        : {}),
      ...(patch.fillOpacity != null ? { fill_opacity: clampOpacity(patch.fillOpacity) } : {}),
      ...(patch.category ? { category: patch.category } : {}),
      ...(patch.name ? { name: patch.name } : {}),
    };
    onUrbanStyleSaved?.(optimistic);

    const res = await updateUrbanLayer(layer.id, body);
    if (!res.success) {
      onUrbanStyleSaved?.(layer);
      await feedback.alert(res.error?.message ?? 'ذخیره ظاهر لایه ناموفق بود', 'لایه شهری');
      return;
    }
    const row = (res.data ?? {}) as UrbanLayer & {
      colorHex?: string;
      fillOpacity?: number;
      strokeHex?: string;
      color_hex?: string;
      fill_opacity?: number;
      stroke_hex?: string;
      stroke_width?: number;
    };
    onUrbanStyleSaved?.({
      ...layer,
      ...row,
      color_hex: row.color_hex ?? row.colorHex ?? body.colorHex ?? layer.color_hex,
      stroke_hex: row.stroke_hex ?? row.strokeHex ?? body.strokeHex ?? layer.stroke_hex,
      fill_opacity: Number(row.fill_opacity ?? row.fillOpacity ?? body.fillOpacity ?? layer.fill_opacity),
      category: row.category ?? body.category ?? layer.category,
      name: (row.name as string | undefined) ?? body.name ?? layer.name,
    });
  }

  async function saveFabricTypeStyle(ft: FabricType, patch: { colorHex?: string; fillOpacity?: number; name?: string }) {
    const body = {
      ...patch,
      ...(patch.colorHex ? { colorHex: normalizeHexColor(patch.colorHex) } : {}),
      ...(patch.fillOpacity != null ? { fillOpacity: clampOpacity(patch.fillOpacity) } : {}),
    };
    const res = await updateFabricType(ft.id, body);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ذخیره ظاهر نوع بافت ناموفق بود', 'نوع بافت');
      return;
    }
    onFabricTypeStyleSaved?.({ ...ft, ...body, ...(res.data as FabricType | undefined) });
  }

  function toggleBasemap(id: BasemapId, on: boolean) {
    const next = { ...basemaps, [id]: on };
    if (!Object.values(next).some(Boolean)) {
      next.osm = true;
    }
    onBasemapChange(next);
  }

  const dataLayerKeys = ['neighborhoods', 'fabrics', 'dwellings', 'urban'] as const;
  const dataLayersOnCount = dataLayerKeys.filter((k) => visibility[k]).length;
  const allDataLayersOn = dataLayersOnCount === dataLayerKeys.length;
  const noDataLayersOn = dataLayersOnCount === 0;
  const fabricTypeIds = useMemo(() => fabricTypes.map((ft) => ft.id), [fabricTypes]);
  const basemapOnCount = Object.values(basemaps).filter(Boolean).length;

  const urbanSearchNorm = urbanSearch.trim().toLowerCase();
  const filteredUrbanLayers = useMemo(() => {
    if (!urbanSearchNorm) return urbanLayers;
    return urbanLayers.filter((ul) => {
      const hay = [ul.name, ul.code, URBAN_LAYER_CATEGORY_LABELS[ul.category], ul.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(urbanSearchNorm);
    });
  }, [urbanLayers, urbanSearchNorm]);

  const groupedUrbanLayers = useMemo(() => {
    const buckets = new Map<string, UrbanLayer[]>();
    for (const group of URBAN_LAYER_CATEGORY_GROUPS) {
      buckets.set(group.id, []);
    }
    buckets.set('other', []);
    for (const ul of filteredUrbanLayers) {
      const group = URBAN_LAYER_CATEGORY_GROUPS.find((g) => g.categories.includes(ul.category));
      const key = group?.id ?? 'other';
      buckets.get(key)!.push(ul);
    }
    const grouped: Array<{ group: { id: string; label: string }; layers: UrbanLayer[] }> =
      URBAN_LAYER_CATEGORY_GROUPS.map((g) => ({
        group: g,
        layers: buckets.get(g.id) ?? [],
      })).filter((entry) => entry.layers.length > 0);
    const other = buckets.get('other') ?? [];
    if (other.length) {
      grouped.push({ group: { id: 'other', label: 'سایر' }, layers: other });
    }
    return grouped;
  }, [filteredUrbanLayers]);

  const visibleUrbanCount = countVisibleUrbanLayers(urbanLayers, urbanLayerVisibility, visibility.urban);
  const activeUrbanCount = urbanLayers.filter((l) => l.is_active).length;

  function setAllDataLayers(on: boolean) {
    onChange({
      neighborhoods: on,
      fabrics: on,
      dwellings: on,
      urban: on,
    });
    if (onSetAllUrbanLayerVisibility) {
      onSetAllUrbanLayerVisibility(on);
    } else {
      for (const ul of urbanLayers) {
        onUrbanLayerVisibility(ul.id, on);
      }
    }
  }

  function setAllUrbanLayers(on: boolean) {
    onChange({ ...visibility, urban: on });
    if (onSetAllUrbanLayerVisibility) {
      onSetAllUrbanLayerVisibility(on);
    } else {
      for (const ul of urbanLayers) {
        onUrbanLayerVisibility(ul.id, on);
      }
    }
  }

  function hideAllUrbanLayers() {
    onChange({ ...visibility, urban: true });
    if (onSetAllUrbanLayerVisibility) {
      onSetAllUrbanLayerVisibility(false);
    } else {
      for (const ul of urbanLayers) {
        onUrbanLayerVisibility(ul.id, false);
      }
    }
  }

  return (
    <aside className="gis-panel" aria-label="کنترل لایه‌های نقشه">
      <GisPanelSection title="نقشه پایه" badge={basemapOnCount} summary="چند نقشه پایه را می‌توانید هم‌زمان روشن کنید." defaultOpen>
        {BASEMAPS.map((b) => (
          <label key={b.id} className="gis-check" title={b.description}>
            <input type="checkbox" checked={basemaps[b.id]} onChange={(e) => toggleBasemap(b.id, e.target.checked)} />
            <span>{b.label}</span>
          </label>
        ))}
      </GisPanelSection>

      <GisPanelSection
        title="لایه‌های عملیاتی"
        badge={`${dataLayersOnCount}/${dataLayerKeys.length}`}
        summary="داده‌های اصلی سامانه: محلات، بافت‌ها، املاک."
        defaultOpen
      >
        <div className="gis-layers-master">
          <label className="gis-check gis-check-master" title="روشن یا خاموش کردن هم‌زمان همه لایه‌های عملیاتی">
            <input
              type="checkbox"
              checked={allDataLayersOn}
              ref={(el) => {
                if (el) el.indeterminate = !allDataLayersOn && !noDataLayersOn;
              }}
              onChange={(e) => setAllDataLayers(e.target.checked)}
            />
            <span>همه لایه‌ها</span>
          </label>
          <div className="gis-layers-master-actions" role="group" aria-label="کنترل همه لایه‌ها">
            <button type="button" className="btn btn-sm" disabled={allDataLayersOn} onClick={() => setAllDataLayers(true)}>
              فعال همه
            </button>
            <button type="button" className="btn btn-sm" disabled={noDataLayersOn} onClick={() => setAllDataLayers(false)}>
              غیرفعال همه
            </button>
          </div>
        </div>

        <div className="gis-layer-list">
          <label className="gis-check gis-layer-item">
            <input
              type="checkbox"
              checked={visibility.neighborhoods}
              onChange={(e) => onChange({ ...visibility, neighborhoods: e.target.checked })}
            />
            <span className="gis-layer-item-label">محلات هدف</span>
          </label>
          <label className="gis-check gis-layer-item">
            <input
              type="checkbox"
              checked={visibility.fabrics}
              onChange={(e) => onChange({ ...visibility, fabrics: e.target.checked })}
            />
            <span className="gis-layer-item-label">بافت‌ها</span>
          </label>
          <label className="gis-check gis-layer-item">
            <input
              type="checkbox"
              checked={visibility.dwellings}
              onChange={(e) => onChange({ ...visibility, dwellings: e.target.checked })}
            />
            <span className="gis-layer-item-label">املاک / منازل</span>
          </label>
        </div>
      </GisPanelSection>

      <GisPanelSection
        title="لایه‌های اطلاعاتی شهری"
        badge={`${visibleUrbanCount}/${activeUrbanCount}`}
        summary="لایه‌های KML/GeoJSON — فقط لایه‌های فعال در محدوده دید بارگذاری می‌شوند."
        defaultOpen
      >
        {layersLoading ? (
          <p className="gis-panel-loading muted">
            <LoadingSpinner size="sm" />
            {' '}در حال بارگذاری عوارض…
          </p>
        ) : null}
        <div className="gis-urban-master">
          <label className="gis-check gis-check-master">
            <input type="checkbox" checked={visibility.urban} onChange={(e) => setAllUrbanLayers(e.target.checked)} />
            <span>نمایش لایه‌های شهری</span>
          </label>
          {urbanLayers.length > 0 ? (
            <div className="gis-layers-master-actions">
              <button type="button" className="btn btn-sm" disabled={!visibility.urban} onClick={() => setAllUrbanLayers(true)}>
                همه
              </button>
              <button type="button" className="btn btn-sm" disabled={!visibility.urban} onClick={hideAllUrbanLayers}>
                هیچ‌کدام
              </button>
            </div>
          ) : null}
        </div>

        {urbanLayers.length === 0 ? (
          <p className="gis-panel-hint">لایه‌ای ثبت نشده — از صفحه «لایه‌ها» بسازید و فایل KML/GeoJSON را import کنید.</p>
        ) : (
          <>
            {urbanLayers.length > 6 ? (
              <input
                type="search"
                className="gis-urban-search"
                placeholder="جستجو در لایه‌های شهری…"
                value={urbanSearch}
                onChange={(e) => setUrbanSearch(e.target.value)}
                aria-label="جستجو در لایه‌های شهری"
              />
            ) : null}

            {filteredUrbanLayers.length === 0 ? (
              <p className="gis-panel-hint">لایه‌ای با این عبارت یافت نشد.</p>
            ) : (
              <div className="gis-urban-groups">
                {groupedUrbanLayers.map(({ group, layers }) => (
                  <div key={group.id} className="gis-urban-group">
                    <h4 className="gis-urban-group-title">{group.label}</h4>
                    <div className="gis-urban-filters">
                      {layers.map((ul) => {
                        const health = urbanLayerHealth(ul);
                        const healthMsg = urbanLayerHealthMessage(health);
                        const layerHidden = urbanLayerVisibility[ul.id] === false;
                        return (
                        <div key={ul.id} className={`gis-urban-item${ul.is_active ? '' : ' inactive'}`}>
                          <div className="gis-urban-item-head">
                            <label className="gis-check">
                              <input
                                type="checkbox"
                                checked={Boolean(visibility.urban && urbanLayerVisibility[ul.id] !== false)}
                                disabled={!ul.is_active}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  if (on && !visibility.urban) {
                                    onChange({ ...visibility, urban: true });
                                  }
                                  onUrbanLayerVisibility(ul.id, on);
                                }}
                              />
                              <span className="gis-color-swatch" style={{ background: ul.color_hex }} />
                              <span className="gis-urban-item-name">
                                {ul.name}
                                {!ul.is_active ? ' (غیرفعال)' : ''}
                              </span>
                            </label>
                            <div className="gis-urban-item-actions">
                              {typeof ul.feature_count === 'number' ? (
                                <span className="gis-urban-count" title="تعداد عوارض">
                                  {ul.feature_count.toLocaleString('fa-IR')}
                                </span>
                              ) : null}
                              {onToggleUrbanLayerActive ? (
                                <button
                                  type="button"
                                  className="btn btn-sm gis-urban-toggle"
                                  title={ul.is_active ? 'غیرفعال‌سازی در سامانه' : 'فعال‌سازی در سامانه'}
                                  aria-label={ul.is_active ? `غیرفعال کردن ${ul.name}` : `فعال کردن ${ul.name}`}
                                  onClick={() => onToggleUrbanLayerActive(ul)}
                                >
                                  {ul.is_active ? 'غیرفعال' : 'فعال'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <span className="gis-urban-cat">{urbanLayerCategoryLabel(ul.category)}</span>
                          {healthMsg ? (
                            <p className={`gis-layer-health gis-layer-health--${health}`}>{healthMsg}</p>
                          ) : null}
                          {layerHidden && health === 'ok' && (ul.feature_count ?? 0) > 0 ? (
                            <p className="gis-layer-health gis-layer-health--hint">این لایه در پنل خاموش است — تیک را بزنید.</p>
                          ) : null}
                          {onFitUrbanLayer && boundsFromUrbanLayer(ul) && (ul.feature_count ?? 0) > 0 ? (
                            <button
                              type="button"
                              className="btn btn-sm gis-urban-fit"
                              onClick={() => onFitUrbanLayer(ul)}
                            >
                              نمایش محدوده لایه
                            </button>
                          ) : null}
                          <LayerStyleAccordion color={ul.color_hex} opacity={Number(ul.fill_opacity ?? 0.25)} noFill={Number(ul.fill_opacity ?? 0.25) <= 0}>
                            <LayerStyleControls
                              color={ul.color_hex}
                              opacity={Number(ul.fill_opacity ?? 0.25)}
                              category={ul.category}
                              showCategory
                              disabled={!canEdit}
                              onColor={(hex) => void saveUrbanStyle(ul, { colorHex: hex })}
                              onOpacity={(v) => void saveUrbanStyle(ul, { fillOpacity: v })}
                              onCategory={(c) => void saveUrbanStyle(ul, { category: c })}
                            />
                          </LayerStyleAccordion>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </GisPanelSection>

      <GisPanelSection
        title="فیلتر نوع بافت"
        badge={fabricFilterLabel(selectedFabricTypeIds, fabricTypes.length)}
        summary="خالی = همه انواع. با برداشتن تیک، فقط بافت‌های انتخاب‌شده نمایش داده می‌شوند."
        defaultOpen={fabricTypes.length <= 8}
      >
        {fabricTypes.length === 0 ? (
          <p className="gis-panel-hint">نوع بافتی تعریف نشده است.</p>
        ) : (
          <>
            <div className="gis-layers-master-actions gis-fabric-master-actions">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onFabricTypeFilter([])}
                disabled={selectedFabricTypeIds.length === 0}
              >
                همه انواع
              </button>
            </div>
            <div className="gis-fabric-filters">
              {fabricTypes.map((ft) => (
                <div key={ft.id} className="gis-fabric-style-row">
                  <label className="gis-check">
                    <input
                      type="checkbox"
                      checked={selectedFabricTypeIds.length === 0 || selectedFabricTypeIds.includes(ft.id)}
                      onChange={(e) => {
                        onFabricTypeFilter(
                          toggleExclusiveFilter(fabricTypeIds, selectedFabricTypeIds, ft.id, e.target.checked),
                        );
                      }}
                    />
                    <span className="gis-color-swatch" style={{ background: ft.colorHex }} />
                    {ft.name}
                  </label>
                  <LayerStyleAccordion color={ft.colorHex} opacity={Number(ft.fillOpacity ?? 0.35)} noFill={Number(ft.fillOpacity ?? 0.35) <= 0}>
                    <LayerStyleControls
                      color={ft.colorHex}
                      opacity={Number(ft.fillOpacity ?? 0.35)}
                      disabled={!canEdit}
                      onColor={(hex) => void saveFabricTypeStyle(ft, { colorHex: hex })}
                      onOpacity={(v) => void saveFabricTypeStyle(ft, { fillOpacity: v })}
                    />
                  </LayerStyleAccordion>
                </div>
              ))}
            </div>
          </>
        )}
      </GisPanelSection>

      <GisPanelSection
        title="خروجی محدوده"
        summary="چیدمان چاپ (عنوان، شمال‌نما، مقیاس، راهنما) را قبل از ذخیره تنظیم کنید."
        defaultOpen={false}
      >
        <div className="gis-export-actions" role="group" aria-label="خروجی نقشه">
          <button type="button" className="btn gis-export-btn" disabled={Boolean(exporting)} onClick={onExportPng}>
            <NavIcon name="upload" size={14} />
            {exporting === 'png' ? 'در حال PNG…' : 'PNG'}
          </button>
          <button type="button" className="btn gis-export-btn" disabled={Boolean(exporting)} onClick={onExportPdf}>
            <NavIcon name="reports" size={14} />
            {exporting === 'pdf' ? 'در حال PDF…' : 'PDF'}
          </button>
        </div>
      </GisPanelSection>

      <GisPanelSection title="ابزارها" defaultOpen={canEdit}>
        {canEdit ? (
          <div className="gis-tools-stack">
            <button type="button" className="btn btn-sm gis-tool-btn gis-tool-btn--compact" onClick={onUploadClick}>
              <NavIcon name="upload" size={14} />
              Import
            </button>

            <div className="gis-tool-card">
              <div className="gis-tool-card-head">
                <span className="gis-tool-card-title">ابزار رسم</span>
                <button
                  type="button"
                  className={`gis-draw-enable ${drawEnabled ? 'active' : ''}`}
                  aria-pressed={drawEnabled}
                  title={drawEnabled ? 'خاموش کردن ابزارهای رسم' : 'روشن کردن ابزارهای رسم'}
                  onClick={() => onDrawEnabledChange(!drawEnabled)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M4 20l4.5-1.2L20 7.3 16.7 4 5.2 15.5z" />
                    <path d="M14.8 5.9l3.3 3.3" />
                  </svg>
                  <span>{drawEnabled ? 'روشن' : 'خاموش'}</span>
                </button>
              </div>
              <p className="gis-panel-hint">
                {drawEnabled
                  ? 'ابزارها از نوار بالای نقشه در دسترس‌اند؛ Escape برای خاموش کردن.'
                  : 'برای رسم بافت یا محدوده، ابزار رسم را روشن کنید.'}
              </p>
            </div>

            <label className="gis-check gis-tool-option">
              <input
                type="checkbox"
                checked={addDwellingMode}
                onChange={(e) => onAddDwellingModeChange(e.target.checked)}
              />
              <span>ثبت سریع ملک با کلیک روی نقشه</span>
            </label>
          </div>
        ) : (
          <p className="gis-panel-hint">این نشست فقط‌خواندنی است؛ رسم و آپلود غیرفعال است.</p>
        )}
      </GisPanelSection>
    </aside>
  );
}
