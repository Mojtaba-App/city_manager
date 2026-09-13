'use client';

import { useEffect, useRef, useState } from 'react';
import { IngestTargetType, UrbanLayerCategory, URBAN_LAYER_CATEGORY_LABELS, type LinkedPlaceIds } from '@city-manager/shared';
import { FabricType, UrbanLayer, ingestSpatialFile } from '@/lib/gis-api';
import { NavIcon } from '@/components/NavIcons';
import { ImportBusyLabel } from '@/components/ui/LoadingSpinner';
import { useFeedback } from '@/components/ui/Feedback';
import { apiFetch } from '@/lib/api';
import { LinkedPlaceCascade, type CascadeFabric, type CascadeNeighborhood } from './LinkedPlaceCascade';

const ACCEPT = '*/*';
const ALLOWED_EXT = new Set(['geojson', 'json', 'kml', 'kmz', 'zip']);

function fileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function isAllowedSpatialFile(file: File): boolean {
  const ext = fileExt(file.name);
  if (ALLOWED_EXT.has(ext)) return true;
  const t = (file.type || '').toLowerCase();
  return (
    t.includes('json') ||
    t.includes('kml') ||
    t.includes('kmz') ||
    t.includes('zip') ||
    t.includes('octet-stream')
  );
}

export function SpatialFileUpload({
  fabricTypes,
  urbanLayers = [],
  onSuccess,
  onClose,
}: {
  fabricTypes: FabricType[];
  urbanLayers?: UrbanLayer[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const feedback = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLSelectElement>(null);
  const urbanLayerRef = useRef<HTMLSelectElement>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    percent: number;
    phase: 'upload' | 'processing' | 'done';
  }>({ percent: 0, phase: 'upload' });
  const [error, setError] = useState('');
  const [target, setTarget] = useState<string>('neighborhood');
  const [neighborhoods, setNeighborhoods] = useState<CascadeNeighborhood[]>([]);
  const [fabrics, setFabrics] = useState<CascadeFabric[]>([]);
  const [place, setPlace] = useState<LinkedPlaceIds>({
    neighborhoodId: '',
    fabricId: '',
    fabricTypeId: '',
  });

  useEffect(() => {
    void apiFetch<CascadeNeighborhood[]>('/gis/neighborhoods', {}).then((r) => {
      if (r.success && Array.isArray(r.data)) setNeighborhoods(r.data);
    });
    void apiFetch<CascadeFabric[]>('/gis/fabrics', {}).then((r) => {
      if (r.success && Array.isArray(r.data)) setFabrics(r.data);
    });
  }, []);

  function onFileChange() {
    const file = inputRef.current?.files?.[0];
    setError('');
    if (!file) {
      setFileName('');
      return;
    }
    if (!isAllowedSpatialFile(file)) {
      setFileName('');
      setError('فرمت پشتیبانی نمی‌شود. GeoJSON، JSON، KML، KMZ یا ZIP (Shapefile) انتخاب کنید.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setFileName(file.name);
  }

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('ابتدا یک فایل از سیستم انتخاب کنید');
      return;
    }
    if (!isAllowedSpatialFile(file)) {
      setError('فرمت فایل نامعتبر است');
      return;
    }

    const targetType = (targetRef.current?.value ?? 'neighborhood') as IngestTargetType;
    const fabricTypeId = place.fabricTypeId;
    const layerId = urbanLayerRef.current?.value;

    if (targetType === IngestTargetType.LAYER && !layerId) {
      setError('لایه شهری مقصد را انتخاب کنید');
      return;
    }
    if (targetType === IngestTargetType.FABRIC && !fabricTypeId) {
      setError('محله و نوع بافت را انتخاب کنید');
      return;
    }

    setBusy(true);
    setUploadProgress({ percent: 0, phase: 'upload' });
    setError('');
    const result = await ingestSpatialFile(file, targetType, {
      fabricTypeId: targetType === IngestTargetType.FABRIC ? fabricTypeId : undefined,
      neighborhoodId: targetType === IngestTargetType.FABRIC ? (place.neighborhoodId || undefined) : undefined,
      layerId: targetType === IngestTargetType.LAYER ? layerId : undefined,
      onProgress: setUploadProgress,
    });
    setBusy(false);
    setUploadProgress({ percent: 0, phase: 'upload' });

    if (result.success) {
      feedback.success('فایل مکانی با موفقیت import شد');
      onSuccess();
      onClose();
    } else {
      setError(result.error?.message ?? 'خطا در آپلود');
      feedback.error(result.error?.message ?? 'خطا در آپلود فایل');
    }
  }

  return (
    <div className="gis-upload-modal" role="dialog" aria-modal="true" aria-labelledby="gis-upload-title">
      <div className="gis-upload-card">
        <h3 id="gis-upload-title">آپلود فایل مکانی</h3>
        <p className="gis-upload-hint">
          از درایوها و پوشه‌های سیستم فایل‌های GeoJSON، KML، KMZ یا Shapefile (ZIP) را انتخاب کنید.
        </p>

        <label className="form-group">
          <span>نوع هدف</span>
          <select
            ref={targetRef}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="neighborhood">محله / منطقه هدف</option>
            <option value="fabric">بافت</option>
            <option value="layer">لایه اطلاعاتی شهری</option>
          </select>
        </label>

        {target === 'fabric' && (
          <LinkedPlaceCascade
            neighborhoods={neighborhoods}
            fabrics={fabrics}
            fabricTypes={fabricTypes}
            value={place}
            onChange={setPlace}
            required
            variant="form"
          />
        )}

        {target === 'layer' && (
          <label className="form-group">
            <span>لایه شهری مقصد</span>
            <select ref={urbanLayerRef} defaultValue="">
              <option value="" disabled>
                انتخاب کنید…
              </option>
              {urbanLayers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {URBAN_LAYER_CATEGORY_LABELS[l.category as UrbanLayerCategory] ?? l.category}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="gis-file-picker">
          <input
            ref={inputRef}
            id="gis-spatial-file"
            type="file"
            accept={ACCEPT}
            onChange={onFileChange}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary gis-import-btn gis-import-btn--compact"
            onClick={() => inputRef.current?.click()}
            title="انتخاب فایل از سیستم"
            aria-label="انتخاب فایل مکانی از سیستم"
          >
            <NavIcon name="upload" size={14} />
          </button>
          <span className="gis-file-name">
            {fileName || 'هنوز فایلی انتخاب نشده'}
          </span>
          <p className="gis-upload-formats muted">
            GeoJSON، KML، KMZ یا ZIP (Shapefile) — مختصات باید WGS84 باشد.
          </p>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="gis-upload-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary gis-import-btn gis-import-btn--compact"
            onClick={handleUpload}
            disabled={busy || !fileName}
            aria-busy={busy || undefined}
          >
            {busy ? (
              <ImportBusyLabel percent={uploadProgress.percent} phase={uploadProgress.phase} />
            ) : (
              <>
                <NavIcon name="upload" size={14} />
                Import
              </>
            )}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
