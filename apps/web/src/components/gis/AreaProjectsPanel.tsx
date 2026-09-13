'use client';

import { useEffect, useState } from 'react';
import {
  AreaProjectDto,
  AREA_PROJECT_KIND_LABELS,
  AREA_PROJECT_PARTY_LABELS,
  AREA_PROJECT_STATUS_LABELS,
  resolveFabricIdForPlace,
  type LinkedPlaceIds,
} from '@city-manager/shared';
import { NavIcon } from '@/components/NavIcons';
import { useFeedback } from '@/components/ui/Feedback';
import { ShamsiDateInput } from '@/components/analytics/ShamsiDateInput';
import {
  createAreaProject,
  deleteAreaProject,
  fetchAreaProjects,
  updateAreaProject,
} from '@/lib/gis-api';
import { fetchPrograms } from '@/lib/regeneration-api';
import { formatMetric, formatNumber } from '@/lib/format';
import { LinkedPlaceCascade, type CascadeFabric, type CascadeFabricType, type CascadeNeighborhood } from './LinkedPlaceCascade';

export function AreaProjectsPanel({
  neighborhoods,
  fabrics,
  fabricTypes = [],
  canWrite,
}: {
  neighborhoods: CascadeNeighborhood[];
  fabrics: CascadeFabric[];
  fabricTypes?: CascadeFabricType[];
  canWrite: boolean;
}) {
  const feedback = useFeedback();
  const [items, setItems] = useState<AreaProjectDto[]>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProgress, setEditProgress] = useState('');

  const [targetType, setTargetType] = useState<'neighborhood' | 'fabric'>('neighborhood');
  const [place, setPlace] = useState<LinkedPlaceIds>({
    neighborhoodId: '',
    fabricId: '',
    fabricTypeId: '',
  });
  const [name, setName] = useState('');
  const [projectKind, setProjectKind] = useState<'executive' | 'study'>('executive');
  const [partyRole, setPartyRole] = useState<'consultant' | 'contractor'>('consultant');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('planned');
  const [contractNumber, setContractNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [programId, setProgramId] = useState('');
  const [progressPercent, setProgressPercent] = useState('');
  const [contractorName, setContractorName] = useState('');

  const targetId = targetType === 'neighborhood'
    ? place.neighborhoodId
    : resolveFabricIdForPlace(fabrics, place.neighborhoodId, place.fabricTypeId);

  const targetName = (p: AreaProjectDto) => {
    if (p.targetType === 'neighborhood') {
      return neighborhoods.find((t) => t.id === p.targetId)?.name || p.targetId.slice(0, 8);
    }
    return fabrics.find((t) => t.id === p.targetId)?.name || p.targetId.slice(0, 8);
  };

  async function load() {
    setLoading(true);
    const res = await fetchAreaProjects();
    if (res.success && res.data) setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    void fetchPrograms().then((res) => {
      if (res.success && res.data) {
        setPrograms((res.data as Array<Record<string, unknown>>).map((p) => ({
          id: String(p.id),
          name: String(p.name),
        })));
      }
    });
  }, []);

  function resetForm() {
    setName('');
    setPartyName('');
    setAmount('');
    setContractNumber('');
    setStartDate('');
    setEndDate('');
    setDescription('');
    setProjectKind('executive');
    setPartyRole('consultant');
    setStatus('planned');
    setProgramId('');
    setProgressPercent('');
    setContractorName('');
    setPlace({ neighborhoodId: '', fabricId: '', fabricTypeId: '' });
  }

  async function submit() {
    if (!name.trim() || !targetId) {
      await feedback.alert('نام پروژه و محله/بافت را مشخص کنید', 'ثبت پروژه');
      return;
    }
    setSaving(true);
    const res = await createAreaProject({
      targetType,
      targetId,
      name: name.trim(),
      projectKind,
      partyRole,
      partyName: partyName.trim() || undefined,
      amount: amount ? Number(amount) : undefined,
      status,
      contractNumber: contractNumber.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      description: description.trim() || undefined,
      programId: programId || undefined,
      progressPercent: progressPercent ? Number(progressPercent) : undefined,
      contractorName: contractorName.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'خطا', 'ثبت پروژه');
      return;
    }
    feedback.success('پروژه ثبت شد');
    resetForm();
    setOpenForm(false);
    await load();
  }

  async function remove(id: string) {
    const ok = await feedback.confirm('این پروژه حذف شود؟', 'حذف پروژه');
    if (!ok) return;
    const res = await deleteAreaProject(id);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'خطا', 'حذف پروژه');
      return;
    }
    feedback.success('پروژه حذف شد');
    await load();
  }

  async function saveProgress(id: string) {
    const val = Number(editProgress);
    if (Number.isNaN(val) || val < 0 || val > 100) {
      await feedback.alert('پیشرفت باید بین ۰ تا ۱۰۰ باشد', 'ویرایش پیشرفت');
      return;
    }
    const res = await updateAreaProject(id, { progressPercent: val });
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'خطا', 'ویرایش پیشرفت');
      return;
    }
    feedback.success('پیشرفت به‌روز شد');
    setEditingId(null);
    await load();
  }

  const programName = (id?: string) => programs.find((p) => p.id === id)?.name;

  return (
    <section className="card area-projects-card">
      <div className="card-head">
        <div>
          <h3>
            <NavIcon name="fabric" size={18} /> پروژه‌های اجرایی و مطالعاتی
          </h3>
          <p className="muted">پروژه‌های مرتبط با محلات هدف و بافت‌ها — مشاور/پیمانکار، مبلغ و وضعیت</p>
        </div>
        {canWrite && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpenForm((v) => !v)}>
            {openForm ? 'بستن فرم' : 'افزودن پروژه'}
          </button>
        )}
      </div>

      {openForm && canWrite && (
        <div className="area-project-form">
          <div className="settings-form-grid">
            <label className="settings-field">
              <span className="settings-field-label">مرتبط با</span>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as 'neighborhood' | 'fabric')}
              >
                <option value="neighborhood">محله هدف</option>
                <option value="fabric">بافت</option>
              </select>
            </label>
            <LinkedPlaceCascade
              neighborhoods={neighborhoods}
              fabrics={fabrics}
              fabricTypes={fabricTypes}
              value={place}
              onChange={setPlace}
              required={targetType === 'neighborhood'}
            />
            <label className="settings-field">
              <span className="settings-field-label">نوع پروژه</span>
              <select value={projectKind} onChange={(e) => setProjectKind(e.target.value as 'executive' | 'study')}>
                <option value="executive">اجرایی</option>
                <option value="study">مطالعاتی</option>
              </select>
            </label>
            <label className="settings-field">
              <span className="settings-field-label">نام پروژه</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً بهسازی معابر" />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">نقش طرف قرارداد</span>
              <select value={partyRole} onChange={(e) => setPartyRole(e.target.value as 'consultant' | 'contractor')}>
                <option value="consultant">مشاور</option>
                <option value="contractor">پیمانکار</option>
              </select>
            </label>
            <label className="settings-field">
              <span className="settings-field-label">نام مشاور / پیمانکار</span>
              <input value={partyName} onChange={(e) => setPartyName(e.target.value)} />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">مبلغ (ریال)</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0} />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">شماره قرارداد</span>
              <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">وضعیت</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(AREA_PROJECT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span className="settings-field-label">برنامه بازآفرینی</span>
              <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
                <option value="">— بدون برنامه —</option>
                {programs.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span className="settings-field-label">پیمانکار</span>
              <input value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">پیشرفت (%)</span>
              <input type="number" min={0} max={100} value={progressPercent} onChange={(e) => setProgressPercent(e.target.value)} />
            </label>
            <div className="settings-field">
              <ShamsiDateInput
                label="تاریخ شروع"
                value={startDate || undefined}
                onChange={(iso) => setStartDate(iso ?? '')}
              />
            </div>
            <div className="settings-field">
              <ShamsiDateInput
                label="تاریخ پایان"
                value={endDate || undefined}
                onChange={(iso) => setEndDate(iso ?? '')}
              />
            </div>
            <label className="settings-field" style={{ gridColumn: '1 / -1' }}>
              <span className="settings-field-label">توضیحات</span>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void submit()}>
              {saving ? 'در حال ثبت…' : 'ثبت پروژه'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <p className="muted">پروژه‌ای ثبت نشده است.</p>
      ) : (
        <ul className="area-project-list">
          {items.map((p) => (
            <li key={p.id}>
              <div className="area-project-main">
                <strong>{p.name}</strong>
                <small>
                  {p.targetType === 'neighborhood' ? 'محله' : 'بافت'}: {targetName(p)}
                  {' · '}
                  {AREA_PROJECT_KIND_LABELS[p.projectKind] || p.projectKind}
                  {' · '}
                  {AREA_PROJECT_STATUS_LABELS[p.status] || p.status}
                </small>
                <small>
                  {p.partyRole ? `${AREA_PROJECT_PARTY_LABELS[p.partyRole] || p.partyRole}: ` : ''}
                  {p.contractorName || p.partyName || '—'}
                  {p.programId && programName(p.programId) ? ` · برنامه: ${programName(p.programId)}` : ''}
                  {p.amount != null && p.amount !== ''
                    ? ` · ${formatMetric(Number(p.amount), 'ریال')}`
                    : ''}
                  {p.contractNumber ? ` · قرارداد ${p.contractNumber}` : ''}
                  {' · پیشرفت: '}
                  {editingId === p.id ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="area-progress-input"
                        value={editProgress}
                        onChange={(e) => setEditProgress(e.target.value)}
                      />
                      %
                      <button type="button" className="btn btn-sm" onClick={() => void saveProgress(p.id)}>ذخیره</button>
                      <button type="button" className="btn btn-sm" onClick={() => setEditingId(null)}>لغو</button>
                    </>
                  ) : (
                    <>
                      {formatNumber(Number(p.progressPercent ?? 0))}٪
                      {canWrite && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => { setEditingId(p.id); setEditProgress(String(p.progressPercent ?? 0)); }}
                        >
                          ویرایش
                        </button>
                      )}
                    </>
                  )}
                </small>
              </div>
              {canWrite && editingId !== p.id && (
                <button type="button" className="btn btn-sm" onClick={() => void remove(p.id)}>
                  حذف
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <p className="muted" style={{ marginTop: '0.65rem', fontSize: '0.78rem' }}>
          جمع پروژه‌ها: {formatNumber(items.length)}
        </p>
      )}
    </section>
  );
}
