'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate } from '@/components/admin/AdminUi';
import { useAuth } from '@/lib/auth';
import { fetchRoles, updateRole, createRole, ROLE_LABELS } from '@/lib/admin-api';
import { PERMISSION_LABELS } from '@city-manager/shared';
import { formatNumber } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';
import { useFeedback } from '@/components/ui/Feedback';

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
};

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selected, setSelected] = useState<RoleRow | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [createForm, setCreateForm] = useState({ code: '', name: '' });
  const { loading, error, setError, run } = useQueryLoad();

  async function load() {
    await run(async () => {
      const res = await fetchRoles();
      if (res.success && res.data) {
        setRoles(res.data as RoleRow[]);
        if (selected) {
          const next = res.data.find((r) => r.id === selected.id);
          if (next) {
            setSelected(next as RoleRow);
            setPerms(next.permissions);
          }
        }
      } else if (!res.success) {
        setError(res.error?.message ?? 'بارگذاری نقش‌ها ناموفق بود');
      }
    });
  }

  useEffect(() => {
    if (hasPermission('roles:read')) load();
  }, [hasPermission]);

  function selectRole(r: RoleRow) {
    setSelected(r);
    setPerms([...r.permissions]);
    setMessage('');
  }

  function togglePerm(p: string) {
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function save() {
    if (!selected) return;
    const res = await updateRole(selected.id, { permissions: perms });
    if (res.success) {
      setMessage('ذخیره شد');
      load();
    } else {
      setMessage(res.error?.message ?? 'خطا');
    }
  }

  async function onCreateRole(e: React.FormEvent) {
    e.preventDefault();
    const code = createForm.code.trim().toLowerCase().replace(/\s+/g, '_');
    const name = createForm.name.trim();
    if (!code || !name) {
      await feedback.alert('کد و نام نقش الزامی است', 'نقش جدید');
      return;
    }
    const res = await createRole({ code, name, permissions: [] });
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ایجاد نقش ناموفق بود', 'نقش جدید');
      return;
    }
    feedback.success('نقش ایجاد شد');
    setCreateForm({ code: '', name: '' });
    void load();
  }

  const allPerms = Object.keys(PERMISSION_LABELS);

  return (
    <AppShell title="نقش‌ها و دسترسی‌ها">
      <PermissionGate allow={hasPermission('roles:read')}>
        <PageHeader
          title="نقش‌ها"
          description="مشاهده و تنظیم مجوزهای هر نقش (RBAC)"
        />

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری نقش‌ها…">
        <div className="admin-two-col roles-layout">
          <div className="card">
            <h3>فهرست نقش‌ها</h3>
            {hasPermission('roles:write') && (
              <form className="roles-create-form" onSubmit={(e) => void onCreateRole(e)} style={{ marginBottom: 16 }}>
                <label className="form-group">
                  <span>کد نقش</span>
                  <input
                    dir="ltr"
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                    placeholder="مثلاً field_lead"
                    required
                  />
                </label>
                <label className="form-group">
                  <span>نام نمایشی</span>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="مثلاً سرپرست میدانی"
                    required
                  />
                </label>
                <button type="submit" className="btn btn-sm btn-primary">ایجاد نقش</button>
              </form>
            )}
            <ul className="role-list">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={selected?.id === r.id ? 'active' : ''}
                    onClick={() => selectRole(r)}
                  >
                    <strong>{r.name || ROLE_LABELS[r.code] || r.code}</strong>
                    <span>{formatNumber(r.permissions.length)} مجوز</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            {!selected ? (
              <p className="muted">یک نقش را انتخاب کنید</p>
            ) : (
              <>
                <div className="card-head">
                  <div>
                    <h3>{selected.name}</h3>
                    <p className="muted">{selected.code} {selected.isSystem ? '· سیستمی' : ''}</p>
                  </div>
                  {hasPermission('roles:write') && selected.code !== 'super_admin' && (
                    <button type="button" className="btn btn-primary" onClick={save}>ذخیره مجوزها</button>
                  )}
                </div>
                {message && <p className="admin-toast">{message}</p>}
                <div className="perm-grid">
                  {allPerms.map((p) => (
                    <label key={p} className="perm-item">
                      <input
                        type="checkbox"
                        checked={perms.includes(p)}
                        disabled={!hasPermission('roles:write') || selected.code === 'super_admin'}
                        onChange={() => togglePerm(p)}
                      />
                      <span>
                        <strong>{PERMISSION_LABELS[p] || p}</strong>
                        <small>{p}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        </QueryState>
      </PermissionGate>
    </AppShell>
  );
}
