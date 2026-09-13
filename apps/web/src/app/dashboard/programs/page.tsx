'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { createProgram, deleteProgram, fetchPrograms } from '@/lib/regeneration-api';
import { REGENERATION_PROGRAM_STATUS_LABELS, RegenerationProgramStatus } from '@city-manager/shared';
import { formatMetric, formatNumber, toPersianDigits } from '@/lib/format';
import { useFeedback } from '@/components/ui/Feedback';
import { useDashboardAccess } from '@/lib/use-dashboard-access';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="regen-section-hint muted">{children}</p>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <span className="settings-field-hint">{children}</span>;
}

function statusTone(status: string): string {
  if (status === RegenerationProgramStatus.ACTIVE) return 'ok';
  if (status === RegenerationProgramStatus.PAUSED) return 'warn';
  if (status === RegenerationProgramStatus.COMPLETED) return 'info';
  return 'off';
}

export default function ProgramsPage() {
  const feedback = useFeedback();
  const { canWrite } = useDashboardAccess('/dashboard/programs');
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ code: '', name: '', description: '', budgetTotal: '' });
  const [busy, setBusy] = useState(false);
  const { loading, error, setError, run } = useQueryLoad();

  async function load() {
    await run(async () => {
      const res = await fetchPrograms();
      if (res.success) setItems((res.data as Record<string, unknown>[]) ?? []);
      else setError(res.error?.message ?? 'بارگذاری برنامه‌ها ناموفق بود');
    });
  }

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => ({
    neighborhoods: items.reduce((s, p) => s + Number(p.neighborhoodCount ?? 0), 0),
    projects: items.reduce((s, p) => s + Number(p.projectCount ?? 0), 0),
    households: items.reduce((s, p) => s + Number(p.householdCount ?? 0), 0),
  }), [items]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      feedback.error('کد و نام برنامه الزامی است');
      return;
    }
    setBusy(true);
    const res = await createProgram({
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      budgetTotal: form.budgetTotal ? Number(form.budgetTotal) : undefined,
      status: RegenerationProgramStatus.ACTIVE,
    });
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ثبت ناموفق');
      return;
    }
    feedback.success('برنامه ثبت شد');
    setForm({ code: '', name: '', description: '', budgetTotal: '' });
    void load();
  }

  async function handleDelete(id: string, name: string) {
    const ok = await feedback.confirm(`برنامه «${name}» حذف شود؟`, 'حذف برنامه');
    if (!ok) return;
    const res = await deleteProgram(id);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'حذف ناموفق');
      return;
    }
    feedback.success('برنامه حذف شد');
    void load();
  }

  return (
    <AppShell title="برنامه‌های بازآفرینی">
      <div className="regen-page regen-programs-page">
        <PageHeader
          title="برنامه‌های بازآفرینی شهری"
          description="مدیریت برنامه، محدوده، پروژه و خانوارهای متأثر"
          actions={
            <div className="regen-header-actions">
              <Link href="/dashboard/neighborhoods" className="btn btn-sm">داشبورد محلات</Link>
              <Link href="/dashboard/map" className="btn btn-sm btn-primary">نقشه GIS</Link>
            </div>
          }
          />

        <section className="card regen-intro">
          <SectionHint>
            <strong>برنامه</strong> چارچوب کلان بازآفرینی است؛ هر برنامه به چند
            {' '}
            <strong>محله</strong> (محدوده) متصل می‌شود و شامل
            {' '}
            <strong>پروژه‌های اجرایی</strong> و
            {' '}
            <strong>خانوارهای متأثر</strong> است.
          </SectionHint>
          <ol className="regen-flow-steps muted">
            <li>ثبت برنامه با کد و بودجه</li>
            <li>اتصال محلات و تعریف پروژه</li>
            <li>پیگیری خانوارها و پیشرفت</li>
          </ol>
        </section>

        <div className="regen-stats regen-stats-bar">
          <div className="regen-stat-card">
            <span>برنامه‌ها</span>
            <strong>{formatNumber(items.length)}</strong>
          </div>
          <div className="regen-stat-card">
            <span>محله تحت پوشش</span>
            <strong>{formatNumber(totals.neighborhoods)}</strong>
          </div>
          <div className="regen-stat-card">
            <span>پروژه اجرایی</span>
            <strong>{formatNumber(totals.projects)}</strong>
          </div>
          <div className="regen-stat-card regen-stat-highlight">
            <span>خانوار متأثر</span>
            <strong>{formatNumber(totals.households)}</strong>
          </div>
        </div>

        <div className={`regen-workspace ${canWrite ? '' : 'regen-workspace--single'}`}>
          {canWrite && (
          <section className="card regen-form-card">
            <div className="card-head">
              <div>
                <h3>برنامه جدید</h3>
                <SectionHint>کد برنامه شناسه کوتاه یکتا برای گزارش و یکپارچه‌سازی است.</SectionHint>
              </div>
            </div>
            <form className="sec-form-rows" onSubmit={(e) => void handleCreate(e)}>
              <label className="settings-field sec-form-row">
                <span className="settings-field-label">کد برنامه *</span>
                <input
                  className="input-ltr"
                  placeholder="REN-1403"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
                <FieldHint>مثلاً REN-1403 یا AHVAZ-NORTH</FieldHint>
              </label>
              <label className="settings-field sec-form-row">
                <span className="settings-field-label">نام برنامه *</span>
                <input
                  placeholder="بازآفرینی بافت فرسوده مرکزی"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label className="settings-field sec-form-row">
                <span className="settings-field-label">بودجه کل (ریال)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="اختیاری"
                  value={form.budgetTotal}
                  onChange={(e) => setForm({ ...form, budgetTotal: e.target.value })}
                />
                <FieldHint>بودجه مصوب کل برنامه — قابل تفکیک در سطح پروژه</FieldHint>
              </label>
              <label className="settings-field sec-form-row">
                <span className="settings-field-label">توضیح</span>
                <textarea
                  rows={2}
                  placeholder="اهداف، محدوده کلی، بازه زمانی…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'در حال ثبت…' : 'ثبت برنامه'}
                </button>
              </div>
            </form>
          </section>
          )}

          <section className="card regen-list-card">
            <div className="card-head">
              <div>
                <h3>فهرست برنامه‌ها</h3>
                <SectionHint>
                  هر کارت خلاصه محدوده (محله)، پروژه و خانوار متأثر را نشان می‌دهد.
                </SectionHint>
              </div>
            </div>

            <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={5} />} loadingLabel="در حال بارگذاری برنامه‌ها…">
            {items.length === 0 ? (
              <EmptyState
                title="برنامه‌ای ثبت نشده"
                description={canWrite ? 'فرم کنار را پر کنید یا از نقشه محله و پروژه اضافه کنید.' : 'برنامه‌ای برای نمایش نیست.'}
              />
            ) : (
              <div className="regen-program-grid">
                {items.map((p) => {
                  const status = String(p.status);
                  return (
                    <article key={String(p.id)} className="regen-program-card">
                      <div className="regen-program-card-head">
                        <div className="regen-program-icon" aria-hidden>
                          <NavIcon name="fabric" size={22} />
                        </div>
                        <div className="regen-program-title-wrap">
                          <strong>{String(p.name)}</strong>
                          <code className="regen-program-code">{toPersianDigits(String(p.code))}</code>
                        </div>
                        <span className={`status-pill ${statusTone(status)}`}>
                          {REGENERATION_PROGRAM_STATUS_LABELS[status as RegenerationProgramStatus] ?? status}
                        </span>
                      </div>

                      {p.description ? (
                        <p className="regen-program-desc muted">{String(p.description)}</p>
                      ) : null}

                      <div className="regen-program-metrics">
                        <div>
                          <span>محله</span>
                          <strong>{formatNumber(Number(p.neighborhoodCount ?? 0))}</strong>
                        </div>
                        <div>
                          <span>پروژه</span>
                          <strong>{formatNumber(Number(p.projectCount ?? 0))}</strong>
                        </div>
                        <div>
                          <span>خانوار</span>
                          <strong>{formatNumber(Number(p.householdCount ?? 0))}</strong>
                        </div>
                        {p.budgetTotal != null && Number(p.budgetTotal) > 0 && (
                          <div className="regen-program-metric-wide">
                            <span>بودجه</span>
                            <strong>{formatMetric(Number(p.budgetTotal), 'ریال')}</strong>
                          </div>
                        )}
                      </div>

                      <div className="regen-program-actions">
                        <Link href={`/dashboard/programs/${String(p.id)}`} className="btn btn-sm btn-primary">
                          جزئیات و پروژه‌ها
                        </Link>
                        {canWrite && (
                        <button
                          type="button"
                          className="btn btn-sm regen-btn-danger"
                          onClick={() => void handleDelete(String(p.id), String(p.name))}
                        >
                          حذف
                        </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            </QueryState>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
