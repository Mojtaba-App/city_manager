'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/admin/AdminUi';
import { LayerStyleAccordion, LayerStyleControls } from '@/components/gis/LayerStyleControls';
import {
  FabricType,
  updateFabric,
  updateFabricType,
  updateNeighborhood,
} from '@/lib/gis-api';
import { formatNumber, toPersianDigits } from '@/lib/format';
import {
  addUniqueId,
  fabricTypesForNeighborhood,
  filterNeighborhoodsByKind,
  MUNICIPAL_DISTRICTS,
  NEIGHBORHOOD_KIND_LABELS,
  NeighborhoodKind,
  neighborhoodKind,
  neighborhoodParentUrbanId,
  NEIGHBORHOOD_STATUS_LABELS,
  NeighborhoodStatus,
  neighborhoodFabricTypeIds,
  neighborhoodProfileStats,
  nextRowSortDir,
  removeId,
  resolveDisplayedHouseholdCount,
  resolveDisplayedOptionalMetric,
  resolveDisplayedPopulation,
  RowSortDir,
  sortByRowNumber,
  validateNeighborhoodCreate,
  withStableRowNumbers,
} from '@city-manager/shared';
import { useFeedback } from '@/components/ui/Feedback';

export type NeighborhoodRow = {
  id: string;
  name: string;
  code?: string;
  status?: string;
  has_geometry?: boolean;
  municipal_district?: number;
  population?: number;
  area_sqm?: number;
  household_count?: number;
  avg_income?: number;
  literacy_rate?: number;
  case_household_count?: number;
  metadata?: Record<string, unknown>;
  fabric_type_ids?: string[];
};

export type FabricCatalogRow = {
  id: string;
  name?: string;
  code?: string;
  neighborhood_id?: string;
  fabric_type_id?: string;
  fabric_type_name?: string;
  has_geometry?: boolean;
};

export type DwellingCatalogRow = {
  id: string;
  title?: string;
  dwelling_code?: string;
  full_address?: string;
  has_geometry?: boolean;
};

function mapAttachHref(kind: 'neighborhood' | 'fabric' | 'dwelling', id: string, name: string) {
  const q = new URLSearchParams({ attach: kind, id, name });
  return `/dashboard/map?${q.toString()}`;
}

function useNumberedRows<T>(items: T[]) {
  const [dir, setDir] = useState<RowSortDir>('asc');
  const rows = useMemo(
    () => sortByRowNumber(withStableRowNumbers(items), dir),
    [items, dir],
  );
  return {
    dir,
    rows,
    toggle: () => setDir((current) => nextRowSortDir(current)),
  };
}

function CatalogHead({
  title,
  count,
  dir,
  onToggle,
}: {
  title: string;
  count: number;
  dir: RowSortDir;
  onToggle: () => void;
}) {
  return (
    <div className="layer-catalog-head">
      <h3>
        {title}
        {count > 0 ? ` (${formatNumber(count)})` : ''}
      </h3>
      {count > 1 && (
        <button
          type="button"
          className="btn btn-sm layer-sort-btn"
          onClick={onToggle}
          aria-label="مرتب‌سازی بر اساس شماره ردیف"
        >
          شماره ردیف {dir === 'asc' ? 'صعودی' : 'نزولی'}
        </button>
      )}
    </div>
  );
}

function RowNo({ n }: { n: number }) {
  return (
    <span className="layer-row-no" aria-label={`ردیف ${toPersianDigits(n)}`}>
      {toPersianDigits(n)}
    </span>
  );
}

