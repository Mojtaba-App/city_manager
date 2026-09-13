'use client';

import { useEffect, useState } from 'react';
import {
  fetchHouseholdTasks, createHouseholdTask, updateHouseholdTask,
  fetchHouseholdVisits, createHouseholdVisit, completeHouseholdVisit,
  fetchSupportPackages, fetchSupportAssignments, assignSupportPackage, updateSupportAssignment,
  fetchHouseholdDocuments, uploadHouseholdDocument, deleteHouseholdDocument, documentDownloadUrl,
  fetchVulnerabilityAssessments, submitVulnerabilityAssessment,
  sendHouseholdMessage, assignHousehold,
} from '@/lib/operations-api';
import { fetchAdminUsers } from '@/lib/admin-api';
import {
  CaseTaskPriority, CaseTaskStatus, CaseTaskType,
  CASE_TASK_PRIORITY_LABELS, CASE_TASK_STATUS_LABELS, CASE_TASK_TYPE_LABELS,
  SUPPORT_PACKAGE_CATEGORY_LABELS, SupportAssignmentStatus,
  VULNERABILITY_LEVEL_LABELS, MessageChannel, HouseholdDocumentCategory,
} from '@city-manager/shared';
import { formatDateTime, formatNumber, toPersianDigits } from '@/lib/format';
import { useFeedback } from '@/components/ui/Feedback';
import { useAuth } from '@/lib/auth';

type Props = { householdId: string; caseNumber?: string };

