'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate, EmptyState } from '@/components/admin/AdminUi';
import { UserAccountReasonDialog } from '@/components/admin/UserAccountReasonDialog';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/components/ui/Feedback';
import {
  fetchAdminUsers, fetchAdminUser, createAdminUser, updateAdminUser, deleteAdminUser, fetchRoles, ROLE_LABELS,
} from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';
import { validateAdminUserInput, ADMIN_USER_FIELDS, FIELD_USER_SEARCH, type PresenceSnapshot } from '@city-manager/shared';
import { usePresenceStream } from '@/lib/use-presence-stream';
import { OnlineIndicator } from '@/components/ui/OnlineIndicator';

type UserRow = {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  roles: string[];
  roleIds?: string[];
  lastLoginAt?: string;
};

const emptyForm = {
  email: '', username: '', password: '', firstName: '', lastName: '', phone: '', roleIds: [] as string[],
};

export default function UsersPage() {
  return (
    <AppShell title="مدیریت کاربران">
      <Suspense fallback={<SkeletonList rows={6} />}>
        <UsersPageContent />
      </Suspense>
    </AppShell>
  );
}

function UsersPageContent() {
  const { hasPermission, profile } = useAuth();
  const feedback = useFeedback();
  const searchParams = useSearchParams();
  const editFromUrl = searchParams.get('edit');
  const openedEditRef = useRef<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const pageSize = 20;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const { loading, error, setError, run } = useQueryLoad();
  const [form, setForm] = useState(emptyForm);
  const canWrite = hasPermission('users:write');
  const canDelete = hasPermission('users:delete');
  const [reasonDialog, setReasonDialog] = useState<{
    user: UserRow;
    mode: 'deactivate' | 'delete';
  } | null>(null);
  const [reasonBusy, setReasonBusy] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceSnapshot>>({});
  const canReadUsers = hasPermission('users:read');
  const watchedUserIds = users.map((u) => u.id);

  usePresenceStream(watchedUserIds, canReadUsers && watchedUserIds.length > 0, {
    onSnapshot: setPresenceMap,
    onPresence: (snap) => setPresenceMap((prev) => ({ ...prev, [snap.userId]: snap })),
  });

  async function load(q = search, p = page) {
    await run(async () => {
      const res = await fetchAdminUsers(p, q, pageSize);
      if (res.success && res.data) {
        setUsers(res.data as UserRow[]);
        setTotal(res.meta?.total ?? res.data.length);
      } else if (!res.success) setError(res.error?.message ?? 'بارگذاری کاربران ناموفق بود');
    });
  }

  useEffect(() => {
    if (!canReadUsers) return;
    const delay = search.trim() ? 300 : 0;
    const id = window.setTimeout(() => { void load(search, page); }, delay);
    return () => window.clearTimeout(id);
  }, [canReadUsers, search, page]);

  useEffect(() => {
    if (!hasPermission('roles:read')) return;
    fetchRoles().then((r) => {
      if (r.success && r.data) setRoles(r.data.map((x) => ({ id: x.id, code: x.code, name: x.name })));
    });
  }, [hasPermission]);

  useEffect(() => {
    if (!editFromUrl || !hasPermission('users:read')) return;
    if (openedEditRef.current === editFromUrl) return;
    openedEditRef.current = editFromUrl;
    let cancelled = false;
    void fetchAdminUser(editFromUrl).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      const u = res.data;
      openEdit({
        id: u.id,
        email: u.email,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        isActive: u.isActive,
        roles: u.roles,
        roleIds: u.roleIds,
        lastLoginAt: u.lastLoginAt,
      });
    });
    return () => { cancelled = true; };
  }, [editFromUrl, hasPermission]);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError('');
    setForm(emptyForm);
    setShowPassword(false);
  }

  function openCreate() {
    if (showForm && !editingId) {
      closeForm();
      return;
    }
    setEditingId(null);
    setFormError('');
    setForm(emptyForm);
    setShowPassword(false);
    setShowForm(true);
  }

  function openEdit(u: UserRow) {
    setEditingId(u.id);
    setFormError('');
    setShowPassword(false);
    setForm({
      email: u.email,
      username: u.username ?? '',
      password: '',
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone ?? '',
      roleIds: u.roleIds?.length
        ? u.roleIds
        : roles.filter((r) => u.roles.includes(r.code)).map((r) => r.id),
    });
    setShowForm(true);
  }

  function toggleRole(id: string) {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(id)
        ? prev.roleIds.filter((x) => x !== id)
        : [...prev.roleIds, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mode = editingId ? 'update' : 'create';
    const errors = validateAdminUserInput({
      email: form.email,
      username: form.username,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
    }, mode);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      setFormError(firstError);
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      const phone = form.phone.trim() || undefined;
      const username = form.username.trim() || undefined;
      const res = editingId
        ? await updateAdminUser(editingId, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone,
            username,
            ...(form.password.trim() ? { password: form.password } : {}),
            ...(roles.length ? { roleIds: form.roleIds } : {}),
          })
        : await createAdminUser({
            email: form.email.trim(),
            username,
            password: form.password,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone,
            roleIds: form.roleIds,
          });
      if (!res.success) {
        setFormError(res.error?.message ?? (editingId ? 'ذخیره ناموفق بود' : 'خطا در ایجاد کاربر'));
        return;
      }
      feedback.success(editingId ? 'تغییرات کاربر ذخیره شد' : 'کاربر ایجاد شد');
      closeForm();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const next = !u.isActive;
    if (u.id === profile?.id && !next) {
      feedback.error('نمی‌توانید حساب خود را غیرفعال کنید');
      return;
    }
    if (next) {
      const name = `${u.firstName} ${u.lastName}`.trim() || u.email;
      const ok = await feedback.confirm(
        `حساب «${name}» فعال شود؟`,
        'فعال‌سازی کاربر',
        { confirmLabel: 'فعال شود' },
      );
      if (!ok) return;
      setBusyUserId(u.id);
      try {
        const res = await updateAdminUser(u.id, { isActive: true });
        if (!res.success) {
          feedback.error(res.error?.message ?? 'فعال‌سازی ناموفق بود');
          return;
        }
        feedback.success('کاربر فعال شد');
        await load();
      } finally {
        setBusyUserId(null);
      }
      return;
    }
    setReasonDialog({ user: u, mode: 'deactivate' });
  }

  function requestDelete(u: UserRow) {
    if (u.id === profile?.id) {
      feedback.error('نمی‌توانید حساب خود را حذف کنید');
      return;
    }
    setReasonDialog({ user: u, mode: 'delete' });
  }

  async function confirmReasonAction(reason: string) {
    if (!reasonDialog) return;
    const { user, mode } = reasonDialog;
    setReasonBusy(true);
    setBusyUserId(user.id);
    try {
      const res = mode === 'delete'
        ? await deleteAdminUser(user.id, reason)
        : await updateAdminUser(user.id, { isActive: false, inactiveReason: reason });
      if (!res.success) {
        feedback.error(res.error?.message ?? 'عملیات ناموفق بود');
        return;
      }
      feedback.success(mode === 'delete' ? 'کاربر حذف شد' : 'کاربر غیرفعال شد');
      setReasonDialog(null);
      await load();
    } finally {
      setReasonBusy(false);
      setBusyUserId(null);
    }
  }

  const reasonTargetName = reasonDialog
    ? `${reasonDialog.user.firstName} ${reasonDialog.user.lastName}`.trim() || reasonDialog.user.email
    : '';

  return (
    <PermissionGate allow={hasPermission('users:read')}>
        <UserAccountReasonDialog
          open={Boolean(reasonDialog)}
          title={reasonDialog?.mode === 'delete' ? 'حذف کاربر' : 'غیرفعال‌سازی کاربر'}
          message={
            reasonDialog?.mode === 'delete'
              ? `حساب «${reasonTargetName}» حذف (بایگانی) شود؟ دلیل را انتخاب یا وارد کنید.`
              : `حساب «${reasonTargetName}» غیرفعال شود؟ ورود تا فعال‌سازی مجدد ممکن نخواهد بود.`
          }
          confirmLabel={reasonDialog?.mode === 'delete' ? 'حذف کاربر' : 'غیرفعال شود'}
          danger
          busy={reasonBusy}
          onCancel={() => !reasonBusy && setReasonDialog(null)}
          onConfirm={confirmReasonAction}
        />
        <PageHeader
          title="کاربران"
          description="ایجاد، فعال/غیرفعال‌سازی و تخصیص نقش"
          actions={
            canWrite ? (
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                {showForm && !editingId ? 'بستن فرم' : '+ کاربر جدید'}
              </button>
            ) : undefined
          }
        />

        <div className="admin-toolbar card">
          <input
            placeholder={FIELD_USER_SEARCH.placeholder}
            aria-label={FIELD_USER_SEARCH.label}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {showForm && (
          <form className="card form-grid" onSubmit={submit}>
            {formError && <p className="error-message form-full">{formError}</p>}
            <label className="form-group">
              <span>{ADMIN_USER_FIELDS.email.label}</span>
              <input
                type="email"
                required={!editingId}
                disabled={!!editingId}
                dir={ADMIN_USER_FIELDS.email.dir}
                autoComplete={ADMIN_USER_FIELDS.email.autoComplete}
                placeholder={ADMIN_USER_FIELDS.email.placeholder}
                title={ADMIN_USER_FIELDS.email.hint}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {ADMIN_USER_FIELDS.email.hint && <span className="field-hint">{ADMIN_USER_FIELDS.email.hint}</span>}
            </label>
            <label className="form-group">
              <span>{ADMIN_USER_FIELDS.username.label}</span>
              <input
                dir={ADMIN_USER_FIELDS.username.dir}
                autoComplete="off"
                placeholder={ADMIN_USER_FIELDS.username.placeholder}
                title={ADMIN_USER_FIELDS.username.hint}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              {ADMIN_USER_FIELDS.username.hint && <span className="field-hint">{ADMIN_USER_FIELDS.username.hint}</span>}
            </label>
            <label className="form-group">
              <span>{editingId ? ADMIN_USER_FIELDS.passwordOptional.label : ADMIN_USER_FIELDS.password.label}</span>
              <div className="password-field-row">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!editingId}
                  minLength={editingId ? undefined : 8}
                  autoComplete="new-password"
                  placeholder={editingId ? ADMIN_USER_FIELDS.passwordOptional.placeholder : ADMIN_USER_FIELDS.password.placeholder}
                  title={editingId ? ADMIN_USER_FIELDS.passwordOptional.hint : ADMIN_USER_FIELDS.password.hint}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'مخفی' : 'نمایش'}
                </button>
              </div>
              <PasswordStrengthMeter
                password={form.password}
                showGenerator
                onGenerated={(value) => {
                  setForm((prev) => ({ ...prev, password: value }));
                  setShowPassword(true);
                }}
              />
            </label>
            <label className="form-group">
              <span>{ADMIN_USER_FIELDS.firstName.label}</span>
              <input
                required
                placeholder={ADMIN_USER_FIELDS.firstName.placeholder}
                autoComplete={ADMIN_USER_FIELDS.firstName.autoComplete}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </label>
            <label className="form-group">
              <span>{ADMIN_USER_FIELDS.lastName.label}</span>
              <input
                required
                placeholder={ADMIN_USER_FIELDS.lastName.placeholder}
                autoComplete={ADMIN_USER_FIELDS.lastName.autoComplete}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </label>
            <label className="form-group">
              <span>{ADMIN_USER_FIELDS.phone.label}</span>
              <input
                inputMode={ADMIN_USER_FIELDS.phone.inputMode}
                dir={ADMIN_USER_FIELDS.phone.dir}
                autoComplete={ADMIN_USER_FIELDS.phone.autoComplete}
                placeholder={ADMIN_USER_FIELDS.phone.placeholder}
                title={ADMIN_USER_FIELDS.phone.hint}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              {ADMIN_USER_FIELDS.phone.hint && <span className="field-hint">{ADMIN_USER_FIELDS.phone.hint}</span>}
            </label>
            <fieldset className="form-group form-full">
              <legend>نقش‌ها</legend>
              {roles.length === 0 ? (
                <p className="muted">فهرست نقش‌ها در دسترس نیست</p>
              ) : (
                <div className="perm-grid">
                  {roles.map((r) => (
                    <label key={r.id} className="perm-item">
                      <input
                        type="checkbox"
                        checked={form.roleIds.includes(r.id)}
                        onChange={() => toggleRole(r.id)}
                      />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <div className="form-full" style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'در حال ذخیره…' : editingId ? 'ذخیره تغییرات' : 'ایجاد کاربر'}
              </button>
              <button type="button" className="btn" onClick={closeForm} disabled={busy}>انصراف</button>
            </div>
          </form>
        )}

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری کاربران…">
        <div className="card">
          {users.length === 0 ? (
            <EmptyState title="کاربری یافت نشد" />
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>نام</th>
                  <th>ایمیل</th>
                  <th>نام کاربری</th>
                  <th>شماره همراه</th>
                  <th>نقش‌ها</th>
                  <th>وضعیت</th>
                  <th>آخرین ورود</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={editingId === u.id ? 'row-active' : undefined}>
                    <td>
                      <span className="user-name-with-presence">
                        <OnlineIndicator presence={presenceMap[u.id]} size="sm" />
                        <span>{u.firstName} {u.lastName}</span>
                      </span>
                    </td>
                    <td>{u.email}</td>
                    <td dir="ltr">{u.username || '—'}</td>
                    <td dir="ltr">{u.phone?.trim() ? u.phone : '—'}</td>
                    <td>{u.roles.map((r) => ROLE_LABELS[r] || r).join('، ') || '—'}</td>
                    <td>
                      <span className={`status-pill ${u.isActive ? 'ok' : 'off'}`}>
                        {u.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td>{formatDate(u.lastLoginAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <Link href={`/dashboard/users/${u.id}`} className="btn btn-sm">
                          پروفایل
                        </Link>
                        {canWrite && (
                          <>
                            <button type="button" className="btn btn-sm" onClick={() => openEdit(u)}>
                              ویرایش
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busyUserId === u.id || (u.id === profile?.id && u.isActive)}
                              title={u.id === profile?.id && u.isActive ? 'نمی‌توانید حساب خود را غیرفعال کنید' : undefined}
                              onClick={() => toggleActive(u)}
                            >
                              {u.isActive ? 'غیرفعال' : 'فعال‌سازی'}
                            </button>
                            {canDelete && u.isActive && (
                              <button
                                type="button"
                                className="btn btn-sm regen-btn-danger"
                                disabled={busyUserId === u.id || u.id === profile?.id}
                                onClick={() => requestDelete(u)}
                              >
                                حذف
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > pageSize && (
            <div className="table-pagination" role="navigation" aria-label="صفحه‌بندی کاربران">
              <button
                type="button"
                className="btn btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                قبلی
              </button>
              <span className="muted">
                صفحه {page} از {Math.max(1, Math.ceil(total / pageSize))}
                {' '}
                ({total} کاربر)
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page >= Math.ceil(total / pageSize) || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </button>
            </div>
          )}
        </div>
        </QueryState>
      </PermissionGate>
  );
}
