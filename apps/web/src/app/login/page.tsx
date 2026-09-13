'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  APP_NAME,
  APP_VERSION,
  LOGIN_FIELDS,
  formatCountdownMmSs,
  LOGIN_CONTACT_ADMIN_MESSAGE,
  resolvePostLoginRoute,
  validateLoginInput,
  validateLoginOtpCode,
  validateUserPassword,
} from '@city-manager/shared';
import {
  login,
  verifyLoginOtp,
  resendLoginOtp,
  getProfile,
  forgotPassword,
  resetPassword,
  type LoginOtpChallenge,
} from '@/lib/api';
import { fetchPublicBranding } from '@/lib/admin-api';
import { applyFavicon } from '@/lib/branding-dom';

const DEFAULT_BG = '/images/login-bg.jpg';
const DEFAULT_TAGLINE = 'سامانه مدیر شهر؛ زیرساخت هوشمند بازآفرینی شهری';

type LoginMode = 'login' | 'forgot' | 'reset';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>('login');
  const [resetToken, setResetToken] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState<LoginOtpChallenge | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpCopied, setOtpCopied] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [contactAdmin, setContactAdmin] = useState(false);
  const [resendUntil, setResendUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [brandTitle, setBrandTitle] = useState(APP_NAME);
  const [subtitle, setSubtitle] = useState('ورود به پنل مدیریت');
  const [heroTagline, setHeroTagline] = useState(DEFAULT_TAGLINE);
  const [iconUrl, setIconUrl] = useState('');
  const [markText, setMarkText] = useState('CM');
  const [bgUrl, setBgUrl] = useState(DEFAULT_BG);

  const idField = LOGIN_FIELDS.identifier;
  const passField = LOGIN_FIELDS.password;
  const otpField = LOGIN_FIELDS.otp;
  const lockSec = Math.max(0, Math.ceil((lockUntil - now) / 1000));
  const resendSec = Math.max(0, Math.ceil((resendUntil - now) / 1000));
  const locked = lockSec > 0;
  const loginBlocked = locked;

  useEffect(() => {
    if (!otp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOtp(null);
        setOtpCode('');
        setError('');
        setFieldErrors({});
      }
    };
    window.addEventListener('keydown', onKey);
    const card = document.querySelector('.login-card');
    if (card) card.setAttribute('inert', '');
    const otpInput = document.getElementById('otp') as HTMLInputElement | null;
    otpInput?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      card?.removeAttribute('inert');
    };
  }, [otp]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reset')?.trim() ?? '';
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, []);

  useEffect(() => {
    if (lockUntil <= now && resendUntil <= now) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [lockUntil, resendUntil, now]);

  useEffect(() => {
    fetchPublicBranding().then((res) => {
      if (!res.success || !res.data) return;
      const b = res.data;
      const title = (b.loginTitle || b.title || APP_NAME).trim() || APP_NAME;
      setBrandTitle(title);
      setSubtitle((b.loginSubtitle || 'ورود به پنل مدیریت').trim());
      setHeroTagline((b.loginHeroTagline || DEFAULT_TAGLINE).trim() || DEFAULT_TAGLINE);
      setIconUrl(b.loginIconUrl || b.logoUrl || '');
      setMarkText((b.markText || 'CM').slice(0, 3));
      setBgUrl(b.loginBackgroundUrl || DEFAULT_BG);
      if (b.faviconUrl) applyFavicon(b.faviconUrl);
      document.title = title;
    }).catch(() => {
      /* keep defaults */
    });
  }, []);

  function applyAuthError(err?: { message?: string; retryAfterSec?: number; contactAdmin?: boolean }) {
    if (err?.contactAdmin) setContactAdmin(true);
    if (typeof err?.retryAfterSec === 'number' && err.retryAfterSec > 0) {
      setLockUntil(Date.now() + err.retryAfterSec * 1000);
    }
    if (err?.contactAdmin) {
      setError(LOGIN_CONTACT_ADMIN_MESSAGE);
      return;
    }
    setError(err?.message || 'خطا در ورود');
  }

  function startOtp(challenge: LoginOtpChallenge) {
    setOtp(challenge);
    setOtpCode(challenge.devCode ?? '');
    setResendUntil(Date.now() + Math.max(0, challenge.resendAfterSec ?? 0) * 1000);
  }

  async function finishLogin() {
    const profileRes = await getProfile();
    const landing = profileRes.success && profileRes.data
      ? resolvePostLoginRoute(profileRes.data.roles, profileRes.data.permissions)
      : '/dashboard/today';
    router.push(landing);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loginBlocked) return;
    setError('');
    const local = validateLoginInput({ identifier, password });
    setFieldErrors(local);
    if (Object.keys(local).length) return;

    setLoading(true);
    try {
      const result = await login(identifier.trim(), password);
      if (!result.success || !result.data) {
        applyAuthError(result.error);
        return;
      }
      setContactAdmin(false);
      setLockUntil(0);
      if ('requiresOtp' in result.data && result.data.requiresOtp) {
        startOtp(result.data);
        return;
      }
      await finishLogin();
    } catch {
      setError('ارتباط با سرور برقرار نشد');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || loginBlocked) return;
    setError('');
    const otpErr = validateLoginOtpCode(otpCode);
    if (otpErr) {
      setFieldErrors({ otp: otpErr });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const result = await verifyLoginOtp(otp.challengeId, otpCode);
      if (!result.success) {
        applyAuthError(result.error);
        return;
      }
      setOtp(null);
      setContactAdmin(false);
      setLockUntil(0);
      await finishLogin();
    } catch {
      setError('ارتباط با سرور برقرار نشد');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!otp || resendSec > 0 || loginBlocked) return;
    setError('');
    setLoading(true);
    try {
      const result = await resendLoginOtp(otp.challengeId);
      if (!result.success || !result.data) {
        applyAuthError(result.error);
        return;
      }
      startOtp(result.data);
    } catch {
      setError('ارتباط با سرور برقرار نشد');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!identifier.trim()) {
      setFieldErrors({ identifier: 'شناسه الزامی است' });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const result = await forgotPassword(identifier.trim());
      if (!result.success) {
        setError(result.error?.message ?? 'درخواست بازیابی ناموفق بود');
        return;
      }
      setInfo(result.data?.message ?? 'اگر حسابی وجود داشته باشد، لینک بازیابی ارسال می‌شود.');
    } catch {
      setError('ارتباط با سرور برقرار نشد');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    const pwdErr = validateUserPassword(password, true);
    if (pwdErr) {
      setFieldErrors({ password: pwdErr });
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors({ password: 'تکرار رمز یکسان نیست' });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const result = await resetPassword(resetToken, password);
      if (!result.success) {
        setError(result.error?.message ?? 'تنظیم رمز ناموفق بود');
        return;
      }
      setInfo('رمز جدید ذخیره شد. اکنون وارد شوید.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setResetToken('');
      router.replace('/login');
    } catch {
      setError('ارتباط با سرور برقرار نشد');
    } finally {
      setLoading(false);
    }
  }

  async function copyDevCode() {
    if (!otp?.devCode) return;
    try {
      await navigator.clipboard.writeText(otp.devCode);
      setOtpCopied(true);
      window.setTimeout(() => setOtpCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const lockHint = contactAdmin && (locked || error)
    ? LOGIN_CONTACT_ADMIN_MESSAGE
    : locked
      ? `ورود پس از ۳ تلاش ناموفق مسدود شد. ${formatCountdownMmSs(lockSec)} تا رفع مسدودی.`
      : '';

  return (
    <div
      className="login-page"
      style={{ backgroundImage: `linear-gradient(135deg, rgba(10, 30, 40, 0.62), rgba(8, 24, 32, 0.72)), url(${bgUrl})` }}
    >
      {otp && (
        <div className="login-otp-banner" aria-live="polite">
          <span className="login-otp-banner-label">کد تأیید ارسال شد به</span>
          <strong className="login-otp-banner-phone" dir="ltr">{otp.maskedPhone}</strong>
        </div>
      )}

      {otp && (
        <div
          className="login-otp-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-otp-title"
          aria-describedby="login-otp-desc"
        >
          <div className="login-otp-card">
            <h2 id="login-otp-title">تأیید شماره همراه</h2>
            <p id="login-otp-desc" className="muted login-otp-phone-line">
              کد تأیید به شماره زیر ارسال شد:
            </p>
            <p className="login-otp-phone-masked" dir="ltr" aria-label={`شماره masked ${otp.maskedPhone}`}>
              {otp.maskedPhone}
            </p>
            {otp.devCode && (
              <div className="login-otp-dev" role="status" aria-live="polite">
                <span>حالت توسعه / تست — کد:</span>
                <code dir="ltr">{otp.devCode}</code>
                <button type="button" className="btn btn-sm" onClick={() => void copyDevCode()}>
                  {otpCopied ? 'کپی شد' : 'کپی'}
                </button>
              </div>
            )}
            <form onSubmit={(e) => void handleVerifyOtp(e)} noValidate>
              <div className="form-group">
                <label htmlFor="otp">{otpField.label}</label>
                <input
                  id="otp"
                  inputMode={otpField.inputMode}
                  autoComplete={otpField.autoComplete}
                  placeholder={otpField.placeholder}
                  title={otpField.hint}
                  aria-describedby="otp-hint"
                  aria-invalid={Boolean(fieldErrors.otp)}
                  aria-required="true"
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, otp: '' }));
                  }}
                  required
                  dir={otpField.dir}
                  maxLength={8}
                  disabled={loginBlocked}
                  autoFocus
                />
                <span id="otp-hint" className="field-hint">{otpField.hint}</span>
                {fieldErrors.otp && <p className="error-message" role="alert">{fieldErrors.otp}</p>}
              </div>
              {(error || lockHint) && <p className="error-message" role="alert">{lockHint || error}</p>}
              <p className="login-otp-resend" aria-live="polite">
                {resendSec > 0
                  ? `ارسال مجدد تا ${formatCountdownMmSs(resendSec)} دیگر ممکن نیست.`
                  : 'می‌توانید کد را دوباره ارسال کنید.'}
              </p>
              <div className="login-otp-actions">
                <button type="submit" className="btn btn-primary" disabled={loading || loginBlocked}>
                  {loading ? 'در حال تأیید…' : 'تأیید و ورود'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={loading || resendSec > 0 || loginBlocked}
                  onClick={() => void handleResendOtp()}
                >
                  ارسال مجدد
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() => { setOtp(null); setOtpCode(''); setError(''); setFieldErrors({}); }}
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <p className="login-hero-tagline">{heroTagline}</p>
      <div className="login-card">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className="login-brand-icon" />
        ) : (
          <div className="login-brand-fallback" aria-hidden>{markText}</div>
        )}
        <h1 className="login-card-brand">{brandTitle}</h1>
        <p className="login-card-subtitle">
          {mode === 'forgot' ? 'بازیابی رمز عبور' : mode === 'reset' ? 'تنظیم رمز جدید' : subtitle}
        </p>
        {mode === 'forgot' ? (
          <form onSubmit={(e) => void handleForgot(e)} noValidate>
            <div className="form-group">
              <label htmlFor="identifier">{idField.label}</label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, identifier: '' }));
                }}
                required
                autoComplete={idField.autoComplete}
                dir={idField.dir}
                placeholder={idField.placeholder}
              />
              {fieldErrors.identifier && <p className="error-message">{fieldErrors.identifier}</p>}
            </div>
            {error && <p className="error-message">{error}</p>}
            {info && <p className="admin-toast">{info}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'در حال ارسال…' : 'ارسال لینک بازیابی'}
            </button>
            <button
              type="button"
              className="btn"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => { setMode('login'); setError(''); setInfo(''); }}
            >
              بازگشت به ورود
            </button>
          </form>
        ) : mode === 'reset' ? (
          <form onSubmit={(e) => void handleReset(e)} noValidate>
            <div className="form-group">
              <label htmlFor="password">رمز جدید</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">تکرار رمز جدید</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
              {fieldErrors.password && <p className="error-message">{fieldErrors.password}</p>}
            </div>
            {error && <p className="error-message">{error}</p>}
            {info && <p className="admin-toast">{info}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !resetToken}>
              {loading ? 'در حال ذخیره…' : 'ذخیره رمز جدید'}
            </button>
          </form>
        ) : (
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="form-group">
            <label htmlFor="identifier">{idField.label}</label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setFieldErrors((prev) => ({ ...prev, identifier: '' }));
              }}
              required
              autoComplete={idField.autoComplete}
              dir={idField.dir}
              placeholder={idField.placeholder}
              title={idField.hint}
              aria-describedby="identifier-hint"
              aria-invalid={Boolean(fieldErrors.identifier)}
              disabled={loginBlocked}
            />
            <span id="identifier-hint" className="field-hint">{idField.hint}</span>
            {fieldErrors.identifier && <p className="error-message">{fieldErrors.identifier}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="password">{passField.label}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: '' }));
              }}
              required
              autoComplete={passField.autoComplete}
              placeholder={passField.placeholder}
              title={passField.hint}
              aria-describedby="password-hint"
              aria-invalid={Boolean(fieldErrors.password)}
              disabled={loginBlocked}
            />
            <span id="password-hint" className="field-hint">{passField.hint}</span>
            {fieldErrors.password && <p className="error-message">{fieldErrors.password}</p>}
          </div>
          {error && !otp && <p className="error-message">{lockHint || error}</p>}
          {!error && lockHint && !otp && <p className="error-message">{lockHint}</p>}
          {info && <p className="admin-toast">{info}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || Boolean(otp) || loginBlocked}>
            {loading ? 'در حال ورود...' : locked ? `مسدود تا ${formatCountdownMmSs(lockSec)}` : 'ورود'}
          </button>
          <button
            type="button"
            className="btn"
            style={{ width: '100%', marginTop: '0.5rem' }}
            onClick={() => { setMode('forgot'); setError(''); setInfo(''); setOtp(null); }}
          >
            فراموشی رمز عبور
          </button>
        </form>
        )}
      </div>
      <div className="login-version" title={`نسخه ${APP_VERSION}`}>
        نسخه {APP_VERSION}
      </div>
    </div>
  );
}