export function GisLayerCatalog({
  fabricTypes,
  neighborhoods,
  fabrics,
  dwellings,
  canWriteNbhd,
  canWriteFabric,
  canWriteDwelling,
  onChanged,
}: {
  fabricTypes: FabricType[];
  neighborhoods: NeighborhoodRow[];
  fabrics: FabricCatalogRow[];
  dwellings: DwellingCatalogRow[];
  canWriteNbhd: boolean;
  canWriteFabric: boolean;
  canWriteDwelling: boolean;
  onChanged: () => void;
}) {
  const feedback = useFeedback();
  const types = useNumberedRows(fabricTypes);
  const nbs = useNumberedRows(neighborhoods);
  const urbanNeighborhoods = useMemo(
    () => filterNeighborhoodsByKind(neighborhoods, NeighborhoodKind.URBAN),
    [neighborhoods],
  );
  const targetNeighborhoods = useMemo(
    () => filterNeighborhoodsByKind(neighborhoods, NeighborhoodKind.REGENERATION_TARGET),
    [neighborhoods],
  );
  const fbs = useNumberedRows(fabrics);
  const dws = useNumberedRows(dwellings);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingTypeFor, setAddingTypeFor] = useState<Record<string, string>>({});

  const maxPop = Math.max(0, ...neighborhoods.map((n) => resolveDisplayedPopulation(n.population, 0)));
  const maxArea = Math.max(0, ...neighborhoods.map((n) => Number(n.area_sqm) || 0));

  return (
    <div className="layers-grid-4">
      <section className="card">
        <CatalogHead title="انواع بافت" count={fabricTypes.length} dir={types.dir} onToggle={types.toggle} />
        {fabricTypes.length === 0 ? (
          <EmptyState title="نوع بافتی ثبت نشده" />
        ) : (
          <ul className="layer-list">
            {types.rows.map((t) => (
              <li key={t.id} className="layer-list-edit">
                <RowNo n={t.rowNo} />
                <span className="swatch" style={{ background: t.colorHex }} />
                <div>
                  <strong>{t.name}</strong>
                  <small>{t.code}</small>
                  {canWriteFabric && (
                    <LayerStyleAccordion color={t.colorHex} opacity={Number(t.fillOpacity ?? 0.35)} noFill={Number(t.fillOpacity ?? 0.35) <= 0}>
                      <LayerStyleControls
                        color={t.colorHex}
                        opacity={Number(t.fillOpacity ?? 0.35)}
                        onColor={(hex) => {
                          void updateFabricType(t.id, { colorHex: hex }).then((res) => {
                            if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'نوع بافت');
                            else onChanged();
                          });
                        }}
                        onOpacity={(v) => {
                          void updateFabricType(t.id, { fillOpacity: v }).then((res) => {
                            if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'نوع بافت');
                            else onChanged();
                          });
                        }}
                      />
                    </LayerStyleAccordion>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <CatalogHead title="محلات شهری" count={urbanNeighborhoods.length} dir={nbs.dir} onToggle={nbs.toggle} />
        {urbanNeighborhoods.length === 0 ? (
          <EmptyState title="محله شهری ثبت نشده" />
        ) : (
          <ul className="layer-list layer-nb-list">
            {urbanNeighborhoods.map((n, index) => (
              <NeighborhoodCatalogItem
                key={n.id}
                neighborhood={{ ...n, rowNo: index + 1 }}
                allNeighborhoods={neighborhoods}
                fabricTypes={fabricTypes}
                canWrite={canWriteNbhd}
                editing={editingId === n.id}
                addTypeId={addingTypeFor[n.id] ?? ''}
                maxPop={maxPop}
                maxArea={maxArea}
                onToggleEdit={() => setEditingId(editingId === n.id ? null : n.id)}
                onAddTypeId={(id) => setAddingTypeFor((prev) => ({ ...prev, [n.id]: id }))}
                onChanged={onChanged}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <CatalogHead title="محلات هدف بازآفرینی" count={targetNeighborhoods.length} dir={nbs.dir} onToggle={nbs.toggle} />
        {targetNeighborhoods.length === 0 ? (
          <EmptyState title="محله هدف ثبت نشده" />
        ) : (
          <ul className="layer-list layer-nb-list">
            {targetNeighborhoods.map((n, index) => (
              <NeighborhoodCatalogItem
                key={n.id}
                neighborhood={{ ...n, rowNo: index + 1 }}
                allNeighborhoods={neighborhoods}
                fabricTypes={fabricTypes}
                canWrite={canWriteNbhd}
                editing={editingId === n.id}
                addTypeId={addingTypeFor[n.id] ?? ''}
                maxPop={maxPop}
                maxArea={maxArea}
                onToggleEdit={() => setEditingId(editingId === n.id ? null : n.id)}
                onAddTypeId={(id) => setAddingTypeFor((prev) => ({ ...prev, [n.id]: id }))}
                onChanged={onChanged}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <CatalogHead title="بافت‌ها" count={fabrics.length} dir={fbs.dir} onToggle={fbs.toggle} />
        {fabrics.length === 0 ? (
          <EmptyState title="بافتی ثبت نشده" />
        ) : (
          <ul className="layer-list">
            {fbs.rows.map((f) => {
              const nbh = neighborhoods.find((n) => n.id === f.neighborhood_id);
              const typeOptions = fabricTypesForNeighborhood(nbh, fabricTypes, fabrics, f.neighborhood_id ?? '');
              return (
              <li key={f.id} className="layer-list-edit">
                <RowNo n={f.rowNo} />
                <div>
                  <strong>{f.name || 'بدون نام'}</strong>
                  <small>
                    {nbh?.name ? `${nbh.name} · ` : ''}
                    {f.fabric_type_name || f.code || f.id.slice(0, 8)}
                    {' · '}
                    {f.has_geometry ? 'دارای محدوده' : 'بدون محدوده'}
                  </small>
                  {canWriteFabric && fabricTypes.length > 0 && (
                    <label className="layer-style-field">
                      <span>نوع بافت</span>
                      <select
                        value={f.fabric_type_id ?? ''}
                        onChange={(e) => {
                          void updateFabric(f.id, { fabricTypeId: e.target.value }).then((res) => {
                            if (!res.success) void feedback.alert(res.error?.message ?? 'خطا', 'نوع بافت');
                            else onChanged();
                          });
                        }}
                      >
                        {typeOptions.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {!f.has_geometry && canWriteFabric && (
                  <Link className="link-muted" href={mapAttachHref('fabric', f.id, f.name || 'بافت')}>
                    تعیین روی نقشه
                  </Link>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <CatalogHead title="املاک / منازل" count={dwellings.length} dir={dws.dir} onToggle={dws.toggle} />
        {dwellings.length === 0 ? (
          <EmptyState title="ملکی ثبت نشده" />
        ) : (
          <ul className="layer-list">
            {dws.rows.map((d) => (
              <li key={d.id}>
                <RowNo n={d.rowNo} />
                <div>
                  <strong>{d.title || 'بدون عنوان'}</strong>
                  <small>
                    {d.dwelling_code || d.full_address || d.id.slice(0, 8)}
                    {' · '}
                    {d.has_geometry ? 'دارای موقعیت' : 'بدون موقعیت'}
                  </small>
                </div>
                {!d.has_geometry && canWriteDwelling && (
                  <Link className="link-muted" href={mapAttachHref('dwelling', d.id, d.title || 'ملک')}>
                    تعیین روی نقشه
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NeighborhoodCatalogItem({
  neighborhood: n,
  allNeighborhoods,
  fabricTypes,
  canWrite,
  editing,
  addTypeId,
  maxPop,
  maxArea,
  onToggleEdit,
  onAddTypeId,
  onChanged,
}: {
  neighborhood: NeighborhoodRow & { rowNo: number };
  allNeighborhoods: NeighborhoodRow[];
  fabricTypes: FabricType[];
  canWrite: boolean;
  editing: boolean;
  addTypeId: string;
  maxPop: number;
  maxArea: number;
  onToggleEdit: () => void;
  onAddTypeId: (id: string) => void;
  onChanged: () => void;
}) {
  const feedback = useFeedback();
  const kind = neighborhoodKind(n);
  const parentId = neighborhoodParentUrbanId(n);
  const parentName = parentId ? allNeighborhoods.find((item) => item.id === parentId)?.name : null;
  const [name, setName] = useState(n.name);
  const [status, setStatus] = useState(n.status ?? NeighborhoodStatus.PLANNED);
  const [district, setDistrict] = useState(n.municipal_district ? String(n.municipal_district) : '');
  const [population, setPopulation] = useState(n.population != null ? String(n.population) : '');
  const [householdCount, setHouseholdCount] = useState(n.household_count != null ? String(n.household_count) : '');
  const [avgIncome, setAvgIncome] = useState(n.avg_income != null ? String(n.avg_income) : '');
  const [literacyRate, setLiteracyRate] = useState(n.literacy_rate != null ? String(n.literacy_rate) : '');
  const [area, setArea] = useState(n.area_sqm != null ? String(n.area_sqm) : '');

  useEffect(() => {
    setName(n.name);
    setStatus(n.status ?? NeighborhoodStatus.PLANNED);
    setDistrict(n.municipal_district ? String(n.municipal_district) : '');
    setPopulation(n.population != null ? String(n.population) : '');
    setHouseholdCount(n.household_count != null ? String(n.household_count) : '');
    setAvgIncome(n.avg_income != null ? String(n.avg_income) : '');
    setLiteracyRate(n.literacy_rate != null ? String(n.literacy_rate) : '');
    setArea(n.area_sqm != null ? String(n.area_sqm) : '');
  }, [n.id, n.name, n.status, n.municipal_district, n.population, n.household_count, n.avg_income, n.literacy_rate, n.area_sqm]);

  const assigned = neighborhoodFabricTypeIds(n);
  const availableTypes = fabricTypes.filter((t) => !assigned.includes(t.id));
  const stats = neighborhoodProfileStats({
    population: n.population,
    areaSqm: n.area_sqm,
    maxPopulation: maxPop,
    maxAreaSqm: maxArea,
  });
  const displayHouseholds = resolveDisplayedHouseholdCount(n.household_count, n.case_household_count);
  const displayIncome = resolveDisplayedOptionalMetric(n.avg_income, undefined);
  const displayLiteracy = resolveDisplayedOptionalMetric(n.literacy_rate, undefined);
  const statusLabel = n.status
    ? (NEIGHBORHOOD_STATUS_LABELS[n.status as NeighborhoodStatus] ?? n.status)
    : '—';

  async function saveEdit() {
    const fieldErrors = validateNeighborhoodCreate({
      code: n.code || 'N',
      name,
      status,
      municipalDistrict: district,
      population,
      householdCount,
      avgIncome,
      literacyRate,
      areaSqm: area,
    });
    if (Object.keys(fieldErrors).length) {
      await feedback.alert(Object.values(fieldErrors)[0] ?? 'اطلاعات نامعتبر است', 'ویرایش محله');
      return;
    }
    const res = await updateNeighborhood(n.id, {
      name: name.trim(),
      status,
      municipalDistrict: district ? Number(district) : undefined,
      population: population ? Number(population) : undefined,
      householdCount: householdCount ? Number(householdCount) : undefined,
      avgIncome: avgIncome ? Number(avgIncome) : undefined,
      literacyRate: literacyRate ? Number(literacyRate) : undefined,
      areaSqm: area ? Number(area) : undefined,
    });
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'خطا', 'ویرایش محله');
      return;
    }
    feedback.success('محله به‌روزرسانی شد');
    onToggleEdit();
    onChanged();
  }

  async function setTypes(next: string[]) {
    const res = await updateNeighborhood(n.id, { metadata: { fabricTypeIds: next } });
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'خطا', 'نوع بافت محله');
      return false;
    }
    onChanged();
    return true;
  }

  return (
    <li className="layer-nb-item">
      <div className="layer-nb-top">
        <RowNo n={n.rowNo} />
        <div className="layer-nb-main">
          <strong>{n.name}</strong>
          <small>
            {NEIGHBORHOOD_KIND_LABELS[kind]}
            {parentName ? ` · والد: ${parentName}` : ''}
            {' · '}
            {n.code ? toPersianDigits(n.code) : '—'}
            {n.municipal_district ? ` · منطقه ${toPersianDigits(n.municipal_district)}` : ''}
            {' · '}
            {statusLabel}
            {' · '}
            {n.has_geometry ? 'دارای محدوده' : 'بدون محدوده'}
          </small>
          <div className="nb-profile" aria-label="خلاصه آمار محله">
            <div className="nb-stat">
              <span>جمعیت</span>
              <strong>{stats.population != null ? formatNumber(stats.population) : '—'}</strong>
              <i className="nb-stat-bar" style={{ width: `${Math.round(stats.popShare * 100)}%` }} />
            </div>
            <div className="nb-stat">
              <span>خانوار</span>
              <strong>{displayHouseholds > 0 ? formatNumber(displayHouseholds) : '—'}</strong>
            </div>
            <div className="nb-stat">
              <span>میانگین درآمد</span>
              <strong dir="ltr">{displayIncome != null ? formatNumber(Math.round(displayIncome)) : '—'}</strong>
            </div>
            <div className="nb-stat">
              <span>سطح سواد</span>
              <strong dir="ltr">{displayLiteracy != null ? `${formatNumber(displayLiteracy, { maximumFractionDigits: 1 })}٪` : '—'}</strong>
            </div>
            <div className="nb-stat">
              <span>مساحت</span>
              <strong>
                {stats.areaHectares != null
                  ? `${formatNumber(stats.areaHectares, { maximumFractionDigits: 2 })} هکتار`
                  : '—'}
              </strong>
              {stats.areaSqm != null && (
                <em dir="ltr">{formatNumber(Math.round(stats.areaSqm))} م²</em>
              )}
              <i className="nb-stat-bar nb-stat-bar-area" style={{ width: `${Math.round(stats.areaShare * 100)}%` }} />
            </div>
            {stats.densityPerHa != null && (
              <div className="nb-stat nb-stat-density">
                <span>تراکم</span>
                <strong>{formatNumber(Math.round(stats.densityPerHa))} نفر/هکتار</strong>
              </div>
            )}
          </div>
          <div className="nb-type-row">
            {assigned.length === 0 ? (
              <small className="nb-type-empty">نوع بافت اختصاص داده نشده</small>
            ) : (
              <div className="nb-type-chips">
                {assigned.map((id) => {
                  const t = fabricTypes.find((ft) => ft.id === id);
                  return (
                    <span key={id} className="nb-type-chip">
                      <i className="swatch" style={{ background: t?.colorHex ?? '#ccc' }} />
                      {t?.name ?? 'نوع بافت'}
                      {canWrite && (
                        <button type="button" onClick={() => void setTypes(removeId(assigned, id))} aria-label="حذف نوع بافت">×</button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {canWrite && availableTypes.length > 0 && (
              <div className="nb-type-add">
                <select
                  value={addTypeId}
                  onChange={(e) => onAddTypeId(e.target.value)}
                  aria-label="افزودن نوع بافت موجود"
                >
                  <option value="">نوع بافت موجود…</option>
                  {availableTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!addTypeId}
                  onClick={() => {
                    void setTypes(addUniqueId(assigned, addTypeId)).then((ok) => {
                      if (ok) onAddTypeId('');
                    });
                  }}
                >
                  افزودن
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="layer-nb-actions">
          {canWrite && (
            <button type="button" className="btn btn-sm" onClick={onToggleEdit}>
              {editing ? 'بستن' : 'ویرایش'}
            </button>
          )}
          {!n.has_geometry && canWrite && (
            <Link className="link-muted" href={mapAttachHref('neighborhood', n.id, n.name)}>
              تعیین روی نقشه
            </Link>
          )}
        </div>
      </div>
      {editing && canWrite && (
        <div className="nb-edit-form">
          <label>
            <span>نام</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>وضعیت</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.values(NeighborhoodStatus).map((s) => (
                <option key={s} value={s}>{NEIGHBORHOOD_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>منطقه</span>
            <select value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">—</option>
              {MUNICIPAL_DISTRICTS.map((d) => (
                <option key={d} value={d}>منطقه {d}</option>
              ))}
            </select>
          </label>
          <label>
            <span>جمعیت</span>
            <input type="number" min={0} value={population} onChange={(e) => setPopulation(e.target.value)} />
          </label>
          <label>
            <span>تعداد خانوار</span>
            <input type="number" min={0} value={householdCount} onChange={(e) => setHouseholdCount(e.target.value)} />
          </label>
          <label>
            <span>میانگین درآمد (ریال)</span>
            <input type="number" min={0} value={avgIncome} onChange={(e) => setAvgIncome(e.target.value)} />
          </label>
          <label>
            <span>سطح سواد (٪)</span>
            <input type="number" min={0} max={100} step={0.1} value={literacyRate} onChange={(e) => setLiteracyRate(e.target.value)} />
          </label>
          <label>
            <span>مساحت (م²)</span>
            <input type="number" min={0} value={area} onChange={(e) => setArea(e.target.value)} />
          </label>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void saveEdit()}>ذخیره</button>
        </div>
      )}
    </li>
  );
}
