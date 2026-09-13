'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { TimelineView, EventTypeLegend } from '@/components/trajectory/TimelineView';
import { TrendChart } from '@/components/trajectory/TrendChart';
import { ComparePanel } from '@/components/trajectory/ComparePanel';
import { EventForm } from '@/components/trajectory/EventForm';
import { ExpertNoteForm } from '@/components/trajectory/ExpertNoteForm';
import { fetchMembers, fetchHousehold } from '@/lib/case-api';
import {
  fetchTimeline, fetchTrends, fetchCompare, fetchExpertNotes,
  TrajectoryTimelineItem, TrajectoryCompareResult,
} from '@/lib/trajectory-api';
import { formatDate, toPersianDigits } from '@/lib/format';
import { firstQueryFailure } from '@city-manager/shared';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

export default function HouseholdTrajectoryPage() {
  const params = useParams();
  const householdId = params.id as string;

  const [caseNumber, setCaseNumber] = useState('');
  const [members, setMembers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [filterMember, setFilterMember] = useState('');
  const [timeline, setTimeline] = useState<TrajectoryTimelineItem[]>([]);
  const [compare, setCompare] = useState<TrajectoryCompareResult | null>(null);
  const [incomeTrend, setIncomeTrend] = useState<Array<{ date: string; income?: number }>>([]);
  const [qolTrend, setQolTrend] = useState<Array<{ date: string; qualityOfLifeScore?: number }>>([]);
  const [notes, setNotes] = useState<Array<{ id: string; title?: string; content: string; createdAt: string }>>([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { loading, error, setError, run } = useQueryLoad();

  useEffect(() => {
    void load();
  }, [householdId, filterMember]);

  async function load() {
    await run(async () => {
      const hh = await fetchHousehold(householdId);
      if (hh.success && hh.data) {
        const h = (hh.data as { household: { caseNumber: string } }).household;
        setCaseNumber(h?.caseNumber ?? '');
      }
      const m = await fetchMembers(householdId);
      if (m.success && m.data) {
        setMembers((m.data as Array<{ id: string; firstName: string; lastName: string }>));
      }
      const tl = await fetchTimeline(householdId, filterMember || undefined);
      if (tl.success && tl.data) setTimeline(tl.data);

      const tr = await fetchTrends(householdId, filterMember || undefined);
      if (tr.success && tr.data) {
        setIncomeTrend(tr.data.income);
        setQolTrend(tr.data.qualityOfLife);
      }

      const cmp = await fetchCompare(householdId, fromDate, toDate, filterMember || undefined);
      if (cmp.success && cmp.data) setCompare(cmp.data);

      const n = await fetchExpertNotes(householdId, filterMember || undefined);
      if (n.success && n.data) setNotes(n.data as typeof notes);

      const fail = firstQueryFailure([hh, m, tl, tr, cmp, n]);
      if (fail) setError(fail);
    });
  }

  async function refreshCompare() {
    const cmp = await fetchCompare(householdId, fromDate, toDate, filterMember || undefined);
    if (cmp.success && cmp.data) setCompare(cmp.data);
  }

  return (
    <AppShell title="خط سیر تحول">
      <div className="case-header">
        <div>
          <Link href={`/dashboard/households/${householdId}`}>← بازگشت به پرونده</Link>
          <h2>خط سیر تحول — پرونده {toPersianDigits(caseNumber)}</h2>
        </div>
        <EventForm householdId={householdId} members={members} onCreated={load} />
      </div>

      <div className="trajectory-toolbar card">
        <label>
          <span>فیلتر عضو</span>
          <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)}>
            <option value="">همه</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
        </label>
        <label>
          <span>از تاریخ</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          <span>تا تاریخ</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <button type="button" className="btn btn-primary" onClick={refreshCompare}>بروزرسانی مقایسه</button>
      </div>

      <EventTypeLegend />

      <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری خط سیر…">
      <div className="trajectory-grid">
        <section className="trajectory-main">
          <h3>Timeline رویدادها</h3>
          <TimelineView items={timeline} />
        </section>

        <aside className="trajectory-side">
          {compare && <ComparePanel data={compare} />}

          <div className="trend-row">
            <TrendChart title="روند درآمد" points={incomeTrend} valueKey="income" color="#059669" />
            <TrendChart title="روند کیفیت زندگی" points={qolTrend} valueKey="qualityOfLifeScore" color="#7c3aed" maxValue={10} />
          </div>

          <ExpertNoteForm householdId={householdId} memberId={filterMember || undefined} onCreated={load} />

          <div className="card">
            <h4>یادداشت‌های کارشناسی</h4>
            {notes.length === 0 ? (
              <p className="muted">یادداشتی ثبت نشده</p>
            ) : (
              <ul className="expert-notes-list">
                {notes.map((n) => (
                  <li key={n.id}>
                    <strong>{n.title || 'بدون عنوان'}</strong>
                    <time>{formatDate(n.createdAt)}</time>
                    <p>{n.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
      </QueryState>
    </AppShell>
  );
}
