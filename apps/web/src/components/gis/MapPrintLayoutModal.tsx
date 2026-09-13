'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_MAP_PRINT_LAYOUT,
  MapLegendItem,
  MapPrintLayoutSettings,
  PrintFormat,
  PrintPaperId,
  ShareViewKind,
  buildShareViewPath,
} from '@city-manager/shared';
import { composeMapPrintCanvas, ensurePrintFontsReady } from './map-print-compose';
import { absoluteShareUrl, createShareView } from '@/lib/share-api';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/components/ui/Feedback';

const STORAGE_KEY = 'city-manager.map-print-layout';

export type PrintPreviewSource = {
  mapCanvas: HTMLCanvasElement;
  legend: MapLegendItem[];
  latitude: number;
  zoom: number;
  bounds: { west: number; south: number; east: number; north: number };
};

function loadSettings(producer: string): MapPrintLayoutSettings {
  const base = { ...DEFAULT_MAP_PRINT_LAYOUT, producer };
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    return { ...base, ...(JSON.parse(raw) as Partial<MapPrintLayoutSettings>), producer: producer || base.producer };
  } catch {
    return base;
  }
}

function loadLogo(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
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

export function MapPrintLayoutModal({
  format,
  producerDefault,
  previewSource,
  onConfirm,
  onClose,
}: {
  format: PrintFormat;
  producerDefault: string;
  previewSource: PrintPreviewSource | null;
  onConfirm: (settings: MapPrintLayoutSettings, logoFile: File | null) => void;
  onClose: () => void;
}) {
  const { hasAnyPermission } = useAuth();
  const feedback = useFeedback();
  const canShare = hasAnyPermission(['share_views:manage', 'reports:write', 'gis_layers:write']);
  const [settings, setSettings] = useState<MapPrintLayoutSettings>(() => loadSettings(producerDefault));
  const [logoName, setLogoName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busyShare, setBusyShare] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, producer: prev.producer || producerDefault }));
  }, [producerDefault]);

  useEffect(() => {
    if (!previewSource) {
      setPreviewUrl('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          let logo: HTMLImageElement | null = null;
          if (logoFile && settings.showLogo) {
            logo = await loadLogo(logoFile);
          }
          if (cancelled) return;
          await ensurePrintFontsReady();
          if (cancelled) return;
          const canvas = composeMapPrintCanvas({
            mapCanvas: previewSource.mapCanvas,
            settings: { ...settings, dpi: 72 },
            legend: previewSource.legend,
            latitude: previewSource.latitude,
            zoom: previewSource.zoom,
            bounds: previewSource.bounds,
            logo,
            dateLabel: new Date().toLocaleString('fa-IR'),
          });
          if (cancelled) return;
          setPreviewUrl(canvas.toDataURL('image/jpeg', 0.82));
        } catch {
          if (!cancelled) setPreviewUrl('');
        }
      })();
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewSource, settings, logoFile]);

  function patch<K extends keyof MapPrintLayoutSettings>(key: K, value: MapPrintLayoutSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function confirm() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    onConfirm(settings, logoFile);
  }

  async function createReadonlyShare() {
    if (!previewSource) {
      feedback.error('پیش‌نمایش نقشه آماده نیست');
      return;
    }
    setBusyShare(true);
    setShareLink(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      let imageDataUrl = previewUrl;
      if (!imageDataUrl) {
        let logo: HTMLImageElement | null = null;
        if (logoFile && settings.showLogo) logo = await loadLogo(logoFile);
        await ensurePrintFontsReady();
        const canvas = composeMapPrintCanvas({
          mapCanvas: previewSource.mapCanvas,
          settings: { ...settings, dpi: 96 },
          legend: previewSource.legend,
          latitude: previewSource.latitude,
          zoom: previewSource.zoom,
          bounds: previewSource.bounds,
          logo,
          dateLabel: new Date().toLocaleString('fa-IR'),
        });
        imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
      const layerLabels = (previewSource.legend ?? [])
        .map((l) => l.label)
        .filter(Boolean);
      const { west, south, east, north } = previewSource.bounds;
      const res = await createShareView({
        kind: ShareViewKind.MAP,
        title: settings.title || 'نقشه اشتراکی',
        caption: settings.subtitle || settings.description || undefined,
        recipientLabel: settings.producer || undefined,
        expiresInDays: 7,
        snapshot: {
          kind: ShareViewKind.MAP,
          title: settings.title || 'نقشه اشتراکی',
          caption: settings.description || undefined,
          generatedAt: new Date().toISOString(),
          producer: settings.producer || producerDefault,
          organizationLabel: settings.organization || undefined,
          map: {
            layerLabels: layerLabels.length ? layerLabels : ['نمای نقشه'],
            imageDataUrl,
            bbox: [west, south, east, north],
            note: settings.disclaimer || undefined,
            center: {
              lng: (west + east) / 2,
              lat: (south + north) / 2,
            },
            zoom: previewSource.zoom,
          },
        },
      });
      if (!res.success || !res.data) {
        feedback.error(res.error?.message ?? 'ساخت لینک اشتراک ناموفق بود');
        return;
      }
      const url = absoluteShareUrl(res.data.publicPath || buildShareViewPath(res.data.token));
      setShareLink(url);
      try {
        await navigator.clipboard.writeText(url);
        feedback.success('لینک فقط‌خواندنی نقشه ساخته و کپی شد');
      } catch {
        feedback.success('لینک فقط‌خواندنی نقشه ساخته شد');
      }
    } finally {
      setBusyShare(false);
    }
  }

  const formatLabel = format === 'pdf' ? 'PDF' : 'عکس PNG';

  return (
    <div className="gis-upload-modal" role="dialog" aria-modal="true" aria-labelledby="gis-print-title">
      <div className="gis-upload-card gis-print-card">
        <h3 id="gis-print-title">چیدمان خروجی نقشه — {formatLabel}</h3>
        <p className="gis-panel-hint">
          پیش‌نمایش صفحه واقعی با عنوان، نقشه، راهنما و پاورقی است. می‌توانید خروجی فایل بگیرید یا لینک فقط‌خواندنی بسازید.
        </p>

        <div className="gis-print-grid">
          <div className="gis-print-fields">
            <label className="layer-style-field">
              <span>عنوان</span>
              <input value={settings.title} onChange={(e) => patch('title', e.target.value)} />
            </label>
            <label className="layer-style-field">
              <span>زیرعنوان</span>
              <input value={settings.subtitle} onChange={(e) => patch('subtitle', e.target.value)} />
            </label>
            <label className="layer-style-field">
              <span>تهیه‌کننده</span>
              <input value={settings.producer} onChange={(e) => patch('producer', e.target.value)} />
            </label>
            <label className="layer-style-field">
              <span>سازمان / لوگو متنی</span>
              <input value={settings.organization} onChange={(e) => patch('organization', e.target.value)} />
            </label>
            <label className="layer-style-field gis-print-span">
              <span>توضیحات</span>
              <textarea rows={2} value={settings.description} onChange={(e) => patch('description', e.target.value)} />
            </label>
            <label className="layer-style-field gis-print-span">
              <span>سلب مسئولیت</span>
              <textarea rows={2} value={settings.disclaimer} onChange={(e) => patch('disclaimer', e.target.value)} />
            </label>

            <label className="layer-style-field">
              <span>کاغذ</span>
              <select value={settings.paper} onChange={(e) => patch('paper', e.target.value as PrintPaperId)}>
                <option value="a4">A4</option>
                <option value="a3">A3</option>
              </select>
            </label>
            <label className="layer-style-field">
              <span>جهت صفحه</span>
              <select
                value={settings.orientation}
                onChange={(e) => patch('orientation', e.target.value as MapPrintLayoutSettings['orientation'])}
              >
                <option value="landscape">افقی</option>
                <option value="portrait">عمودی</option>
              </select>
            </label>
            <label className="layer-style-field">
              <span>کیفیت (DPI)</span>
              <select value={String(settings.dpi)} onChange={(e) => patch('dpi', Number(e.target.value))}>
                <option value="96">96</option>
                <option value="150">150</option>
                <option value="200">200</option>
              </select>
            </label>
            <label className="layer-style-field">
              <span>لوگوی تهیه‌کننده</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setLogoFile(f);
                  setLogoName(f?.name ?? '');
                }}
              />
              {logoName ? <small className="muted">{logoName}</small> : null}
            </label>
          </div>

          <div className="gis-print-side">
            <div className="gis-print-preview-wrap">
              {previewUrl ? (
                <img
                  className="gis-print-preview-img"
                  src={previewUrl}
                  alt={settings.title || 'پیش‌نمایش نقشه'}
                />
              ) : (
                <div className="gis-print-preview-fallback">در حال ساخت پیش‌نمایش…</div>
              )}
            </div>

            <div className="gis-print-toggles">
              {(
                [
                  ['showNorthArrow', 'جهت‌نمای شمال'],
                  ['showScale', 'مقیاس'],
                  ['showLegend', 'راهنما'],
                  ['showBorder', 'بوردر صفحه'],
                  ['showNeatline', 'قاب محدوده نقشه'],
                  ['showExtent', 'محدوده جغرافیایی'],
                  ['showLogo', 'لوگو'],
                  ['showDate', 'تاریخ'],
                  ['showCrs', 'سامانه مختصات'],
                  ['showProducer', 'تهیه‌کننده'],
                  ['showDisclaimer', 'سلب مسئولیت'],
                ] as Array<[keyof MapPrintLayoutSettings, string]>
              ).map(([key, label]) => (
                <label key={key} className="gis-check">
                  <input
                    type="checkbox"
                    checked={Boolean(settings[key])}
                    onChange={(e) => patch(key, e.target.checked as never)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={confirm}>
            تهیه خروجی {formatLabel}
          </button>
          {canShare && (
            <button
              type="button"
              className="btn"
              disabled={busyShare || !previewSource}
              onClick={() => void createReadonlyShare()}
            >
              {busyShare ? 'در حال ساخت لینک…' : 'اشتراک لینک فقط‌خواندنی'}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>انصراف</button>
        </div>
        {shareLink && (
          <div className="share-created-banner" style={{ marginTop: '0.85rem' }}>
            <strong>لینک آماده</strong>
            <div className="int-ltr-link">
              <a className="int-ltr-link-text" href={shareLink} target="_blank" rel="noreferrer" dir="ltr">{shareLink}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
