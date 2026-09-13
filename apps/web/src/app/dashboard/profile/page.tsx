'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/admin/AdminUi';
import { useAuth } from '@/lib/auth';
import { changePassword, updateProfile } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/admin-api';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { validateUserPassword } from '@city-manager/shared';

async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 320;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.78);
}

export default function ProfilePage() {
  const { profile, refresh } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName ?? '');
    setLastName(profile.lastName ?? '');
    setJobTitle(profile.jobTitle ?? '');
    setDepartment(profile.department ?? '');
    setBio(profile.bio ?? '');
    setAvatarUrl(profile.avatarUrl ?? null);
  }, [profile]);

  async function onPickAvatar(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('فقط فایل تصویری مجاز است');
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarUrl(dataUrl);
      setError('');
    } catch {
      setError('خطا در پردازش تصویر');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const res = await updateProfile({
      firstName,
      lastName,
      jobTitle,
      department,
      bio,
      avatarUrl: avatarUrl ?? '',
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error?.message ?? 'ذخیره پروفایل ناموفق بود');
      return;
    }
    await refresh();
    setMessage('پروفایل با موفقیت به‌روزرسانی شد');
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwdMessage('');
    setPwdError('');
    const pwdErr = validateUserPassword(newPassword, true);
    if (pwdErr) {
      setPwdError(pwdErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('تکرار رمز جدید یکسان نیست');
      return;
    }
    setPwdSaving(true);
    const res = await changePassword(currentPassword, newPassword);
    setPwdSaving(false);
    if (!res.success) {
      setPwdError(res.error?.message ?? 'تغییر رمز ناموفق بود');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwdMessage('رمز عبور با موفقیت تغییر کرد');
  }

  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.trim() || 'U';
  const roleLabel = profile?.roles.map((r) => ROLE_LABELS[r] || r).join('، ') ?? '—';

  return (
    <AppShell title="پروفایل من">
      <PageHeader
        title="پروفایل کاربری"
        description="اطلاعات هویتی، سمت سازمانی و تصویر پروفایل خود را مدیریت کنید"
      />

      <QueryState
        loading={!profile}
        skeleton={<SkeletonList rows={5} />}
        loadingLabel="در حال بارگذاری پروفایل…"
      >
      <form className="profile-layout" onSubmit={onSubmit}>
        <aside className="card profile-aside">
          <div className="profile-avatar-wrap">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="آواتار" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-fallback">{initials}</div>
            )}
          </div>
          <div className="profile-aside-meta">
            <strong>{firstName} {lastName}</strong>
            <span>{roleLabel}</span>
            <span className="mono">{profile?.email}</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onPickAvatar(e.target.files?.[0])}
          />
          <div className="profile-avatar-actions">
            <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
              انتخاب عکس
            </button>
            {avatarUrl && (
              <button type="button" className="btn" onClick={() => setAvatarUrl(null)}>
                حذف عکس
              </button>
            )}
          </div>
          <p className="muted profile-hint">تصویر مربعی، حداکثر حدود ۳۲۰px — مناسب کارت شناسایی و پنل مدیریت</p>
        </aside>

        <div className="card profile-form-card">
          <h3>اطلاعات پایه</h3>
          <div className="form-grid">
            <label className="form-group">
              <span>نام</span>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="form-group">
              <span>نام خانوادگی</span>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label className="form-group">
              <span>ایمیل</span>
              <input value={profile?.email ?? ''} disabled aria-describedby="profile-email-hint" />
              <span id="profile-email-hint" className="field-hint">ایمیل فقط‌خواندنی است؛ برای تغییر با مدیر سیستم تماس بگیرید.</span>
            </label>
            <label className="form-group">
              <span>شماره همراه</span>
              <input value={profile?.phone ?? ''} disabled placeholder="—" aria-describedby="profile-phone-hint" />
              <span id="profile-phone-hint" className="field-hint">شماره فقط‌خواندنی است؛ درخواست تغییر تماس را از مدیر پیگیری کنید.</span>
            </label>
          </div>

          <h3 className="profile-section-title">سمت در پروژه بازآفرینی</h3>
          <div className="form-grid">
            <label className="form-group">
              <span>سمت / نقش اجرایی</span>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="مثلاً مدیر سیستم، کارشناس GIS، تسهیلگر محله"
              />
            </label>
            <label className="form-group">
              <span>واحد / حوزه</span>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="مثلاً ستاد بازآفرینی، حوزه داده‌ها، امنیت"
              />
            </label>
            <label className="form-group form-full">
              <span>درباره من</span>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="توضیح کوتاه درباره مسئولیت و حوزه فعالیت در سامانه"
              />
            </label>
          </div>

          {error && <p className="error-message">{error}</p>}
          {message && <p className="admin-toast">{message}</p>}

          <div className="wizard-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'در حال ذخیره…' : 'ذخیره پروفایل'}
            </button>
          </div>
        </div>
      </form>

      <form className="card profile-form-card" onSubmit={(e) => void onChangePassword(e)} style={{ marginTop: '1rem' }}>
        <h3>تغییر رمز عبور</h3>
        <div className="form-grid">
          <label className="form-group">
            <span>رمز فعلی</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="form-group">
            <span>رمز جدید</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="form-group">
            <span>تکرار رمز جدید</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        </div>
        {pwdError && <p className="error-message">{pwdError}</p>}
        {pwdMessage && <p className="admin-toast">{pwdMessage}</p>}
        <div className="wizard-actions">
          <button type="submit" className="btn btn-primary" disabled={pwdSaving}>
            {pwdSaving ? 'در حال ذخیره…' : 'تغییر رمز'}
          </button>
        </div>
      </form>
      </QueryState>
    </AppShell>
  );
}
