'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/components/ui/Feedback';
import {
  fetchFabricTypes,
  createFabricType,
  createNeighborhood,
  createFabric,
  createDwelling,
  updateNeighborhood,
  FabricType,
} from '@/lib/gis-api';
import { LayerStyleAccordion, LayerStyleControls } from '@/components/gis/LayerStyleControls';
import { AreaProjectsPanel } from '@/components/gis/AreaProjectsPanel';
import { UrbanLayersPanel } from '@/components/gis/UrbanLayersPanel';
import { GisLayerCatalog, NeighborhoodRow, FabricCatalogRow, DwellingCatalogRow } from '@/components/gis/GisLayerCatalog';
import { LinkedPlaceCascade } from '@/components/gis/LinkedPlaceCascade';
import { apiFetch } from '@/lib/api';
import {
  firstQueryFailure,
  MUNICIPAL_DISTRICTS,
  NEIGHBORHOOD_STATUS_LABELS,
  NeighborhoodStatus,
  NeighborhoodKind,
  NEIGHBORHOOD_KIND_LABELS,
  NORMAL_FABRIC_TYPE_CODE,
  NORMAL_FABRIC_TYPE_NAME,
  addUniqueId,
  validateNeighborhoodCreate,
  NEW_LINKED_ID,
  isPersistedLinkedId,
  suggestFabricName,
  neighborhoodFabricTypeIds,
  generateNeighborhoodCode,
  buildNeighborhoodMetadata,
  defaultFabricTypeForNeighborhoodKind,
  resolveNormalFabricTypeId,
  type LinkedPlaceIds,
} from '@city-manager/shared';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

type CreateKind = 'fabricType' | 'place' | 'dwelling' | null;

function mapAttachHref(
  kind: 'neighborhood' | 'fabric' | 'dwelling',
  id: string,
  name: string,
) {
  const q = new URLSearchParams({ attach: kind, id, name });
  return `/dashboard/map?${q.toString()}`;
}

