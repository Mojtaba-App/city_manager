'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { GisFeatureType, URBAN_LAYER_CATEGORY_LABELS, UrbanLayerCategory, layerColorPatch, featureMapLabel, gisAttributeRows } from '@city-manager/shared';
import { FabricType, MapFeatureProperties, UrbanLayer, updateFabric, updateFabricType, updateUrbanLayer } from '@/lib/gis-api';
import { LayerStyleAccordion, LayerStyleControls } from './LayerStyleControls';
import { formatMetric, formatNumber, toPersianDigits } from '@/lib/format';
import { fetchHouseholdByDwelling } from '@/lib/regeneration-api';
import { useEffect, useState } from 'react';
import { useFeedback } from '@/components/ui/Feedback';

const TYPE_LABELS: Record<string, string> = {
  neighborhood: 'محله هدف',
  fabric: 'بافت',
  dwelling: 'ملک / منزل',
  layer_feature: 'عارضه لایه شهری',
};

export function FeaturePopup({
  properties,
  detail,
  onClose,
  onViewContained,
  onDelete,
  deleting,
  onOpenCase,
  fabricTypes,
  urbanLayers,
  onStyleSaved,
  canEdit = true,
}: {
  properties: MapFeatureProperties;
  detail?: Record<string, unknown> | null;
  onClose: () => void;
  onViewContained?: (id: string) => void;
  onDelete?: () => void;
  deleting?: boolean;
  onOpenCase?: (householdId: string) => void;
  fabricTypes?: FabricType[];
  urbanLayers?: UrbanLayer[];
  canEdit?: boolean;
  onStyleSaved?: (event: { kind: 'urban'; layer: UrbanLayer } | { kind: 'fabricType'; fabricType: FabricType } | { kind: 'reload' }) => void;
}) {
  const typeLabel = TYPE_LABELS[String(properties.featureType)] ?? String(properties.featureType);
  const title =
    featureMapLabel({
      ...(properties as Record<string, unknown>),
      name: properties.name ?? detail?.name,
      title: properties.title ?? detail?.title,
      code: properties.code ?? detail?.code,
      attributes: (properties as Record<string, unknown>).attributes ?? detail?.attributes,
    }) || '—';

  const category = properties.category ?? detail?.category;
  const categoryLabel =
    category != null
      ? URBAN_LAYER_CATEGORY_LABELS[category as UrbanLayerCategory] ?? String(category)
      : null;

  const area = properties.areaSqm ?? detail?.area_sqm ?? detail?.areaSqm;
  const population = properties.population ?? detail?.population;
  const householdCount = properties.householdCount ?? detail?.household_count ?? detail?.householdCount;
  const avgIncome = properties.avgIncome ?? detail?.avg_income ?? detail?.avgIncome;
  const literacyRate = properties.literacyRate ?? detail?.literacy_rate ?? detail?.literacyRate;

  const attrRows = gisAttributeRows({
    ...((properties as Record<string, unknown>).attributes &&
    typeof (properties as Record<string, unknown>).attributes === 'object' &&
    !Array.isArray((properties as Record<string, unknown>).attributes)
      ? ((properties as Record<string, unknown>).attributes as Record<string, unknown>)
      : {}),
    ...(detail?.attributes && typeof detail.attributes === 'object' && !Array.isArray(detail.attributes)
      ? (detail.attributes as Record<string, unknown>)
      : {}),
  });

  const [householdHref, setHouseholdHref] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const feedback = useFeedback();

  const urbanLayer = urbanLayers?.find(
    (l) => l.id === String(properties.layerId ?? detail?.layer_id ?? ''),
  );
  const fabricTypeId = String(properties.fabricTypeId ?? detail?.fabric_type_id ?? '');
  const fabricType = fabricTypes?.find((t) => t.id === fabricTypeId);

  useEffect(() => {
    if (String(properties.featureType) !== GisFeatureType.DWELLING) {
      setHouseholdHref(null);
      setHouseholdId(null);
      return;
    }
    let cancelled = false;
    void fetchHouseholdByDwelling(properties.id).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      const hh = res.data as Record<string, unknown>;
      const id = String(hh.id ?? (hh.household as Record<string, unknown> | undefined)?.id ?? '');
      if (id) {
        setHouseholdId(id);
        setHouseholdHref(`/dashboard/households/${id}`);
      }
    });
    return () => { cancelled = true; };
  }, [properties.featureType, properties.id]);

  return (
    <div className="gis-popup">
      <div className="gis-popup-header">
        <span className="gis-popup-type">{typeLabel}</span>
        <button type="button" className="gis-popup-close" onClick={onClose} aria-label="بستن">
          ×
        </button>
      </div>
      <h3 className="gis-popup-title">{title}</h3>

      <dl className="gis-popup-grid">
        {(properties.code || detail?.code) != null && String(properties.code ?? detail?.code) !== '' && (
          <>
            <dt>کد</dt>
            <dd>{toPersianDigits(String(properties.code ?? detail?.code))}</dd>
          </>
        )}
        {(properties.status || detail?.status) != null && String(properties.status ?? detail?.status) !== '' && (
          <>
            <dt>وضعیت</dt>
            <dd>{String(properties.status ?? detail?.status)}</dd>
          </>
        )}
        {(properties.fabricTypeName || detail?.fabric_type_name) != null && (
          <>
            <dt>نوع بافت</dt>
            <dd>{String(properties.fabricTypeName ?? detail?.fabric_type_name)}</dd>
          </>
        )}
        {(properties.layerName || detail?.layer_name) != null && (
          <>
            <dt>لایه شهری</dt>
            <dd>{String(properties.layerName ?? detail?.layer_name)}</dd>
          </>
        )}
        {categoryLabel && (
          <>
            <dt>دسته</dt>
            <dd>{categoryLabel}</dd>
          </>
        )}
        {area != null && area !== '' && (
          <>
            <dt>مساحت</dt>
            <dd className="gis-popup-metric" dir="ltr">{formatNumber(Number(area))} m²</dd>
          </>
        )}
        {population != null && population !== '' && (
          <>
            <dt>جمعیت</dt>
            <dd className="gis-popup-metric" dir="ltr">{formatNumber(Number(population))}</dd>
          </>
        )}
        {householdCount != null && householdCount !== '' && (
          <>
            <dt>تعداد خانوار</dt>
            <dd className="gis-popup-metric" dir="ltr">{formatNumber(Number(householdCount))}</dd>
          </>
        )}
        {avgIncome != null && avgIncome !== '' && (
          <>
            <dt>میانگین درآمد</dt>
            <dd className="gis-popup-metric" dir="ltr">{formatMetric(Math.round(Number(avgIncome)), 'ریال')}</dd>
          </>
        )}
        {literacyRate != null && literacyRate !== '' && (
          <>
            <dt>سطح سواد</dt>
            <dd className="gis-popup-metric" dir="ltr">{formatNumber(Number(literacyRate))}٪</dd>
          </>
        )}
        {(properties.fullAddress || detail?.full_address) != null && (
          <>
            <dt>آدرس</dt>
            <dd>{String(properties.fullAddress ?? detail?.full_address)}</dd>
          </>
        )}
        {(properties.buildingType || detail?.building_type) != null && (
          <>
            <dt>نوع ساختمان</dt>
            <dd>{String(properties.buildingType ?? detail?.building_type)}</dd>
          </>
        )}
        {detail?.neighborhood_name != null && (
          <>
            <dt>محله</dt>
            <dd>{String(detail.neighborhood_name)}</dd>
          </>
        )}
        {detail?.stats != null && (
          <>
            <dt>تعداد بافت</dt>
            <dd>{formatNumber(Number((detail.stats as Record<string, unknown>).fabric_count ?? 0))}</dd>
            <dt>تعداد ملک</dt>
            <dd>{formatNumber(Number((detail.stats as Record<string, unknown>).dwelling_count ?? 0))}</dd>
          </>
        )}
        {attrRows.map((row) => (
          <Fragment key={row.key}>
            <dt>{row.label}</dt>
            <dd className={row.key.toLowerCase() === 'description' ? 'gis-popup-desc' : undefined}>
              {/^\d+(\.\d+)?$/.test(row.value) ? toPersianDigits(row.value) : row.value}
            </dd>
          </Fragment>
        ))}
      </dl>

      {String(properties.featureType) === GisFeatureType.LAYER_FEATURE && urbanLayer && (
        <div className="gis-popup-style">
          <LayerStyleAccordion color={urbanLayer.color_hex} opacity={Number(urbanLayer.fill_opacity ?? 0.25)} noFill={Number(urbanLayer.fill_opacity ?? 0.25) <= 0}>
          <LayerStyleControls
            color={urbanLayer.color_hex}
            opacity={Number(urbanLayer.fill_opacity ?? 0.25)}
            category={urbanLayer.category}
            showCategory
            disabled={!canEdit}
            onColor={(hex) => {
              const colors = layerColorPatch(hex);
              void updateUrbanLayer(urbanLayer.id, colors).then((res) => {
                if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'ظاهر لایه');
                else {
                  const row = res.data as UrbanLayer & { colorHex?: string; strokeHex?: string };
                  onStyleSaved?.({
                    kind: 'urban',
                    layer: {
                      ...urbanLayer,
                      ...row,
                      color_hex: row.color_hex ?? row.colorHex ?? colors.colorHex,
                      stroke_hex: row.stroke_hex ?? row.strokeHex ?? colors.strokeHex,
                    },
                  });
                }
              });
            }}
            onOpacity={(v) => {
              void updateUrbanLayer(urbanLayer.id, { fillOpacity: v }).then((res) => {
                if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'ظاهر لایه');
                else {
                  const row = res.data as UrbanLayer & { fillOpacity?: number };
                  onStyleSaved?.({
                    kind: 'urban',
                    layer: { ...urbanLayer, ...row, fill_opacity: Number(row.fill_opacity ?? row.fillOpacity ?? v) },
                  });
                }
              });
            }}
            onCategory={(c) => {
              void updateUrbanLayer(urbanLayer.id, { category: c }).then((res) => {
                if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'ظاهر لایه');
                else {
                  const row = res.data as UrbanLayer;
                  onStyleSaved?.({ kind: 'urban', layer: { ...urbanLayer, ...row, category: row.category ?? c } });
                }
              });
            }}
          />
          </LayerStyleAccordion>
        </div>
      )}

      {String(properties.featureType) === GisFeatureType.FABRIC && fabricTypes && fabricTypes.length > 0 && (
        <div className="gis-popup-style">
          <h4>نوع و ظاهر بافت</h4>
          <label className="layer-style-field">
            <span>نوع بافت</span>
            <select
              value={fabricTypeId}
              onChange={(e) => {
                void updateFabric(properties.id, { fabricTypeId: e.target.value }).then((res) => {
                  if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'نوع بافت');
                  else onStyleSaved?.({ kind: 'reload' });
                });
              }}
            >
              {fabricTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          {fabricType && (
            <LayerStyleAccordion color={fabricType.colorHex} opacity={Number(fabricType.fillOpacity ?? 0.35)} noFill={Number(fabricType.fillOpacity ?? 0.35) <= 0}>
            <LayerStyleControls
              color={fabricType.colorHex}
              opacity={Number(fabricType.fillOpacity ?? 0.35)}
              disabled={!canEdit}
              onColor={(hex) => {
                void updateFabricType(fabricType.id, { colorHex: hex }).then((res) => {
                  if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'ظاهر بافت');
                  else onStyleSaved?.({ kind: 'fabricType', fabricType: { ...fabricType, ...(res.data as FabricType), colorHex: hex } });
                });
              }}
              onOpacity={(v) => {
                void updateFabricType(fabricType.id, { fillOpacity: v }).then((res) => {
                  if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'ظاهر بافت');
                  else onStyleSaved?.({ kind: 'fabricType', fabricType: { ...fabricType, ...(res.data as FabricType), fillOpacity: v } });
                });
              }}
            />
            </LayerStyleAccordion>
          )}
        </div>
      )}

      <div className="gis-popup-actions">
        {householdId && onOpenCase && (
          <button type="button" className="btn btn-primary" onClick={() => onOpenCase(householdId)}>
            پرونده در کنار نقشه
          </button>
        )}
        {householdHref && (
          <Link href={householdHref} className={onOpenCase ? 'btn btn-sm' : 'btn btn-primary'}>
            {onOpenCase ? 'صفحه پرونده' : 'پرونده خانوار'}
          </Link>
        )}
        {String(properties.featureType) === GisFeatureType.NEIGHBORHOOD && onViewContained && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onViewContained(properties.id)}
          >
            داده‌های وابسته
          </button>
        )}
        {onDelete && (
          <button type="button" className="btn gis-popup-delete" disabled={deleting} onClick={onDelete}>
            {deleting ? 'در حال حذف…' : 'حذف عارضه'}
          </button>
        )}
      </div>
    </div>
  );
}