export function HouseholdOperationsPanel({ householdId, caseNumber }: Props) {
  const feedback = useFeedback();
  const { profile, hasPermission } = useAuth();
  const canWriteOps = hasPermission('operations:write');
  const canAssign = hasPermission('operations:assign');
  const canWriteDocs = hasPermission('documents:write');
  const canSendMsg = hasPermission('messaging:send');
  const [section, setSection] = useState<'tasks' | 'visits' | 'support' | 'docs' | 'vuln' | 'msg'>('tasks');
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [visits, setVisits] = useState<Record<string, unknown>[]>([]);
  const [packages, setPackages] = useState<Record<string, unknown>[]>([]);
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [assessments, setAssessments] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [busy, setBusy] = useState(false);

  const [newTask, setNewTask] = useState({
    title: '', description: '', taskType: CaseTaskType.FOLLOW_UP,
    priority: CaseTaskPriority.NORMAL, dueAt: '',
  });
  const [newVisit, setNewVisit] = useState({ scheduledAt: '', addressNote: '' });
  const [assignPkg, setAssignPkg] = useState({ packageId: '', amount: '' });
  const [docMeta, setDocMeta] = useState({ title: '', category: HouseholdDocumentCategory.OTHER, file: null as File | null });
  const [vuln, setVuln] = useState({
    incomeScore: 50, housingScore: 50, healthScore: 50,
    employmentScore: 50, educationScore: 50, familySizeScore: 50, notes: '',
  });
  const [msg, setMsg] = useState({ channel: MessageChannel.SMS, recipient: '', body: '' });
  const [assignUserId, setAssignUserId] = useState('');

  useEffect(() => {
    void loadAll();
  }, [householdId]);

  async function loadAll() {
    const [t, v, p, a, d, assess, u] = await Promise.all([
      fetchHouseholdTasks(householdId),
      fetchHouseholdVisits(householdId),
      fetchSupportPackages(),
      fetchSupportAssignments(householdId),
      fetchHouseholdDocuments(householdId),
      fetchVulnerabilityAssessments(householdId),
      canAssign ? fetchAdminUsers(1, '') : Promise.resolve({ success: false as const }),
    ]);
    if (t.success) setTasks((t.data as Record<string, unknown>[]) ?? []);
    if (v.success) setVisits((v.data as Record<string, unknown>[]) ?? []);
    if (p.success) setPackages((p.data as Record<string, unknown>[]) ?? []);
    if (a.success) setAssignments((a.data as Record<string, unknown>[]) ?? []);
    if (d.success) setDocuments((d.data as Record<string, unknown>[]) ?? []);
    if (assess.success) setAssessments((assess.data as Record<string, unknown>[]) ?? []);
    if (u.success) setUsers((u.data ?? []) as Array<{ id: string; firstName: string; lastName: string }>);
  }

  async function handleCreateTask() {
    if (!canWriteOps) return;
    if (!newTask.title.trim()) {
      feedback.error('عنوان وظیفه الزامی است');
      return;
    }
    setBusy(true);
    const res = await createHouseholdTask(householdId, {
      ...newTask,
      assignedUserId: profile?.id,
      dueAt: newTask.dueAt || undefined,
    });
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ثبت وظیفه ناموفق');
      return;
    }
    feedback.success('وظیفه ثبت شد');
    setNewTask({ title: '', description: '', taskType: CaseTaskType.FOLLOW_UP, priority: CaseTaskPriority.NORMAL, dueAt: '' });
    void loadAll();
  }

  async function handleTaskStatus(taskId: string, status: CaseTaskStatus) {
    if (!canWriteOps) return;
    setBusy(true);
    const res = await updateHouseholdTask(householdId, taskId, { status });
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'بروزرسانی ناموفق');
      return;
    }
    void loadAll();
  }

  async function handleCreateVisit() {
    if (!canWriteOps) return;
    if (!newVisit.scheduledAt) {
      feedback.error('زمان بازدید الزامی است');
      return;
    }
    setBusy(true);
    const res = await createHouseholdVisit(householdId, {
      scheduledAt: new Date(newVisit.scheduledAt).toISOString(),
      addressNote: newVisit.addressNote || undefined,
      assignedUserId: profile?.id,
    });
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ثبت بازدید ناموفق');
      return;
    }
    feedback.success('بازدید برنامه‌ریزی شد');
    setNewVisit({ scheduledAt: '', addressNote: '' });
    void loadAll();
  }

  async function handleCompleteVisit(visitId: string) {
    if (!canWriteOps) return;
    const findings = await feedback.prompt('یافته‌های بازدید را بنویسید', { title: 'ثبت بازدید' });
    if (findings == null) return;
    setBusy(true);
    const res = await completeHouseholdVisit(householdId, visitId, { findings });
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ثبت ناموفق');
      return;
    }
    feedback.success('بازدید ثبت شد');
    void loadAll();
  }

  async function handleAssignPackage() {
    if (!canWriteOps) return;
    if (!assignPkg.packageId) {
      feedback.error('بسته حمایتی را انتخاب کنید');
      return;
    }
    setBusy(true);
    const res = await assignSupportPackage(householdId, {
      packageId: assignPkg.packageId,
      amount: assignPkg.amount ? Number(assignPkg.amount) : undefined,
    });
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'تخصیص ناموفق');
      return;
    }
    feedback.success('بسته حمایتی تخصیص یافت');
    setAssignPkg({ packageId: '', amount: '' });
    void loadAll();
  }

  async function handleActivateAssignment(assignmentId: string) {
    if (!canWriteOps) return;
    setBusy(true);
    const res = await updateSupportAssignment(householdId, assignmentId, { status: SupportAssignmentStatus.ACTIVE });
    setBusy(false);
    if (res.success) void loadAll();
  }

  async function handleUploadDoc() {
    if (!canWriteDocs) return;
    if (!docMeta.title.trim() || !docMeta.file) {
      feedback.error('عنوان و فایل الزامی است');
      return;
    }
    setBusy(true);
    const res = await uploadHouseholdDocument(householdId, docMeta.file, docMeta.title, docMeta.category);
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'آپلود ناموفق');
      return;
    }
    feedback.success('سند ذخیره شد');
    setDocMeta({ title: '', category: HouseholdDocumentCategory.OTHER, file: null });
    void loadAll();
  }

  async function handleVulnSubmit() {
    if (!canWriteOps) return;
    setBusy(true);
    const res = await submitVulnerabilityAssessment(householdId, vuln);
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ارزیابی ناموفق');
      return;
    }
    feedback.success('ارزیابی آسیب‌پذیری ثبت شد');
    void loadAll();
  }

  async function handleSendMsg() {
    if (!canSendMsg) return;
    if (!msg.recipient.trim() || !msg.body.trim()) {
      feedback.error('گیرنده و متن پیام الزامی است');
      return;
    }
    setBusy(true);
    const res = await sendHouseholdMessage(householdId, msg);
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ارسال ناموفق');
      return;
    }
    feedback.success('پیام در صف ارسال قرار گرفت');
    setMsg({ ...msg, body: '' });
  }

  async function handleAssignHousehold() {
    if (!canAssign) return;
    if (!assignUserId) {
      feedback.error('مددکار را انتخاب کنید');
      return;
    }
    setBusy(true);
    const res = await assignHousehold(householdId, assignUserId);
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ارجاع ناموفق');
      return;
    }
    feedback.success('پرونده ارجاع شد');
  }

  return (
    <div className="ops-household">
      {canAssign && (
      <div className="ops-assign-bar card">
        <label>
          <span>مسئول پرونده</span>
          <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
            <option value="">انتخاب مددکار…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleAssignHousehold()}>
          ارجاع پرونده
        </button>
      </div>
      )}

      <div className="ops-subtabs">
        {([
          ['tasks', 'وظایف'],
          ['visits', 'بازدید'],
          ['support', 'بسته حمایتی'],
          ['docs', 'اسناد'],
          ['vuln', 'آسیب‌پذیری'],
          ['msg', 'پیام'],
        ] as const).map(([k, label]) => (
          <button key={k} type="button" className={section === k ? 'active' : ''} onClick={() => setSection(k)}>
            {label}
          </button>
        ))}
      </div>

      {section === 'tasks' && (
        <div className="card ops-section">
          <h4>وظایف پرونده {caseNumber ? toPersianDigits(caseNumber) : ''}</h4>
          {canWriteOps && (
          <>
          <div className="ops-form-grid">
            <label><span>عنوان *</span><input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} /></label>
            <label><span>نوع</span>
              <select value={newTask.taskType} onChange={(e) => setNewTask({ ...newTask, taskType: e.target.value as CaseTaskType })}>
                {Object.values(CaseTaskType).map((t) => <option key={t} value={t}>{CASE_TASK_TYPE_LABELS[t]}</option>)}
              </select>
            </label>
            <label><span>اولویت</span>
              <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as CaseTaskPriority })}>
                {Object.values(CaseTaskPriority).map((p) => <option key={p} value={p}>{CASE_TASK_PRIORITY_LABELS[p]}</option>)}
              </select>
            </label>
            <label><span>مهلت</span><input type="datetime-local" value={newTask.dueAt} onChange={(e) => setNewTask({ ...newTask, dueAt: e.target.value })} /></label>
            <label className="ops-full"><span>توضیح</span><textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} rows={2} /></label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleCreateTask()}>ثبت وظیفه</button>
          </>
          )}
          <ul className="ops-list">
            {tasks.map((t) => (
              <li key={String(t.id)} className={`ops-list-item ${t.isOverdue ? 'ops-overdue' : ''}`}>
                <div>
                  <strong>{String(t.title)}</strong>
                  <span className="muted">{CASE_TASK_TYPE_LABELS[t.taskType as CaseTaskType] ?? String(t.taskType)}</span>
                  {t.dueAt != null && String(t.dueAt) !== '' && <small>مهلت: {formatDateTime(String(t.dueAt))}</small>}
                </div>
                <div className="ops-inline-actions">
                  <span>{CASE_TASK_STATUS_LABELS[t.status as CaseTaskStatus] ?? String(t.status)}</span>
                  {canWriteOps && t.status !== CaseTaskStatus.COMPLETED && (
                    <>
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void handleTaskStatus(String(t.id), CaseTaskStatus.IN_PROGRESS)}>شروع</button>
                      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void handleTaskStatus(String(t.id), CaseTaskStatus.COMPLETED)}>انجام شد</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section === 'visits' && (
        <div className="card ops-section">
          {canWriteOps && (
          <>
          <div className="ops-form-grid">
            <label><span>زمان بازدید *</span><input type="datetime-local" value={newVisit.scheduledAt} onChange={(e) => setNewVisit({ ...newVisit, scheduledAt: e.target.value })} /></label>
            <label className="ops-full"><span>یادداشت آدرس</span><input value={newVisit.addressNote} onChange={(e) => setNewVisit({ ...newVisit, addressNote: e.target.value })} /></label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleCreateVisit()}>برنامه‌ریزی بازدید</button>
          </>
          )}
          <ul className="ops-list">
            {visits.map((v) => (
              <li key={String(v.id)} className="ops-list-item">
                <div>
                  <strong>{formatDateTime(String(v.scheduledAt))}</strong>
                  <span>{String(v.status)}</span>
                  {v.findings != null && String(v.findings).trim() !== '' && <p>{String(v.findings)}</p>}
                </div>
                {canWriteOps && v.status === 'scheduled' && (
                  <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void handleCompleteVisit(String(v.id))}>
                    ثبت انجام
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {section === 'support' && (
        <div className="card ops-section">
          {canWriteOps && (
          <>
          <div className="ops-form-grid">
            <label><span>بسته *</span>
              <select value={assignPkg.packageId} onChange={(e) => setAssignPkg({ ...assignPkg, packageId: e.target.value })}>
                <option value="">انتخاب…</option>
                {packages.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.name)} ({SUPPORT_PACKAGE_CATEGORY_LABELS[p.category as keyof typeof SUPPORT_PACKAGE_CATEGORY_LABELS] ?? p.category})
                  </option>
                ))}
              </select>
            </label>
            <label><span>مبلغ (اختیاری)</span><input type="number" min={0} value={assignPkg.amount} onChange={(e) => setAssignPkg({ ...assignPkg, amount: e.target.value })} /></label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleAssignPackage()}>تخصیص بسته</button>
          </>
          )}
          <ul className="ops-list">
            {assignments.map((a) => {
              const pkg = a.package as Record<string, unknown> | null;
              return (
                <li key={String(a.id)} className="ops-list-item">
                  <div>
                    <strong>{pkg ? String(pkg.name) : '—'}</strong>
                    <span>{String(a.status)}</span>
                    {a.amount != null && <small>{formatNumber(Number(a.amount))} ریال</small>}
                  </div>
                  {canWriteOps && a.status === 'planned' && (
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void handleActivateAssignment(String(a.id))}>
                      فعال‌سازی
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {section === 'docs' && (
        <div className="card ops-section">
          {canWriteDocs && (
          <>
          <div className="ops-form-grid">
            <label><span>عنوان *</span><input value={docMeta.title} onChange={(e) => setDocMeta({ ...docMeta, title: e.target.value })} /></label>
            <label><span>دسته</span>
              <select value={docMeta.category} onChange={(e) => setDocMeta({ ...docMeta, category: e.target.value as HouseholdDocumentCategory })}>
                {Object.values(HouseholdDocumentCategory).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="ops-full"><span>فایل *</span><input type="file" onChange={(e) => setDocMeta({ ...docMeta, file: e.target.files?.[0] ?? null })} /></label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleUploadDoc()}>آپلود سند</button>
          </>
          )}
          <ul className="ops-list">
            {documents.map((d) => (
              <li key={String(d.id)} className="ops-list-item">
                <div>
                  <strong>{String(d.title)}</strong>
                  <span>{String(d.fileName)}</span>
                </div>
                <div className="ops-inline-actions">
                  <a className="btn btn-sm" href={documentDownloadUrl(householdId, String(d.id))} target="_blank" rel="noreferrer">دانلود</a>
                  {canWriteDocs && (
                  <button type="button" className="btn btn-sm hh-delete-btn" disabled={busy} onClick={() => void deleteHouseholdDocument(householdId, String(d.id)).then(() => loadAll())}>حذف</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section === 'vuln' && (
        <div className="card ops-section">
          {canWriteOps ? (
          <>
          <p className="muted">هر بُعد ۰ (کم) تا ۱۰۰ (زیاد) — امتیاز کل و سطح آسیب‌پذیری محاسبه می‌شود.</p>
          <div className="ops-form-grid ops-vuln-grid">
            {([
              ['incomeScore', 'درآمد'],
              ['housingScore', 'مسکن'],
              ['healthScore', 'سلامت'],
              ['employmentScore', 'اشتغال'],
              ['educationScore', 'تحصیل'],
              ['familySizeScore', 'اندازه خانوار'],
            ] as const).map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input type="range" min={0} max={100} value={vuln[key]} onChange={(e) => setVuln({ ...vuln, [key]: Number(e.target.value) })} />
                <em>{formatNumber(vuln[key])}</em>
              </label>
            ))}
            <label className="ops-full"><span>یادداشت</span><textarea value={vuln.notes} onChange={(e) => setVuln({ ...vuln, notes: e.target.value })} rows={2} /></label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleVulnSubmit()}>ثبت ارزیابی</button>
          </>
          ) : (
          <p className="muted">فقط مشاهدهٔ ارزیابی‌های ثبت‌شده</p>
          )}
          <ul className="ops-list">
            {assessments.map((a) => (
              <li key={String(a.id)} className="ops-list-item">
                <strong>{formatNumber(Number(a.totalScore))} — {VULNERABILITY_LEVEL_LABELS[a.level as keyof typeof VULNERABILITY_LEVEL_LABELS] ?? String(a.level)}</strong>
                <span>{formatDateTime(String(a.assessedAt))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section === 'msg' && (
        <div className="card ops-section">
          {canSendMsg ? (
          <>
          <div className="ops-form-grid">
            <label><span>کانال</span>
              <select value={msg.channel} onChange={(e) => setMsg({ ...msg, channel: e.target.value as MessageChannel })}>
                <option value={MessageChannel.SMS}>پیامک</option>
                <option value={MessageChannel.EMAIL}>ایمیل</option>
              </select>
            </label>
            <label><span>گیرنده *</span><input value={msg.recipient} onChange={(e) => setMsg({ ...msg, recipient: e.target.value })} placeholder="09… یا email" /></label>
            <label className="ops-full"><span>متن *</span><textarea value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} rows={3} /></label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleSendMsg()}>ارسال پیام</button>
          </>
          ) : (
            <p className="muted">مجوز ارسال پیام ندارید.</p>
          )}
        </div>
      )}
    </div>
  );
}
