'use client';

import { useState } from 'react';
import { NavIcon } from '@/components/NavIcons';
import { useFeedback } from '@/components/ui/Feedback';
import { testDatabaseConnection } from '@/lib/admin-api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { SettingsAccordion } from './SettingsAccordion';

type DbTestResult = {
  ok: boolean;
  latencyMs: number;
  driver?: string;
  database?: string;
  checkedAt: string;
  message: string;
};

export function DatabaseTestCard({ canRun }: { canRun: boolean }) {
  const feedback = useFeedback();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DbTestResult | null>(null);

  async function runTest() {
    if (!canRun) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await testDatabaseConnection();
      if (!res.success || !res.data) {
        await feedback.alert(res.error?.message ?? 'تست ناموفق بود', 'اتصال پایگاه داده');
        setLoading(false);
        return;
      }
      setResult(res.data);
      if (res.data.ok) {
        feedback.success(res.data.message, 'اتصال موفق');
      } else {
        feedback.error(res.data.message, 'اتصال ناموفق');
      }
    } catch {
      await feedback.alert('خطا در برقراری ارتباط با سرور', 'اتصال پایگاه داده');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsAccordion
      title="تست اتصال پایگاه داده"
      description="بررسی سریع اینکه سرور به پایگاه داده دسترسی دارد یا نه"
      icon="activity"
      defaultOpen={false}
    >
      <div className="db-test-card">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canRun || loading}
          onClick={() => void runTest()}
        >
          <NavIcon name="activity" size={16} />
          {loading ? 'در حال تست…' : 'اجرای تست اتصال'}
        </button>

        {result && (
          <div className={`db-test-result ${result.ok ? 'ok' : 'fail'}`}>
            <div className="db-test-status">
              <strong>{result.ok ? 'اتصال برقرار است' : 'اتصال برقرار نیست'}</strong>
              <span>{result.message}</span>
            </div>
            <dl className="db-test-meta">
              <div>
                <dt>زمان پاسخ</dt>
                <dd>{formatNumber(result.latencyMs)} میلی‌ثانیه</dd>
              </div>
              {result.driver && (
                <div>
                  <dt>نوع موتور</dt>
                  <dd>{result.driver}</dd>
                </div>
              )}
              {result.database && (
                <div>
                  <dt>نام پایگاه</dt>
                  <dd>{result.database}</dd>
                </div>
              )}
              <div>
                <dt>زمان بررسی</dt>
                <dd>{formatDateTime(result.checkedAt)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </SettingsAccordion>
  );
}
