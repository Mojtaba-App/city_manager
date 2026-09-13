'use client';

import { useEffect, useRef, useState } from 'react';
import {
  UrbanLayerCategory,
  URBAN_LAYER_CATEGORY_LABELS,
  IngestTargetType,
  layerColorPatch,
  urbanLayerCategoryLabel,
} from '@city-manager/shared';
import { LayerStyleAccordion, LayerStyleControls } from './LayerStyleControls';
import { UrbanLayerCategorySelect } from './UrbanLayerCategorySelect';
import { ImportBusyLabel } from '@/components/ui/LoadingSpinner';
import { NavIcon } from '@/components/NavIcons';
import { useFeedback } from '@/components/ui/Feedback';
import {
  UrbanLayer,
  fetchUrbanLayers,
  createUrbanLayer,
  updateUrbanLayer,
  deleteUrbanLayer,
  ingestSpatialFile,
} from '@/lib/gis-api';
import { formatNumber } from '@/lib/format';
import { urbanLayerHealth, urbanLayerHealthMessage } from '@city-manager/shared';

const ALLOWED_EXT = new Set(['geojson', 'json', 'kml', 'kmz', 'zip']);

function fileExt(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function UrbanLayersPanel({ canWrite }: { canWrite: boolean }) {
  const feedback = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [layers, setLayers] = useState<UrbanLayer[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    percent: number;
    phase: 'upload' | 'processing' | 'done';
  } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [uploadLayerId, setUploadLayerId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<UrbanLayerCategory>(UrbanLayerCategory.PLAN_REGENERATION);
  const [colorHex, setColorHex] = useState('#2e86ab');
  const [fillOpacity, setFillOpacity] = useState(0.25);

  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<UrbanLayerCategory>(UrbanLayerCategory.CUSTOM);

  async function load() {
    const res = await fetchUrbanLayers();
    if (res.success && Array.isArray(res.data)) setLayers(res.data);
  }

  useEffect(() => {
    void load();
  }, []);

  function startEdit(layer: UrbanLayer) {
    setEditingId(layer.id);
    setEditName(layer.name);
    setEditCategory((layer.category as UrbanLayerCategory) || UrbanLayerCategory.CUSTOM);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function saveEdit(layer: UrbanLayer) {
    if (!canWrite) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      await feedback.alert('نام لایه الزامی است', 'ویرایش لایه');
      return;
    }
    setBusy(true);
    const res = await updateUrbanLayer(layer.id, {
      name: trimmed,
      category: editCategory,
    });
    setBusy(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ذخیره ناموفق', 'ویرایش لایه');
      return;
    }
    feedback.success('لایه به‌روزرسانی شد');
    cancelEdit();
    await load();
  }

  async function handleCreate() {
    if (!code.trim() || !name.trim()) {
      await feedback.alert('کد و نام لایه را وارد کنید', 'لایه شهری');
      return;
    }
    setBusy(true);
    const res = await createUrbanLayer({
      code: code.trim(),
      name: name.trim(),
      category,
      ...layerColorPatch(colorHex),
      fillOpacity,
    });
    setBusy(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ثبت ناموفق', 'لایه شهری');
      return;
    }
    feedback.success('لایه شهری ایجاد شد');
    setShowCreate(false);
    setCode('');
    setName('');
    setCategory(UrbanLayerCategory.PLAN_REGENERATION);
    await load();
  }

  async function patchLayer(
    layer: UrbanLayer,
    patch: { category?: string; colorHex?: string; fillOpacity?: number },
  ) {
    if (!canWrite) return;
    const body = {
      ...patch,
      ...(patch.colorHex ? layerColorPatch(patch.colorHex) : {}),
    };
    const res = await updateUrbanLayer(layer.id, body);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ذخیره ظاهر لایه ناموفق بود', 'ویرایش لایه');
      return;
    }
    await load();
  }

  async function toggleActive(layer: UrbanLayer) {
    if (!canWrite) return;
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
      await feedback.alert(res.error?.message ?? 'خطا', 'فعال‌سازی لایه');
      return;
    }
    feedback.success(layer.is_active ? 'لایه غیرفعال شد' : 'لایه فعال شد');
    await load();
  }

  async function handleDelete(layer: UrbanLayer) {
    if (!canWrite) return;
    const count = formatNumber(layer.feature_count ?? 0);
    const ok = await feedback.confirm(
      `لایه «${layer.name}» و ${count} عارضهٔ آن برای همیشه از پروژه حذف می‌شود و قابل بازگشت نیست. مطمئن هستید؟`,
      'تأیید حذف لایه',
      { confirmLabel: 'بله، حذف شود', cancelLabel: 'انصراف', danger: true },
    );
    if (!ok) return;
    setBusy(true);
    const res = await deleteUrbanLayer(layer.id);
    setBusy(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'حذف ناموفق', 'لایه شهری');
      return;
    }
    feedback.success('لایه حذف شد');
    if (editingId === layer.id) cancelEdit();
    await load();
  }

  async function handleUpload(file: File) {
    if (!uploadLayerId) {
      await feedback.alert('ابتدا لایه مقصد را انتخاب کنید', 'آپلود');
      return;
    }
    if (!ALLOWED_EXT.has(fileExt(file.name))) {
      await feedback.alert('فرمت مجاز: GeoJSON، KML، KMZ یا ZIP (Shapefile)', 'آپلود');
      return;
    }
    setUploadProgress({ percent: 0, phase: 'upload' });
    const res = await ingestSpatialFile(file, IngestTargetType.LAYER, {
      layerId: uploadLayerId,
      onProgress: setUploadProgress,
    });
    setUploadProgress(null);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'آپلود ناموفق', 'آپلود لایه شهری');
      return;
    }
    const count = (res.data as { featuresImported?: number })?.featuresImported ?? 0;
    feedback.success(`${formatNumber(count)} عارضه به لایه اضافه شد`);
    if (fileRef.current) fileRef.current.value = '';
    await load();
  }

  return (
    <section className="card settings-card urban-layers-panel">
      <div className="card-head">
        <div>
          <h3>
            <NavIcon name="layers" size={18} /> لایه‌های اطلاعاتی شهری
          </h3>
          <p className="muted">
            مسیر درست: ۱) لایه بسازید ۲) فایل را به همان لایه آپلود کنید ۳) در نقشه روشن کنید
          </p>
        </div>
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'بستن فرم' : '۱) لایه جدید'}
          </button>
        )}
      </div>

      <ol className="urban-layers-steps muted">
        <li>این صفحه → «لایه جدید» و انتخاب دسته طرح (فرادست تا اجرایی)</li>
        <li>همان‌جا لایه را انتخاب و فایل KMZ/GeoJSON را آپلود کنید</li>
        <li>یا از نقشه → آپلود فایل مکانی → هدف «لایه اطلاعاتی شهری»</li>
      </ol>

      {showCreate && canWrite && (
        <div className="urban-layer-create">
          <div className="settings-form-grid urban-layer-create-fields">
            <label className="settings-field">
              <span className="settings-field-label">نام لایه</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً طرح بازآفرینی بافت" />
            </label>
            <label className="settings-field urban-layer-category-field">
              <span className="settings-field-label">دسته</span>
              <UrbanLayerCategorySelect value={category} onChange={setCategory} />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">کد لایه</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="REGEN-CORE" dir="ltr" />
            </label>
          </div>
          <LayerStyleAccordion color={colorHex} opacity={fillOpacity} noFill={fillOpacity <= 0} title="ظاهر لایه جدید">
            <LayerStyleControls
              color={colorHex}
              opacity={fillOpacity}
              onColor={setColorHex}
              onOpacity={setFillOpacity}
            />
          </LayerStyleAccordion>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleCreate()}>
              {busy ? 'در حال ثبت…' : 'ایجاد لایه'}
            </button>
          </div>
        </div>
      )}

      {canWrite && layers.length > 0 && (
        <div className="urban-layer-upload urban-layer-upload--compact">
          <div className="urban-layer-upload-inline">
            <select
              className="urban-layer-upload-select"
              value={uploadLayerId}
              onChange={(e) => setUploadLayerId(e.target.value)}
              aria-label="لایه مقصد"
            >
              <option value="">لایه مقصد…</option>
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept=".geojson,.json,.kml,.kmz,.zip"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <button
              type="button"
              className="btn btn-sm gis-import-btn gis-import-btn--compact"
              disabled={busy || uploadProgress != null || !uploadLayerId}
              onClick={() => fileRef.current?.click()}
              aria-busy={uploadProgress != null || undefined}
              title="GeoJSON / KML / KMZ / Shapefile (ZIP)"
            >
              {uploadProgress != null ? (
                <ImportBusyLabel percent={uploadProgress.percent} phase={uploadProgress.phase} />
              ) : (
                <>
                  <NavIcon name="upload" size={14} />
                  <span className="gis-import-btn-label">Import</span>
                </>
              )}
            </button>
          </div>
          <p className="muted urban-layer-upload-hint">GeoJSON · KML · KMZ · ZIP — WGS84</p>
        </div>
      )}

      {layers.length === 0 ? (
        <p className="muted urban-layers-empty">هنوز لایه شهری ثبت نشده است. یک لایه بسازید و فایل مکانی را آپلود کنید.</p>
      ) : (
        <div className="urban-layers-list">
          {layers.map((layer) => {
            const isEditing = editingId === layer.id;
            return (
              <div
                key={layer.id}
                className={`urban-layer-row urban-layer-row-edit ${layer.is_active ? '' : 'inactive'}`}
              >
                <span className="urban-layer-swatch" style={{ background: layer.color_hex }} />
                <div className="urban-layer-meta">
                  {isEditing && canWrite ? (
                    <div className="urban-layer-edit-form">
                      <label className="settings-field">
                        <span className="settings-field-label">نام لایه</span>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={busy}
                        />
                      </label>
                      <label className="settings-field urban-layer-category-field">
                        <span className="settings-field-label">دسته</span>
                        <UrbanLayerCategorySelect
                          value={editCategory}
                          onChange={setEditCategory}
                          disabled={busy}
                        />
                      </label>
                      <div className="urban-layer-edit-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={busy}
                          onClick={() => void saveEdit(layer)}
                        >
                          ذخیره
                        </button>
                        <button type="button" className="btn btn-sm" disabled={busy} onClick={cancelEdit}>
                          انصراف
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <strong>{layer.name}</strong>
                      <span>
                        {urbanLayerCategoryLabel(layer.category)}
                        {' · '}
                        {formatNumber(layer.feature_count ?? 0)} عارضه
                        {!layer.is_active ? ' · غیرفعال' : ''}
                      </span>
                      {(() => {
                        const health = urbanLayerHealth(layer);
                        const msg = urbanLayerHealthMessage(health);
                        return msg ? (
                          <span className={`gis-layer-health gis-layer-health--${health}`}>{msg}</span>
                        ) : (
                          <span className="muted">آماده نمایش روی نقشه</span>
                        );
                      })()}
                      {layer.published_version != null ? (
                        <span className="muted"> · نسخه {formatNumber(layer.published_version)}</span>
                      ) : null}
                    </>
                  )}
                  {canWrite && !isEditing && (
                    <LayerStyleAccordion color={layer.color_hex} opacity={Number(layer.fill_opacity ?? 0.25)} noFill={Number(layer.fill_opacity ?? 0.25) <= 0}>
                      <LayerStyleControls
                        color={layer.color_hex}
                        opacity={Number(layer.fill_opacity ?? 0.25)}
                        onColor={(hex) => void patchLayer(layer, { colorHex: hex })}
                        onOpacity={(v) => void patchLayer(layer, { fillOpacity: v })}
                      />
                    </LayerStyleAccordion>
                  )}
                </div>
                <div className="urban-layer-actions">
                  {canWrite && !isEditing && (
                    <button type="button" className="btn btn-sm" onClick={() => startEdit(layer)}>
                      ویرایش
                    </button>
                  )}
                  {canWrite && (
                    <button type="button" className="btn btn-sm" onClick={() => void toggleActive(layer)}>
                      {layer.is_active ? 'غیرفعال' : 'فعال'}
                    </button>
                  )}
                  <a className="btn btn-sm" href="/dashboard/map">
                    نقشه
                  </a>
                  {canWrite && (
                    <button
                      type="button"
                      className="btn btn-sm regen-btn-danger"
                      disabled={busy}
                      onClick={() => void handleDelete(layer)}
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
