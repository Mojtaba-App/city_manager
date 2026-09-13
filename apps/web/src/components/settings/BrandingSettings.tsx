'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NavIcon } from '@/components/NavIcons';
import { useFeedback } from '@/components/ui/Feedback';
import { upsertSetting } from '@/lib/admin-api';
import { APP_NAME } from '@city-manager/shared';
import { applyFavicon, clearFaviconToDefault, optimizeImageFile } from '@/lib/branding-dom';
import { SettingsAccordion } from './SettingsAccordion';

export type OrgBranding = {
  logoUrl?: string;
  markText?: string;
  title?: string;
  subtitle?: string;
  loginTitle?: string;
  loginSubtitle?: string;
  loginHeroTagline?: string;
  loginIconUrl?: string;
  faviconUrl?: string;
  loginBackgroundUrl?: string;
};

const DEFAULT_BG = '/images/login-bg.jpg';
const DEFAULT_TAGLINE = 'سامانه مدیر شهر؛ زیرساخت هوشمند بازآفرینی شهری';
const MAX_ICON_BYTES = 350_000;
const MAX_BG_BYTES = 1_200_000;

export function BrandingSettings({
  initial,
  canWrite,
  onSaved,
}: {
  initial?: OrgBranding | null;
  canWrite: boolean;
  onSaved?: () => void;
}) {
  const feedback = useFeedback();
  const logoRef = useRef<HTMLInputElement>(null);
  const loginIconRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? '');
  const [markText, setMarkText] = useState(initial?.markText ?? 'CM');
  const [title, setTitle] = useState(initial?.title ?? APP_NAME);
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? 'پنل مدیریت');
  const [loginTitle, setLoginTitle] = useState(initial?.loginTitle ?? APP_NAME);
  const [loginSubtitle, setLoginSubtitle] = useState(initial?.loginSubtitle ?? 'ورود به پنل مدیریت');
  const [loginHeroTagline, setLoginHeroTagline] = useState(initial?.loginHeroTagline ?? DEFAULT_TAGLINE);
  const [loginIconUrl, setLoginIconUrl] = useState(initial?.loginIconUrl ?? '');
  const [faviconUrl, setFaviconUrl] = useState(initial?.faviconUrl ?? '');
  const [loginBackgroundUrl, setLoginBackgroundUrl] = useState(initial?.loginBackgroundUrl ?? DEFAULT_BG);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    setLogoUrl(initial?.logoUrl ?? '');
    setMarkText(initial?.markText ?? 'CM');
    setTitle(initial?.title ?? APP_NAME);
    setSubtitle(initial?.subtitle ?? 'پنل مدیریت');
    setLoginTitle(initial?.loginTitle || initial?.title || APP_NAME);
    setLoginSubtitle(initial?.loginSubtitle ?? 'ورود به پنل مدیریت');
    setLoginHeroTagline(initial?.loginHeroTagline || DEFAULT_TAGLINE);
    setLoginIconUrl(initial?.loginIconUrl ?? '');
    setFaviconUrl(initial?.faviconUrl ?? '');
    setLoginBackgroundUrl(initial?.loginBackgroundUrl || DEFAULT_BG);
  }, [initial]);

  const previewIcon = loginIconUrl || logoUrl;
  const previewMark = (markText || 'CM').slice(0, 3);
  const bgPreview = loginBackgroundUrl || DEFAULT_BG;

  const dirtyHint = useMemo(() => {
    if (!initial) return false;
    return (
      (initial.loginTitle || APP_NAME) !== loginTitle
      || (initial.loginSubtitle || 'ورود به پنل مدیریت') !== loginSubtitle
      || (initial.loginHeroTagline || DEFAULT_TAGLINE) !== loginHeroTagline
      || (initial.loginBackgroundUrl || DEFAULT_BG) !== loginBackgroundUrl
      || (initial.faviconUrl || '') !== faviconUrl
      || (initial.loginIconUrl || '') !== loginIconUrl
    );
  }, [initial, loginTitle, loginSubtitle, loginHeroTagline, loginBackgroundUrl, faviconUrl, loginIconUrl]);

  async function onPick(
    file: File | null,
    setter: (v: string) => void,
    kind: 'icon' | 'bg' | 'favicon',
    label: string,
  ) {
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.ico$/i.test(file.name)) {
      await feedback.alert('فقط فایل تصویری مجاز است (PNG، JPG، WebP، SVG یا ICO)', label);
      return;
    }
    const maxBytes = kind === 'bg' ? MAX_BG_BYTES : MAX_ICON_BYTES;
    const maxEdge = kind === 'bg' ? 1920 : kind === 'favicon' ? 256 : 512;
    setUploading(label);
    try {
      const dataUrl = await optimizeImageFile(file, { maxBytes, maxEdge, quality: kind === 'bg' ? 0.78 : 0.88 });
      setter(dataUrl);
      if (kind === 'favicon') applyFavicon(dataUrl);
    } catch (err) {
      await feedback.alert(err instanceof Error ? err.message : 'خواندن فایل ناموفق بود', label);
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!loginTitle.trim()) {
      await feedback.alert('عنوان صفحه ورود الزامی است', 'برند و ورود');
      return;
    }
    setSaving(true);
    const value: OrgBranding = {
      logoUrl: logoUrl || undefined,
      markText: markText.trim() || 'CM',
      title: title.trim() || APP_NAME,
      subtitle: subtitle.trim() || 'پنل مدیریت',
      loginTitle: loginTitle.trim() || APP_NAME,
      loginSubtitle: loginSubtitle.trim() || 'ورود به پنل مدیریت',
      loginHeroTagline: loginHeroTagline.trim() || DEFAULT_TAGLINE,
      loginIconUrl: loginIconUrl || undefined,
      faviconUrl: faviconUrl || undefined,
      loginBackgroundUrl: loginBackgroundUrl || DEFAULT_BG,
    };
    const res = await upsertSetting({
      key: 'org_branding',
      value: value as Record<string, unknown>,
      description: 'لوگو، عنوان، صفحه ورود، پس‌زمینه و favicon مرورگر',
    });
    setSaving(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'خطا', 'ذخیره برند');
      return;
    }
    if (faviconUrl) applyFavicon(faviconUrl);
    else clearFaviconToDefault();
    feedback.success('تنظیمات برند ذخیره شد');
    window.dispatchEvent(new CustomEvent('cm:branding-updated'));
    onSaved?.();
  }

  return (
    <SettingsAccordion
      title="برند، ورود و آیکن مرورگر"
      description="سایدبار، صفحه ورود، تصویر پس‌زمینه و favicon مرورگر"
      icon="org"
    >
      <div className="branding-editor">
        <h4 className="branding-section-title">سایدبار</h4>
        <div className="branding-preview">
          <div className="brand-mark branding-preview-mark">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="لوگو" />
            ) : (
              <span>{previewMark}</span>
            )}
          </div>
          <div className="brand-text">
            <strong>{title || APP_NAME}</strong>
            <span>{subtitle || 'پنل مدیریت'}</span>
          </div>
        </div>

        <div className="settings-form-grid">
          <label className="settings-field">
            <span className="settings-field-label">عنوان سامانه</span>
            <input value={title} disabled={!canWrite} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">زیرعنوان سایدبار</span>
            <input value={subtitle} disabled={!canWrite} onChange={(e) => setSubtitle(e.target.value)} />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">متن کوتاه آیکن</span>
            <input
              value={markText}
              disabled={!canWrite || Boolean(logoUrl)}
              maxLength={3}
              onChange={(e) => setMarkText(e.target.value)}
            />
          </label>
        </div>

        {canWrite && (
          <div className="branding-upload-row">
            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={(e) => void onPick(e.target.files?.[0] ?? null, setLogoUrl, 'icon', 'لوگوی سایدبار')}
            />
            <button type="button" className="btn" disabled={uploading != null} onClick={() => logoRef.current?.click()}>
              <NavIcon name="upload" size={16} /> لوگوی سایدبار
            </button>
            {logoUrl && (
              <button type="button" className="btn" onClick={() => setLogoUrl('')}>حذف لوگو</button>
            )}
          </div>
        )}

        <h4 className="branding-section-title">صفحه ورود</h4>
        <p className="branding-section-hint muted">
          پیش‌نمایش زنده مطابق صفحه واقعی ورود — برند در اولویت، سپس جمله پشتیبان و فرم.
        </p>

        <div
          className="branding-login-preview"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(10, 30, 40, 0.62), rgba(8, 24, 32, 0.72)), url(${bgPreview})`,
          }}
        >
          <p className="branding-login-preview-tagline">{loginHeroTagline || DEFAULT_TAGLINE}</p>
          <div className="branding-login-preview-card">
            {previewIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewIcon} alt="" className="login-brand-icon" />
            ) : (
              <div className="login-brand-fallback" aria-hidden>{previewMark}</div>
            )}
            <strong className="branding-login-preview-brand">{loginTitle || APP_NAME}</strong>
            <span className="branding-login-preview-sub">{loginSubtitle || 'ورود به پنل مدیریت'}</span>
          </div>
        </div>

        <div className="settings-form-grid">
          <label className="settings-field">
            <span className="settings-field-label">نام برند در ورود <em className="req">*</em></span>
            <input
              value={loginTitle}
              disabled={!canWrite}
              required
              onChange={(e) => setLoginTitle(e.target.value)}
              placeholder={APP_NAME}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">جمله زیر عنوان</span>
            <input
              value={loginSubtitle}
              disabled={!canWrite}
              onChange={(e) => setLoginSubtitle(e.target.value)}
              placeholder="ورود به پنل مدیریت"
            />
          </label>
          <label className="settings-field settings-field-span">
            <span className="settings-field-label">جمله روی تصویر پس‌زمینه</span>
            <input
              value={loginHeroTagline}
              disabled={!canWrite}
              onChange={(e) => setLoginHeroTagline(e.target.value)}
              placeholder={DEFAULT_TAGLINE}
            />
          </label>
        </div>

        {canWrite && (
          <div className="branding-upload-row">
            <input
              ref={loginIconRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={(e) => void onPick(e.target.files?.[0] ?? null, setLoginIconUrl, 'icon', 'آیکن ورود')}
            />
            <button type="button" className="btn" disabled={uploading != null} onClick={() => loginIconRef.current?.click()}>
              <NavIcon name="upload" size={16} /> آیکن کارت ورود
            </button>
            {loginIconUrl && (
              <button type="button" className="btn" onClick={() => setLoginIconUrl('')}>حذف آیکن ورود</button>
            )}

            <input
              ref={bgRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => void onPick(e.target.files?.[0] ?? null, setLoginBackgroundUrl, 'bg', 'پس‌زمینه ورود')}
            />
            <button type="button" className="btn" disabled={uploading != null} onClick={() => bgRef.current?.click()}>
              <NavIcon name="upload" size={16} /> تصویر پس‌زمینه ورود
            </button>
            <button type="button" className="btn" onClick={() => setLoginBackgroundUrl(DEFAULT_BG)}>
              بازگشت به تصویر پیش‌فرض
            </button>
          </div>
        )}
        <p className="branding-section-hint muted">
          پس‌زمینه: تا حدود ۱٫۲ مگابایت، پیشنهاد عرض ۱۹۲۰px — آیکن ورود: مربعی تا ۵۱۲px.
          {uploading ? ` در حال بهینه‌سازی «${uploading}»…` : ''}
        </p>

        <h4 className="branding-section-title">آیکن مرورگر (favicon)</h4>
        <div className="branding-favicon-row">
          <div className="branding-tab-mock" title="پیش‌نمایش تب مرورگر">
            {faviconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={faviconUrl} alt="" />
            ) : (
              <span className="branding-tab-mock-fallback">{previewMark.slice(0, 1)}</span>
            )}
            <span>{(loginTitle || title || APP_NAME).slice(0, 28)}</span>
          </div>
          {canWrite && (
            <div className="branding-upload-row">
              <input
                ref={faviconRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
                hidden
                onChange={(e) => void onPick(e.target.files?.[0] ?? null, setFaviconUrl, 'favicon', 'favicon')}
              />
              <button type="button" className="btn" disabled={uploading != null} onClick={() => faviconRef.current?.click()}>
                <NavIcon name="upload" size={16} /> انتخاب favicon
              </button>
              {faviconUrl && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setFaviconUrl('');
                    clearFaviconToDefault();
                  }}
                >
                  حذف
                </button>
              )}
            </div>
          )}
        </div>
        <p className="branding-section-hint muted">پیشنهاد: PNG شفاف ۳۲×۳۲ یا ۶۴×۶۴ — بلافاصله در تب مرورگر اعمال آزمایشی می‌شود.</p>

        {canWrite && (
          <div className="form-actions">
            <button type="button" className="btn btn-primary" disabled={saving || uploading != null} onClick={() => void save()}>
              {saving ? 'در حال ذخیره…' : 'ذخیره برند و ورود'}
            </button>
            {dirtyHint && <span className="muted">تغییرات ذخیره‌نشده دارید</span>}
          </div>
        )}
      </div>
    </SettingsAccordion>
  );
}