export default function LayersPage() {
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const canWriteNbhd = hasPermission('neighborhoods:write');
  const canWriteFabric = hasPermission('fabrics:write');
  const canWriteDwelling = hasPermission('dwellings:write');
  const canWriteUrban = hasPermission('gis_layers:write');
  const canWrite = canWriteNbhd || canWriteFabric || canWriteDwelling || canWriteUrban;
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodRow[]>([]);
  const [fabrics, setFabrics] = useState<FabricCatalogRow[]>([]);
  const [dwellings, setDwellings] = useState<DwellingCatalogRow[]>([]);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [saving, setSaving] = useState(false);
  const { loading, error, setError, run } = useQueryLoad();

  const [ftCode, setFtCode] = useState('');
  const [ftName, setFtName] = useState('');
  const [ftColor, setFtColor] = useState('#d4a017');
  const [ftOpacity, setFtOpacity] = useState(0.35);

  const [nbCode, setNbCode] = useState('');
  const [nbName, setNbName] = useState('');
  const [nbStatus, setNbStatus] = useState(NeighborhoodStatus.PLANNED);
  const [nbDistrict, setNbDistrict] = useState('');
  const [nbPopulation, setNbPopulation] = useState('');
  const [nbHouseholdCount, setNbHouseholdCount] = useState('');
  const [nbAvgIncome, setNbAvgIncome] = useState('');
  const [nbLiteracyRate, setNbLiteracyRate] = useState('');
  const [nbArea, setNbArea] = useState('');

  const [place, setPlace] = useState<LinkedPlaceIds>({
    neighborhoodId: NEW_LINKED_ID,
    fabricId: '',
    fabricTypeId: '',
    neighborhoodKind: NeighborhoodKind.URBAN,
    parentUrbanNeighborhoodId: '',
  });

  const [dwTitle, setDwTitle] = useState('');
  const [dwCode, setDwCode] = useState('');
  const [dwAddress, setDwAddress] = useState('');
  const [dwPlace, setDwPlace] = useState<LinkedPlaceIds>({
    neighborhoodId: '',
    fabricId: '',
    fabricTypeId: '',
  });

  const creatingNewNeighborhood = place.neighborhoodId === NEW_LINKED_ID;
  const placeKind = place.neighborhoodKind ?? NeighborhoodKind.URBAN;
  const creatingNewType = place.fabricTypeId === NEW_LINKED_ID && placeKind === NeighborhoodKind.REGENERATION_TARGET;

  const selectedNeighborhood = neighborhoods.find((n) => n.id === place.neighborhoodId);
  const selectedType = fabricTypes.find((t) => t.id === place.fabricTypeId);

  function makeNbCode(kind = place.neighborhoodKind ?? NeighborhoodKind.URBAN) {
    return generateNeighborhoodCode({
      kind,
      municipalDistrict: nbDistrict,
      existingCodes: neighborhoods.map((n) => n.code ?? ''),
    });
  }

  function refreshNbCode() {
    setNbCode(makeNbCode());
  }

  useEffect(() => {
    if (!creatingNewNeighborhood) return;
    setNbCode(makeNbCode());
  }, [creatingNewNeighborhood, place.neighborhoodKind, nbDistrict]);

  async function load() {
    await run(async () => {
      const [ft, nb, fb, dw] = await Promise.all([
        fetchFabricTypes(),
        apiFetch<NeighborhoodRow[]>('/gis/neighborhoods', {}),
        apiFetch<FabricCatalogRow[]>('/gis/fabrics', {}),
        apiFetch<DwellingCatalogRow[]>('/gis/dwellings', {}),
      ]);
      setFabricTypes(ft || []);
      if (nb.success && Array.isArray(nb.data)) setNeighborhoods(nb.data);
      if (fb.success && Array.isArray(fb.data)) setFabrics(fb.data);
      if (dw.success && Array.isArray(dw.data)) setDwellings(dw.data);
      const fail = firstQueryFailure([nb, fb, dw]);
      if (fail) setError(fail);
    });
  }

  useEffect(() => {
    if (!hasPermission('gis_layers:read') && !hasPermission('dwellings:read')) return;
    void load();
  }, [hasPermission]);

  function resetForms() {
    setFtCode('');
    setFtName('');
    setFtColor('#d4a017');
    setFtOpacity(0.35);
    setNbCode('');
    setNbName('');
    setNbStatus(NeighborhoodStatus.PLANNED);
    setNbDistrict('');
    setNbPopulation('');
    setNbHouseholdCount('');
    setNbAvgIncome('');
    setNbLiteracyRate('');
    setNbArea('');
    setPlace({
      neighborhoodId: canWriteNbhd ? NEW_LINKED_ID : '',
      fabricId: '',
      fabricTypeId: '',
      neighborhoodKind: NeighborhoodKind.URBAN,
      parentUrbanNeighborhoodId: '',
    });
    setDwTitle('');
    setDwCode('');
    setDwAddress('');
    setDwPlace({ neighborhoodId: '', fabricId: '', fabricTypeId: '' });
  }

  function openKind(kind: CreateKind) {
    const next = createKind === kind ? null : kind;
    setCreateKind(next);
    if (next === 'place') {
      setPlace({
        neighborhoodId: canWriteNbhd ? NEW_LINKED_ID : '',
        fabricId: '',
        fabricTypeId: defaultFabricTypeForNeighborhoodKind(NeighborhoodKind.URBAN, fabricTypes),
        neighborhoodKind: NeighborhoodKind.URBAN,
        parentUrbanNeighborhoodId: '',
      });
    }
  }

  async function ensureNormalFabricTypeId(): Promise<string | null> {
    const existing = resolveNormalFabricTypeId(fabricTypes);
    if (existing) return existing;
    const res = await createFabricType({
      code: NORMAL_FABRIC_TYPE_CODE,
      name: NORMAL_FABRIC_TYPE_NAME,
      colorHex: '#6b7280',
      fillOpacity: 0.25,
    });
    if (!res.success || !res.data) {
      await feedback.alert(res.error?.message ?? 'خطا', 'ثبت بافت عادی');
      return null;
    }
    setFabricTypes((prev) => [...prev, res.data!]);
    return res.data.id;
  }

  async function resolveFabricTypeId(): Promise<string | null> {
    const kind = place.neighborhoodKind ?? NeighborhoodKind.URBAN;
    const effectiveKind =
      kind === NeighborhoodKind.REGENERATION_TARGET && !place.parentUrbanNeighborhoodId?.trim()
        ? NeighborhoodKind.URBAN
        : kind;
    if (effectiveKind === NeighborhoodKind.URBAN) {
      return ensureNormalFabricTypeId();
    }
    if (isPersistedLinkedId(place.fabricTypeId)) return place.fabricTypeId;
    if (place.fabricTypeId !== NEW_LINKED_ID) return null;
    if (!ftCode.trim() || !ftName.trim()) {
      await feedback.alert('کد و نام نوع بافت جدید را وارد کنید', 'نوع بافت');
      return null;
    }
    const res = await createFabricType({
      code: ftCode.trim(),
      name: ftName.trim(),
      colorHex: ftColor,
      fillOpacity: ftOpacity,
    });
    if (!res.success || !res.data) {
      await feedback.alert(res.error?.message ?? 'خطا', 'ثبت نوع بافت');
      return null;
    }
    return res.data.id;
  }

  async function submitCreate() {
    setSaving(true);
    try {
      if (createKind === 'fabricType') {
        if (!ftCode.trim() || !ftName.trim()) {
          await feedback.alert('کد و نام نوع بافت را وارد کنید', 'ثبت نوع بافت');
          return;
        }
        const res = await createFabricType({
          code: ftCode.trim(),
          name: ftName.trim(),
          colorHex: ftColor,
          fillOpacity: ftOpacity,
        });
        if (!res.success) {
          await feedback.alert(res.error?.message ?? 'خطا', 'ثبت نوع بافت');
          return;
        }
        feedback.success('نوع بافت ثبت شد');
      }

      if (createKind === 'place') {
        let kind = place.neighborhoodKind ?? NeighborhoodKind.URBAN;
        if (kind === NeighborhoodKind.REGENERATION_TARGET && !place.parentUrbanNeighborhoodId?.trim()) {
          kind = NeighborhoodKind.URBAN;
        }
        const typeId = await resolveFabricTypeId();
        if (!typeId) {
          if (kind === NeighborhoodKind.REGENERATION_TARGET && !creatingNewType) {
            await feedback.alert('نوع بافت را انتخاب کنید', 'ثبت محله');
          }
          return;
        }

        let neighborhoodId = isPersistedLinkedId(place.neighborhoodId) ? place.neighborhoodId : '';
        let neighborhoodName = selectedNeighborhood?.name ?? nbName.trim();
        const typeName = creatingNewType ? ftName.trim() : (selectedType?.name ?? NORMAL_FABRIC_TYPE_NAME);

        if (creatingNewNeighborhood) {
          if (!canWriteNbhd) {
            await feedback.alert('مجوز ثبت محله را ندارید', 'ثبت محله');
            return;
          }
          const code = nbCode.trim() || makeNbCode(kind);
          const fieldErrors = validateNeighborhoodCreate({
            code,
            name: nbName,
            status: nbStatus,
            municipalDistrict: nbDistrict,
            population: nbPopulation,
            householdCount: nbHouseholdCount,
            avgIncome: nbAvgIncome,
            literacyRate: nbLiteracyRate,
            areaSqm: nbArea,
          });
          if (Object.keys(fieldErrors).length) {
            await feedback.alert(Object.values(fieldErrors)[0] ?? 'کد و نام محله را وارد کنید', 'ثبت محله');
            return;
          }
          const res = await createNeighborhood({
            code,
            name: nbName.trim(),
            status: nbStatus,
            municipalDistrict: nbDistrict ? Number(nbDistrict) : undefined,
            population: nbPopulation ? Number(nbPopulation) : undefined,
            householdCount: nbHouseholdCount ? Number(nbHouseholdCount) : undefined,
            avgIncome: nbAvgIncome ? Number(nbAvgIncome) : undefined,
            literacyRate: nbLiteracyRate ? Number(nbLiteracyRate) : undefined,
            areaSqm: nbArea ? Number(nbArea) : undefined,
            metadata: buildNeighborhoodMetadata({
              neighborhoodKind: kind,
              parentUrbanNeighborhoodId: place.parentUrbanNeighborhoodId || undefined,
              fabricTypeIds: [typeId],
            }),
          });
          if (!res.success || !res.data) {
            await feedback.alert(res.error?.message ?? 'خطا', 'ثبت محله');
            return;
          }
          neighborhoodId = res.data.id;
          neighborhoodName = res.data.name;
        } else if (!neighborhoodId) {
          await feedback.alert('محله را انتخاب کنید یا محله جدید بسازید', 'ثبت محله');
          return;
        } else {
          const existingTypes = neighborhoodFabricTypeIds(selectedNeighborhood ?? {});
          if (!existingTypes.includes(typeId)) {
            await updateNeighborhood(neighborhoodId, {
              metadata: buildNeighborhoodMetadata({
                neighborhoodKind: kind,
                parentUrbanNeighborhoodId: place.parentUrbanNeighborhoodId || undefined,
                fabricTypeIds: addUniqueId(existingTypes, typeId),
              }),
            });
          }
        }

        if (canWriteFabric) {
          const fabricLabel = suggestFabricName(neighborhoodName, typeName);
          const existingFabric = fabrics.find(
            (f) => f.neighborhood_id === neighborhoodId && f.fabric_type_id === typeId,
          );
          if (!existingFabric) {
            const res = await createFabric({
              fabricTypeId: typeId,
              name: fabricLabel,
              neighborhoodId,
            });
            if (!res.success) {
              await feedback.alert(res.error?.message ?? 'خطا', 'اتصال نوع بافت');
              return;
            }
          }
        }

        const kindLabel = NEIGHBORHOOD_KIND_LABELS[kind];
        const goMap = await feedback.confirm(
          `${kindLabel} ثبت شد. محدوده را روی نقشه مشخص می‌کنید؟`,
          'تعیین محدوده',
        );
        if (goMap && neighborhoodId) {
          window.location.href = mapAttachHref('neighborhood', neighborhoodId, neighborhoodName);
          return;
        }
        feedback.success(`${kindLabel} ثبت شد؛ لایه در کاتالوگ و نقشه در دسترس است`);
      }

      if (createKind === 'dwelling') {
        if (!dwTitle.trim()) {
          await feedback.alert('عنوان ملک را وارد کنید', 'ثبت ملک');
          return;
        }
        const res = await createDwelling({
          title: dwTitle.trim(),
          dwellingCode: dwCode.trim() || undefined,
          fullAddress: dwAddress.trim() || undefined,
          neighborhoodId: dwPlace.neighborhoodId || undefined,
          metadata: dwPlace.fabricTypeId
            ? { fabricTypeId: dwPlace.fabricTypeId }
            : undefined,
        });
        if (!res.success || !res.data) {
          await feedback.alert(res.error?.message ?? 'خطا', 'ثبت ملک');
          return;
        }
        const goMap = await feedback.confirm(
          'ملک ثبت شد. موقعیت را روی نقشه مشخص می‌کنید؟',
          'تعیین موقعیت',
        );
        if (goMap) {
          window.location.href = mapAttachHref('dwelling', res.data.id, dwTitle.trim());
          return;
        }
        feedback.success('ملک بدون موقعیت ثبت شد');
      }

      resetForms();
      setCreateKind(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const canRead = hasPermission('gis_layers:read') || hasPermission('dwellings:read');
  const canCreatePlace = canWriteNbhd || canWriteFabric;

  return (
    <AppShell title="لایه‌های نقشه">
      <PermissionGate allow={canRead}>
        <PageHeader
          title="مدیریت لایه‌های GIS"
          description="لایه‌های شهری مرجع (مرز، منطقه، طرح)، محلات، بافت‌ها و املاک — آپلود فایل و نمایش روی نقشه"
          actions={
            <Link href="/dashboard/map" className="btn btn-primary btn-with-icon">
              <NavIcon name="map" size={16} />
              باز کردن نقشه
            </Link>
          }
        />

        <UrbanLayersPanel canWrite={canWriteUrban} />

        <section className="card layers-howto">
          <h3>از کجا اضافه می‌شوند؟</h3>
          <ul>
            <li>
              <strong>همین صفحه:</strong> ثبت مشخصات (نام، کد، …) سپس لینک «تعیین روی نقشه»
            </li>
            <li>
              <strong>نقشه GIS:</strong> رسم محدوده / ثبت سریع ملک با کلیک / آپلود فایل مکانی
            </li>
          </ul>
        </section>

        <section className="card layers-howto">
          <h3>چطور لایه را حذف کنیم؟</h3>
          <ul>
            <li>
              <strong>حذف کامل از پروژه:</strong> همین صفحه → بخش «لایه‌های اطلاعاتی شهری» → دکمه قرمز «حذف» → تأیید پیغام.
              لایه و همهٔ عوارض آن برای همیشه پاک می‌شوند.
            </li>
            <li>
              <strong>فقط پنهان از نقشه:</strong> در صفحه نقشه تیک لایه را بردارید؛ داده در سامانه می‌ماند.
            </li>
            <li>
              <strong>غیرفعال موقت:</strong> دکمه «غیرفعال» در همین صفحه یا Off روی نقشه — بدون حذف داده.
            </li>
          </ul>
        </section>

        {canWrite && (
          <section className="card layers-create-card">
            <div className="card-head">
              <div>
                <h3>ثبت جدید (اول مشخصات)</h3>
                <p className="muted">نام و جزئیات را وارد کنید؛ محدوده را بعداً روی نقشه بکشید</p>
              </div>
            </div>
            <div className="layers-create-tabs">
              {canCreatePlace && (
                <button
                  type="button"
                  className={`btn ${createKind === 'place' ? 'btn-primary' : ''}`}
                  onClick={() => openKind('place')}
                >
                  محله و نوع بافت
                </button>
              )}
              {canWriteDwelling && (
                <button
                  type="button"
                  className={`btn ${createKind === 'dwelling' ? 'btn-primary' : ''}`}
                  onClick={() => openKind('dwelling')}
                >
                  ملک / منزل
                </button>
              )}
              {canWriteFabric && (
                <button
                  type="button"
                  className={`btn ${createKind === 'fabricType' ? 'btn-primary' : ''}`}
                  onClick={() => openKind('fabricType')}
                >
                  نوع بافت (کاتالوگ)
                </button>
              )}
            </div>

            {createKind && (
              <div className="layers-create-form">
                {createKind === 'fabricType' && (
                  <>
                    <div className="settings-form-grid">
                      <label className="settings-field">
                        <span className="settings-field-label">کد</span>
                        <input value={ftCode} onChange={(e) => setFtCode(e.target.value)} placeholder="مثلاً informal" />
                      </label>
                      <label className="settings-field">
                        <span className="settings-field-label">نام</span>
                        <input value={ftName} onChange={(e) => setFtName(e.target.value)} placeholder="بافت فرسوده" />
                      </label>
                    </div>
                    <LayerStyleAccordion color={ftColor} opacity={ftOpacity} noFill={ftOpacity <= 0} title="ظاهر نوع بافت">
                    <LayerStyleControls
                      color={ftColor}
                      opacity={ftOpacity}
                      onColor={setFtColor}
                      onOpacity={setFtOpacity}
                    />
                    </LayerStyleAccordion>
                  </>
                )}

                {createKind === 'place' && (
                  <>
                    <LinkedPlaceCascade
                      neighborhoods={neighborhoods}
                      fabrics={fabrics}
                      fabricTypes={fabricTypes}
                      value={place}
                      onChange={setPlace}
                      allowCreate={canWriteNbhd}
                      showNeighborhoodKind
                    />
                    <div className="settings-form-grid">
                      {creatingNewNeighborhood && (
                        <>
                          <label className="settings-field">
                            <span className="settings-field-label">کد محله</span>
                            <div className="code-gen-row">
                              <input value={nbCode} readOnly dir="ltr" className="code-gen-value" aria-readonly />
                              <button type="button" className="btn btn-sm" onClick={refreshNbCode}>
                                تولید مجدد
                              </button>
                            </div>
                            <span className="settings-field-hint">SH=شهری · HD=هدف · D=منطقه</span>
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">نام محله</span>
                            <input value={nbName} onChange={(e) => setNbName(e.target.value)} placeholder="مثلاً منبع آب" />
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">وضعیت</span>
                            <select value={nbStatus} onChange={(e) => setNbStatus(e.target.value as NeighborhoodStatus)}>
                              {Object.values(NeighborhoodStatus).map((s) => (
                                <option key={s} value={s}>{NEIGHBORHOOD_STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">منطقه شهرداری</span>
                            <select value={nbDistrict} onChange={(e) => setNbDistrict(e.target.value)}>
                              <option value="">—</option>
                              {MUNICIPAL_DISTRICTS.map((d) => (
                                <option key={d} value={d}>منطقه {d}</option>
                              ))}
                            </select>
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">جمعیت</span>
                            <input type="number" min={0} value={nbPopulation} onChange={(e) => setNbPopulation(e.target.value)} placeholder="مثلاً ۱۲۰۰۰" />
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">تعداد خانوار</span>
                            <input type="number" min={0} value={nbHouseholdCount} onChange={(e) => setNbHouseholdCount(e.target.value)} placeholder="مثلاً ۳۲۰۰" />
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">میانگین درآمد (ریال)</span>
                            <input type="number" min={0} value={nbAvgIncome} onChange={(e) => setNbAvgIncome(e.target.value)} placeholder="مثلاً ۱۵۰۰۰۰۰۰" />
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">سطح سواد (٪)</span>
                            <input type="number" min={0} max={100} step={0.1} value={nbLiteracyRate} onChange={(e) => setNbLiteracyRate(e.target.value)} placeholder="مثلاً ۷۸٫۵" />
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">مساحت (متر مربع)</span>
                            <input type="number" min={0} value={nbArea} onChange={(e) => setNbArea(e.target.value)} placeholder="مثلاً ۴۵۰۰۰" />
                          </label>
                        </>
                      )}

                      {creatingNewType && placeKind === NeighborhoodKind.REGENERATION_TARGET && (
                        <>
                          <label className="settings-field">
                            <span className="settings-field-label">کد نوع بافت</span>
                            <input value={ftCode} onChange={(e) => setFtCode(e.target.value)} placeholder="مثلاً informal" />
                          </label>
                          <label className="settings-field">
                            <span className="settings-field-label">نام نوع بافت</span>
                            <input value={ftName} onChange={(e) => setFtName(e.target.value)} placeholder="بافت فرسوده" />
                          </label>
                        </>
                      )}
                    </div>
                    {creatingNewType && placeKind === NeighborhoodKind.REGENERATION_TARGET && (
                      <LayerStyleAccordion color={ftColor} opacity={ftOpacity} noFill={ftOpacity <= 0} title="ظاهر نوع بافت">
                        <LayerStyleControls
                          color={ftColor}
                          opacity={ftOpacity}
                          onColor={setFtColor}
                          onOpacity={setFtOpacity}
                        />
                      </LayerStyleAccordion>
                    )}
                    <p className="muted layers-create-hint">
                      محله شهری با «بافت عادی» ثبت می‌شود. محله هدف بازآفرینی می‌تواند داخل محله شهری باشد و نوع بافت جداگانه دارد. فیلد بافت حذف شده و نوع بافت به‌صورت خودکار به لایه نقشه متصل می‌شود.
                    </p>
                  </>
                )}

                {createKind === 'dwelling' && (
                  <div className="settings-form-grid">
                    <label className="settings-field">
                      <span className="settings-field-label">عنوان ملک</span>
                      <input value={dwTitle} onChange={(e) => setDwTitle(e.target.value)} />
                    </label>
                    <label className="settings-field">
                      <span className="settings-field-label">کد ملک (اختیاری)</span>
                      <input value={dwCode} onChange={(e) => setDwCode(e.target.value)} />
                    </label>
                    <label className="settings-field">
                      <span className="settings-field-label">آدرس</span>
                      <input value={dwAddress} onChange={(e) => setDwAddress(e.target.value)} />
                    </label>
                    <LinkedPlaceCascade
                      neighborhoods={neighborhoods}
                      fabrics={fabrics}
                      fabricTypes={fabricTypes}
                      value={dwPlace}
                      onChange={setDwPlace}
                    />
                  </div>
                )}

                <div className="form-actions">
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void submitCreate()}>
                    {saving ? 'در حال ثبت…' : 'ثبت مشخصات'}
                  </button>
                  <button type="button" className="btn" onClick={() => { setCreateKind(null); resetForms(); }}>
                    انصراف
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <AreaProjectsPanel
          neighborhoods={neighborhoods}
          fabrics={fabrics}
          fabricTypes={fabricTypes}
          canWrite={canWriteNbhd || canWriteFabric}
        />

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری لایه‌ها…">
          <GisLayerCatalog
            fabricTypes={fabricTypes}
            neighborhoods={neighborhoods}
            fabrics={fabrics}
            dwellings={dwellings}
            canWriteNbhd={canWriteNbhd}
            canWriteFabric={canWriteFabric}
            canWriteDwelling={canWriteDwelling}
            onChanged={() => { void load(); }}
          />
        </QueryState>
      </PermissionGate>
    </AppShell>
  );
}
