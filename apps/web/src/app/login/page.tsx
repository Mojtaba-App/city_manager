'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  APP_NAME,
  APP_VERSION,
  LOGIN_FIELDS,
  formatCountdownMmSs,
  LOGIN_CONTACT_ADMIN_MESSAGE,
  resolvePostLoginRoute,
  validateIranMobile,
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
  const formId = useId();
  const [mode, setMode] = useState<LoginMode>('login');
  const [resetToken, setResetToken] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devPassword, setDevPassword] = useState('');
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
  const phoneField = LOGIN_FIELDS.phone;
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
    const card = document.querySelector('.md-login-card');
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
      setError('ارتباط با سرور برقرار نشد. چند ثانیه صبر کنید و دوباره وارد شوید.');
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
      setError('ارتباط با سرور برقرار نشد. چند ثانیه صبر کنید و دوباره وارد شوید.');
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
      setError('ارتباط با سرور برقرار نشد. چند ثانیه صبر کنید و دوباره وارد شوید.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setDevPassword('');
    const phoneErr = validateIranMobile(phone, true);
    if (phoneErr) {
      setFieldErrors({ phone: phoneErr });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const result = await forgotPassword(phone.trim());
      if (!result.success) {
        const msg = result.error?.message ?? 'درخواست بازیابی ناموفق بود';
        setError(msg);
        setFieldErrors({ phone: msg });
        return;
      }
      setInfo(result.data?.message ?? 'رمز موقت به شماره همراه شما پیامک شد.');
      if (result.data?.devPassword) setDevPassword(result.data.devPassword);
    } catch {
      setError('ارتباط با سرور برقرار نشد. چند ثانیه صبر کنید و دوباره وارد شوید.');
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
      setError('ارتباط با سرور برقرار نشد. چند ثانیه صبر کنید و دوباره وارد شوید.');
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

  const modeTitle =
    mode === 'forgot' ? 'بازیابی رمز عبور' : mode === 'reset' ? 'تنظیم رمز جدید' : subtitle;

  return (
    <div
      className="md-login-page"
      style={{
        backgroundImage: `linear-gradient(160deg, rgba(15, 23, 42, 0.72), rgba(15, 118, 110, 0.45)), url(${bgUrl})`,
      }}
    >
      {otp && (
        <div
          className="md-login-otp-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-otp-title"
          aria-describedby="login-otp-desc"
        >
          <div className="md-login-otp-card md-elevation-3">
            <h2 id="login-otp-title">تأیید شماره همراه</h2>
            <p id="login-otp-desc" className="md-login-support">
              کد تأیید به شماره زیر ارسال شد
            </p>
            <p className="md-login-phone-masked" dir="ltr">{otp.maskedPhone}</p>
            {otp.devCode && (
              <div className="md-login-dev" role="status" aria-live="polite">
                <span>حالت توسعه — کد:</span>
                <code dir="ltr">{otp.devCode}</code>
                <button type="button" className="md-btn md-btn-text" onClick={() => void copyDevCode()}>
                  {otpCopied ? 'کپی شد' : 'کپی'}
                </button>
              </div>
            )}
            <form onSubmit={(e) => void handleVerifyOtp(e)} noValidate>
              <div className={`md-field${fieldErrors.otp ? ' md-field-error' : ''}`}>
                <input
                  id="otp"
                  className="md-field-input"
                  placeholder=" "
                  inputMode={otpField.inputMode}
                  autoComplete={otpField.autoComplete}
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
                <label htmlFor="otp" className="md-field-label">{otpField.label}</label>
                <span className="md-field-hint">{otpField.hint}</span>
                {fieldErrors.otp && <p className="md-field-error-text" role="alert">{fieldErrors.otp}</p>}
              </div>
              {(error || lockHint) && <p className="md-alert md-alert-error" role="alert">{lockHint || error}</p>}
              <p className="md-login-support" aria-live="polite">
                {resendSec > 0
                  ? `ارسال مجدد تا ${formatCountdownMmSs(resendSec)}`
                  : 'می‌توانید کد را دوباره ارسال کنید'}
              </p>
              <div className="md-login-actions">
                <button type="submit" className="md-btn md-btn-filled" disabled={loading || loginBlocked}>
                  {loading ? 'در حال تأیید…' : 'تأیید و ورود'}
                </button>
                <button
                  type="button"
                  className="md-btn md-btn-outlined"
                  disabled={loading || resendSec > 0 || loginBlocked}
                  onClick={() => void handleResendOtp()}
                >
                  ارسال مجدد
                </button>
                <button
                  type="button"
                  className="md-btn md-btn-text"
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

      <main className="md-login-shell">
        <section className="md-login-card md-elevation-2" aria-labelledby={`${formId}-brand`}>
          <div className="md-login-brand">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt="" className="md-login-brand-icon" />
            ) : (
              <div className="md-login-brand-mark" aria-hidden>{markText}</div>
            )}
            <h1 id={`${formId}-brand`} className="md-login-brand-title">{brandTitle}</h1>
            <p className="md-login-brand-sub">{modeTitle}</p>
            {mode === 'login' && <p className="md-login-tagline">{heroTagline}</p>}
          </div>

          {mode === 'forgot' ? (
            <form onSubmit={(e) => void handleForgot(e)} noValidate className="md-login-form">
              <p className="md-login-support">
                شماره همراه ثبت‌شده در حساب را وارد کنید تا رمز موقت پیامک شود.
              </p>
              <div className={`md-field${fieldErrors.phone ? ' md-field-error' : ''}`}>
                <input
                  id="phone"
                  className="md-field-input"
                  placeholder=" "
                  type="tel"
                  inputMode={phoneField.inputMode}
                  autoComplete={phoneField.autoComplete}
                  dir={phoneField.dir}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  required
                />
                <label htmlFor="phone" className="md-field-label">{phoneField.label}</label>
                <span className="md-field-hint">{phoneField.hint}</span>
                {fieldErrors.phone && <p className="md-field-error-text" role="alert">{fieldErrors.phone}</p>}
              </div>
              {error && <p className="md-alert md-alert-error" role="alert">{error}</p>}
              {info && <p className="md-alert md-alert-info" role="status">{info}</p>}
              {devPassword && (
                <div className="md-login-dev" role="status">
                  <span>حالت توسعه — رمز موقت:</span>
                  <code dir="ltr">{devPassword}</code>
                </div>
              )}
              <div className="md-login-actions">
                <button type="submit" className="md-btn md-btn-filled" disabled={loading}>
                  {loading ? 'در حال ارسال…' : 'ارسال رمز موقت با پیامک'}
                </button>
                <button
                  type="button"
                  className="md-btn md-btn-text"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setInfo('');
                    setDevPassword('');
                    setFieldErrors({});
                  }}
                >
                  بازگشت به ورود
                </button>
              </div>
            </form>
          ) : mode === 'reset' ? (
            <form onSubmit={(e) => void handleReset(e)} noValidate className="md-login-form">
              <div className={`md-field${fieldErrors.password ? ' md-field-error' : ''}`}>
                <input
                  id="password"
                  className="md-field-input"
                  placeholder=" "
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
                <label htmlFor="password" className="md-field-label">رمز جدید</label>
              </div>
              <div className="md-field">
                <input
                  id="confirmPassword"
                  className="md-field-input"
                  placeholder=" "
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <label htmlFor="confirmPassword" className="md-field-label">تکرار رمز جدید</label>
                {fieldErrors.password && <p className="md-field-error-text" role="alert">{fieldErrors.password}</p>}
              </div>
              {error && <p className="md-alert md-alert-error" role="alert">{error}</p>}
              {info && <p className="md-alert md-alert-info" role="status">{info}</p>}
              <button type="submit" className="md-btn md-btn-filled" disabled={loading || !resetToken}>
                {loading ? 'در حال ذخیره…' : 'ذخیره رمز جدید'}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} noValidate className="md-login-form">
              <div className={`md-field${fieldErrors.identifier ? ' md-field-error' : ''}`}>
                <input
                  id="identifier"
                  className="md-field-input"
                  placeholder=" "
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, identifier: '' }));
                  }}
                  required
                  autoComplete={idField.autoComplete}
                  dir={idField.dir}
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  disabled={loginBlocked}
                />
                <label htmlFor="identifier" className="md-field-label">{idField.label}</label>
                {fieldErrors.identifier && (
                  <p className="md-field-error-text" role="alert">{fieldErrors.identifier}</p>
                )}
              </div>

              <div className={`md-field md-field-password${fieldErrors.password ? ' md-field-error' : ''}`}>
                <input
                  id="password"
                  className="md-field-input"
                  placeholder=" "
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  required
                  autoComplete={passField.autoComplete}
                  aria-invalid={Boolean(fieldErrors.password)}
                  disabled={loginBlocked}
                />
                <label htmlFor="password" className="md-field-label">{passField.label}</label>
                <button
                  type="button"
                  className="md-field-trailing"
                  aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? 'مخفی' : 'نمایش'}
                </button>
                {fieldErrors.password && (
                  <p className="md-field-error-text" role="alert">{fieldErrors.password}</p>
                )}
              </div>

              {(error || lockHint) && !otp && (
                <p className="md-alert md-alert-error" role="alert">{lockHint || error}</p>
              )}
              {info && <p className="md-alert md-alert-info" role="status">{info}</p>}

              <div className="md-login-actions">
                <button
                  type="submit"
                  className="md-btn md-btn-filled"
                  disabled={loading || Boolean(otp) || loginBlocked}
                >
                  {loading ? 'در حال ورود…' : locked ? `مسدود تا ${formatCountdownMmSs(lockSec)}` : 'ورود'}
                </button>
                <button
                  type="button"
                  className="md-btn md-btn-text"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setInfo('');
                    setDevPassword('');
                    setOtp(null);
                    setFieldErrors({});
                  }}
                >
                  فراموشی رمز عبور
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      <div className="md-login-version" title={`نسخه ${APP_VERSION}`}>
        v{APP_VERSION}
      </div>
    </div>
  );
}
