'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate, EmptyState } from '@/components/admin/AdminUi';
import { useAuth } from '@/lib/auth';
import { fetchReports, fetchHouseholdStatusReport, fetchReportTemplates, registerReportTemplate } from '@/lib/admin-api';
import {
  createReportSchedule,
  deleteReportSchedule,
  downloadReportCsv,
  downloadReportPdf,
  fetchReportSchedules,
  runReport,
  toggleReportSchedule,
} from '@/lib/regeneration-api';
import { formatDateTime, formatNumber } from '@/lib/format';
import {
  DEFAULT_REPORTS,
  HOUSEHOLD_STATUS_FILTER_LABELS,
  REPORT_SCHEDULE_FREQUENCY_LABELS,
  ReportDefinition,
  ReportRunResult,
  ReportScheduleFrequency,
  firstQueryFailure,
} from '@city-manager/shared';
import { useFeedback } from '@/components/ui/Feedback';
import { LoadingOverlay, LoadingButton } from '@/components/ui/LoadingSpinner';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

const CATEGORY_LABEL: Record<string, string> = {
  household: 'خانوار',
  gis: 'نقشه و GIS',
  trajectory: 'خط سیر',
  ops: 'عملیات',
};

const STATUS_LABEL: Record<string, string> = {
  ...HOUSEHOLD_STATUS_FILTER_LABELS,
  archived: 'بایگانی',
};

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="reports-section-hint muted">{children}</p>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <span className="settings-field-hint">{children}</span>;
}

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const canWrite = hasPermission('reports:write');
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [statusData, setStatusData] = useState<Array<{ status: string; count: number }>>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<ReportRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [exportingCode, setExportingCode] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<ReportDefinition[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    reportCode: DEFAULT_REPORTS[0]?.code ?? '',
    frequency: ReportScheduleFrequency.WEEKLY,
    isEnabled: true,
  });
  const { loading, error, setError, run } = useQueryLoad();

  const catalog = reports.length ? reports : [...DEFAULT_REPORTS];

  function reportTitle(code: string): string {
    return catalog.find((r) => r.code === code)?.title ?? code;
  }

  async function loadSchedules() {
    const res = await fetchReportSchedules();
    if (res.success && res.data) setSchedules(res.data as Array<Record<string, unknown>>);
    return res;
  }

  useEffect(() => {
    if (!hasPermission('reports:read')) return;
    void run(async () => {
      const [catalogRes, statusRes, schedulesRes, templatesRes] = await Promise.all([
        fetchReports(),
        fetchHouseholdStatusReport(),
        fetchReportSchedules(),
        canWrite ? fetchReportTemplates() : Promise.resolve({ success: true as const, data: [] as ReportDefinition[] }),
      ]);
      if (catalogRes.success && catalogRes.data) setReports(catalogRes.data);
      else setReports([...DEFAULT_REPORTS]);
      if (statusRes.success && statusRes.data) setStatusData(statusRes.data);
      if (schedulesRes.success && schedulesRes.data) {
        setSchedules(schedulesRes.data as Array<Record<string, unknown>>);
      }
      if (templatesRes.success && templatesRes.data) setTemplates(templatesRes.data);
      const fail = firstQueryFailure([statusRes, schedulesRes]);
      if (fail) setError(fail);
    });
  }, [hasPermission, run, setError]);

  async function handleRun(code: string) {
    setRunning(true);
    setActiveCode(code);
    const res = await runReport(code);
    setRunning(false);
    if (!res.success || !res.data) {
      feedback.error(res.error?.message ?? 'اجرای گزارش ناموفق');
      setRunResult(null);
      return;
    }
    setRunResult(res.data);
  }

  async function handleExport(code: string) {
    setExportingCode(code);
    const res = await downloadReportCsv(code);
    setExportingCode(null);
    if (!res.success) feedback.error(res.error?.message ?? 'خروجی CSV ناموفق');
    else feedback.success('فایل CSV دریافت شد');
  }

  async function handleExportPdf(code: string) {
    setExportingCode(`pdf:${code}`);
    const res = await downloadReportPdf(code);
    setExportingCode(null);
    if (!res.success) feedback.error(res.error?.message ?? 'خروجی PDF ناموفق');
    else feedback.success('فایل PDF دریافت شد');
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleForm.reportCode) return;
    const report = catalog.find((r) => r.code === scheduleForm.reportCode);
    const res = await createReportSchedule({
      ...scheduleForm,
      title: report?.title ?? scheduleForm.reportCode,
    });
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ثبت زمان‌بندی ناموفق');
      return;
    }
    feedback.success('زمان‌بندی ثبت شد');
    void loadSchedules();
  }

  const max = Math.max(...statusData.map((s) => s.count), 1);

  return (
    <AppShell title="مدیریت گزارش‌ها">
      <LoadingOverlay
        open={running || exportingCode != null}
        label={exportingCode ? 'در حال آماده‌سازی فایل CSV…' : 'در حال اجرای گزارش…'}
        hint="پردازش داده‌ها ممکن است چند لحظه طول بکشد"
      />
      <PermissionGate allow={hasPermission('reports:read')}>
        <PageHeader
          title="استودیو گزارش"
          description="اجرای گزارش، خروجی CSV و زمان‌بندی خودکار"
          actions={
            <a href="/dashboard/analytics" className="btn btn-primary">داشبورد تحلیلی</a>
          }
        />

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری گزارش‌ها…">
        {statusData.length > 0 && (
          <section className="card reports-overview">
            <div className="card-head reports-overview-head">
              <div>
                <h3>نمای سریع — خانوار بر اساس وضعیت</h3>
                <SectionHint>
                  خلاصه آماری پرونده‌ها؛ برای تحلیل عمیق‌تر از داشبورد تحلیلی استفاده کنید.
                </SectionHint>
              </div>
            </div>
            <div className="report-bars">
              {statusData.map((s) => (
                <div key={s.status} className="report-bar-row">
                  <span>{STATUS_LABEL[s.status] ?? s.status}</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${(s.count / max) * 100}%` }} />
                  </div>
                  <strong>{formatNumber(s.count)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="reports-workspace">
          <section className="card reports-catalog">
            <div className="card-head">
              <div>
                <h3>کاتالوگ گزارش‌ها</h3>
                <SectionHint>
                  هر گزارش یک <strong>کد</strong> فنی دارد که در API و زمان‌بندی استفاده می‌شود.
                </SectionHint>
              </div>
            </div>
            {canWrite && templates.length > 0 && (
              <div className="reports-templates">
                <p className="muted">قالب‌های قابل افزودن به کاتالوگ</p>
                <ul className="reports-template-list">
                  {templates.map((t) => (
                    <li key={t.code}>
                      <span>{t.title}</span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={async () => {
                          const res = await registerReportTemplate(t.code);
                          if (!res.success) {
                            feedback.error(res.error?.message ?? 'ثبت قالب ناموفق');
                            return;
                          }
                          feedback.success(`گزارش «${t.title}» به کاتالوگ اضافه شد`);
                          const next = await fetchReports();
                          if (next.success && next.data) setReports(next.data);
                          setTemplates((prev) => prev.filter((x) => x.code !== t.code));
                        }}
                      >
                        افزودن
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {catalog.length === 0 ? (
              <EmptyState title="گزارشی تعریف نشده" />
            ) : (
              <ul className="reports-catalog-list">
                {catalog.map((r) => (
                  <li
                    key={r.id}
                    className={`reports-catalog-item ${activeCode === r.code ? 'active' : ''}`}
                  >
                    <div className="reports-catalog-main">
                      <strong>{r.title}</strong>
                      <p className="muted">{r.description}</p>
                      <div className="reports-catalog-meta">
                        <span className="status-pill info">{CATEGORY_LABEL[r.category] || r.category}</span>
                        <code className="reports-code" title="کد فنی گزارش">{r.code}</code>
                      </div>
                    </div>
                    <div className="reports-catalog-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={running}
                        onClick={() => void handleRun(r.code)}
                      >
                        {running && activeCode === r.code ? 'در حال اجرا…' : 'اجرای گزارش'}
                      </button>
                      <LoadingButton
                        className="btn btn-sm"
                        loading={exportingCode === r.code}
                        loadingLabel="در حال خروجی…"
                        disabled={running || (exportingCode != null && exportingCode !== r.code)}
                        onClick={() => void handleExport(r.code)}
                        title="خروجی CSV — مناسب Excel"
                      >
                        خروجی CSV
                      </LoadingButton>
                      <LoadingButton
                        className="btn btn-sm"
                        loading={exportingCode === `pdf:${r.code}`}
                        loadingLabel="در حال PDF…"
                        disabled={running || (exportingCode != null && exportingCode !== `pdf:${r.code}`)}
                        onClick={() => void handleExportPdf(r.code)}
                        title="خروجی PDF باینری"
                      >
                        خروجی PDF
                      </LoadingButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <SectionHint>
              <strong>CSV</strong> (Comma-Separated Values): فایل جدولی متنی برای Excel، Power BI یا سامانه‌های دیگر.
              {' '}
              <strong>اجرا</strong> پیش‌نمایش زنده در همین صفحه است؛ برای فایل از CSV استفاده کنید.
            </SectionHint>
          </section>

          <section className="card reports-result">
            <div className="card-head">
              <div>
                <h3>نتیجه اجرا</h3>
                <SectionHint>
                  پس از «اجرای گزارش»، ردیف‌ها و ستون‌ها اینجا نمایش داده می‌شوند.
                </SectionHint>
              </div>
            </div>
            {!runResult ? (
              <div className="reports-result-empty">
                <p className="muted">هنوز گزارشی اجرا نشده است.</p>
                <p className="muted">از کاتالوگ سمت راست، «اجرای گزارش» را بزنید.</p>
              </div>
            ) : (
              <>
                <div className="reports-result-meta">
                  <strong>{runResult.title}</strong>
                  <span className="muted">زمان تولید: {formatDateTime(runResult.generatedAt)}</span>
                  <span className="muted">{formatNumber(runResult.rows.length)} ردیف</span>
                </div>
                <div className="ops-table-wrap">
                  <table className="case-table">
                    <thead>
                      <tr>{runResult.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {runResult.rows.length === 0 ? (
                        <tr><td colSpan={runResult.columns.length} className="muted">بدون داده</td></tr>
                      ) : runResult.rows.map((row, i) => (
                        <tr key={i}>
                          {runResult.columns.map((c) => (
                            <td key={c.key}>{String(row[c.key] ?? '—')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>

        {canWrite && (
          <section className="card reports-schedule">
            <div className="card-head">
              <div>
                <h3>زمان‌بندی خودکار</h3>
                <SectionHint>
                  سامانه در بازه‌های مشخص (روزانه، هفتگی، ماهانه) گزارش را اجرا و آماده می‌کند —
                  بدون نیاز به ورود دستی هر بار.
                </SectionHint>
              </div>
            </div>

            <div className="reports-schedule-panel">
              <div className="reports-schedule-form-wrap">
                <h4 className="reports-subtitle">افزودن زمان‌بندی جدید</h4>
                <form className="sec-form-rows" onSubmit={(e) => void handleCreateSchedule(e)}>
                  <label className="settings-field sec-form-row">
                    <span className="settings-field-label">گزارش</span>
                    <select
                      value={scheduleForm.reportCode}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, reportCode: e.target.value })}
                    >
                      {catalog.map((r) => (
                        <option key={r.code} value={r.code}>{r.title}</option>
                      ))}
                    </select>
                    <FieldHint>گزارشی که به‌صورت خودکار اجرا شود</FieldHint>
                  </label>
                  <label className="settings-field sec-form-row">
                    <span className="settings-field-label">تناوب</span>
                    <select
                      value={scheduleForm.frequency}
                      onChange={(e) => setScheduleForm({
                        ...scheduleForm,
                        frequency: e.target.value as ReportScheduleFrequency,
                      })}
                    >
                      {Object.entries(REPORT_SCHEDULE_FREQUENCY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <FieldHint>
                      روزانه = هر ۲۴ ساعت · هفتگی = یک‌بار در هفته · ماهانه = یک‌بار در ماه
                    </FieldHint>
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">ثبت زمان‌بندی</button>
                  </div>
                </form>
              </div>

              <div className="reports-schedule-list-wrap">
                <h4 className="reports-subtitle">زمان‌بندی‌های فعال</h4>
                {schedules.length === 0 ? (
                  <EmptyState
                    title="زمان‌بندی ثبت نشده"
                    description="فرم کنار را پر کنید تا گزارش به‌صورت خودکار اجرا شود."
                  />
                ) : (
                  <ul className="reports-schedule-list">
                    {schedules.map((s) => {
                      const code = String(s.reportCode ?? '');
                      const freq = s.frequency as ReportScheduleFrequency;
                      return (
                        <li key={String(s.id)} className="reports-schedule-item">
                          <div>
                            <strong>{reportTitle(code)}</strong>
                            <small>
                              {REPORT_SCHEDULE_FREQUENCY_LABELS[freq] ?? String(s.frequency)}
                              {' · '}
                              کد: <span className="reports-code inline">{code}</span>
                              {' · '}
                              {s.isEnabled ? 'فعال' : 'متوقف'}
                            </small>
                          </div>
                          <div className="reports-schedule-actions">
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => void toggleReportSchedule(String(s.id), !s.isEnabled).then(() => loadSchedules())}
                            >
                              {s.isEnabled ? 'توقف' : 'فعال‌سازی'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm hh-delete-btn"
                              onClick={async () => {
                                const ok = await feedback.confirm('این زمان‌بندی حذف شود؟', 'حذف زمان‌بندی');
                                if (!ok) return;
                                await deleteReportSchedule(String(s.id));
                                feedback.success('زمان‌بندی حذف شد');
                                void loadSchedules();
                              }}
                            >
                              حذف
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}
        </QueryState>
      </PermissionGate>
    </AppShell>
  );
}
