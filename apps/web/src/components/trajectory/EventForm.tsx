'use client';

import { useState } from 'react';
import {
  LifeEventType, TrajectoryRecordType, SupportTrajectoryStatus, LIFE_EVENT_LABELS,
} from '@city-manager/shared';
import { createTrajectoryRecord } from '@/lib/trajectory-api';

const EVENT_TYPES = [
  LifeEventType.JOB_CHANGE,
  LifeEventType.INCOME_CHANGE,
  LifeEventType.HOUSING_CHANGE,
  LifeEventType.QOL_CHANGE,
  LifeEventType.SUPPORT_STATUS_CHANGE,
  LifeEventType.EDUCATION_CHANGE,
];

interface Props {
  householdId: string;
  members: Array<{ id: string; firstName: string; lastName: string }>;
  onCreated: () => void;
}

export function EventForm({ householdId, members, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    eventType: LifeEventType.JOB_CHANGE,
    eventDate: new Date().toISOString().slice(0, 10),
    memberId: '',
    jobTitle: '',
    previousJobTitle: '',
    monthlyIncome: '',
    previousIncome: '',
    dwellingAddress: '',
    previousDwellingAddress: '',
    qualityOfLifeScore: '',
    previousQolScore: '',
    supportStatus: SupportTrajectoryStatus.RECEIVING,
    previousSupportStatus: SupportTrajectoryStatus.NONE,
    description: '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await createTrajectoryRecord(householdId, {
      recordType: TrajectoryRecordType.LIFE_EVENT,
      eventType: form.eventType,
      eventDate: form.eventDate,
      memberId: form.memberId || undefined,
      jobTitle: form.jobTitle || undefined,
      previousJobTitle: form.previousJobTitle || undefined,
      monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
      previousIncome: form.previousIncome ? Number(form.previousIncome) : undefined,
      dwellingAddress: form.dwellingAddress || undefined,
      previousDwellingAddress: form.previousDwellingAddress || undefined,
      qualityOfLifeScore: form.qualityOfLifeScore ? Number(form.qualityOfLifeScore) : undefined,
      previousQolScore: form.previousQolScore ? Number(form.previousQolScore) : undefined,
      supportStatus: form.eventType === LifeEventType.SUPPORT_STATUS_CHANGE ? form.supportStatus : undefined,
      previousSupportStatus: form.eventType === LifeEventType.SUPPORT_STATUS_CHANGE ? form.previousSupportStatus : undefined,
      description: form.description || undefined,
    });
    if (!res.success) {
      setError(res.error?.message ?? 'خطا در ثبت');
      return;
    }
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + ثبت رویداد جدید
      </button>
    );
  }

  return (
    <form className="card event-form" onSubmit={submit}>
      <h4>ثبت رویداد خط سیر</h4>
      {error && <p className="error-message">{error}</p>}
      <div className="form-grid">
        <label className="form-group">
          <span>نوع رویداد</span>
          <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as LifeEventType })}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{LIFE_EVENT_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label className="form-group">
          <span>تاریخ</span>
          <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} required />
        </label>
        <label className="form-group">
          <span>عضو (اختیاری)</span>
          <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
            <option value="">— کل خانوار —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
        </label>

        {(form.eventType === LifeEventType.JOB_CHANGE || form.eventType === LifeEventType.INCOME_CHANGE) && (
          <>
            <label className="form-group"><span>شغل قبلی</span><input value={form.previousJobTitle} onChange={(e) => setForm({ ...form, previousJobTitle: e.target.value })} /></label>
            <label className="form-group"><span>شغل جدید</span><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></label>
            <label className="form-group"><span>درآمد قبلی</span><input type="number" value={form.previousIncome} onChange={(e) => setForm({ ...form, previousIncome: e.target.value })} /></label>
            <label className="form-group"><span>درآمد جدید</span><input type="number" value={form.monthlyIncome} onChange={(e) => setForm({ ...form, monthlyIncome: e.target.value })} /></label>
          </>
        )}

        {form.eventType === LifeEventType.HOUSING_CHANGE && (
          <>
            <label className="form-group form-full"><span>آدرس قبلی</span><input value={form.previousDwellingAddress} onChange={(e) => setForm({ ...form, previousDwellingAddress: e.target.value })} /></label>
            <label className="form-group form-full"><span>آدرس جدید</span><input value={form.dwellingAddress} onChange={(e) => setForm({ ...form, dwellingAddress: e.target.value })} /></label>
          </>
        )}

        {form.eventType === LifeEventType.QOL_CHANGE && (
          <>
            <label className="form-group"><span>امتیاز قبلی (۱-۱۰)</span><input type="number" min={1} max={10} value={form.previousQolScore} onChange={(e) => setForm({ ...form, previousQolScore: e.target.value })} /></label>
            <label className="form-group"><span>امتیاز جدید (۱-۱۰)</span><input type="number" min={1} max={10} value={form.qualityOfLifeScore} onChange={(e) => setForm({ ...form, qualityOfLifeScore: e.target.value })} /></label>
          </>
        )}

        {form.eventType === LifeEventType.SUPPORT_STATUS_CHANGE && (
          <>
            <label className="form-group">
              <span>وضعیت قبلی</span>
              <select value={form.previousSupportStatus} onChange={(e) => setForm({ ...form, previousSupportStatus: e.target.value as SupportTrajectoryStatus })}>
                {Object.values(SupportTrajectoryStatus).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span>وضعیت جدید</span>
              <select value={form.supportStatus} onChange={(e) => setForm({ ...form, supportStatus: e.target.value as SupportTrajectoryStatus })}>
                {Object.values(SupportTrajectoryStatus).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </>
        )}

        <label className="form-group form-full">
          <span>توضیح / یادداشت</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">ثبت</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>انصراف</button>
      </div>
    </form>
  );
}
