'use client';

import Link from 'next/link';
import {
  HouseholdDetailTab,
  HOUSEHOLD_TAB_LABELS,
  SUMMARY_BAR_FIELD_LABELS,
  SummaryBarFieldKey,
  resolveCtaHref,
} from '@city-manager/shared';
import { NavIcon } from '@/components/NavIcons';
import { formatNumber, toPersianDigits } from '@/lib/format';
import { useUxPersona } from '@/lib/use-ux-persona';

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  suspended: 'معلق',
  graduated: 'فارغ‌شده',
  withdrawn: 'انصراف',
};

export interface HouseholdSummaryBarProps {
  householdId: string;
  household: Record<string, unknown>;
  dwelling?: Record<string, unknown>;
  memberCount: number;
  onTabChange?: (tab: HouseholdDetailTab) => void;
}

export function HouseholdSummaryBar({
  householdId,
  household,
  dwelling,
  memberCount,
  onTabChange,
}: HouseholdSummaryBarProps) {
  const { householdCtas } = useUxPersona();

  const fields: Array<{ key: SummaryBarFieldKey; value: string }> = [
    {
      key: 'status',
      value: STATUS_LABELS[String(household.status ?? '')] ?? String(household.status ?? '—'),
    },
    {
      key: 'caseNumber',
      value: toPersianDigits(String(household.caseNumber ?? '—')),
    },
    {
      key: 'memberCount',
      value: formatNumber(memberCount),
    },
    {
      key: 'assignedUserId',
      value: household.assignedUserId ? 'تخصیص‌شده' : 'بدون مسئول',
    },
    {
      key: 'vulnerabilityScore',
      value: household.vulnerabilityScore != null
        ? formatNumber(Number(household.vulnerabilityScore))
        : '—',
    },
    {
      key: 'dwellingAddress',
      value: String(dwelling?.fullAddress ?? dwelling?.title ?? '—').slice(0, 80),
    },
  ];

  const dwellingId = dwelling?.id ? String(dwelling.id) : undefined;

  return (
    <div className="hh-summary-bar card" role="region" aria-label="خلاصه پرونده">
      <div className="hh-summary-fields">
        {fields.map((f) => (
          <div key={f.key} className="hh-summary-field">
            <span>{SUMMARY_BAR_FIELD_LABELS[f.key]}</span>
            <strong>{f.value}</strong>
          </div>
        ))}
      </div>
      <div className="hh-summary-actions">
        {householdCtas.map((cta) => {
          if (cta.tab && onTabChange) {
            return (
              <button
                key={cta.id}
                type="button"
                className="btn btn-sm"
                onClick={() => onTabChange(cta.tab!)}
              >
                <NavIcon name={cta.icon} size={14} />
                {cta.label}
              </button>
            );
          }
          if (cta.hrefTemplate) {
            const href = resolveCtaHref(cta.hrefTemplate, { householdId, dwellingId });
            return (
              <Link key={cta.id} href={href} className="btn btn-sm">
                <NavIcon name={cta.icon} size={14} />
                {cta.label}
              </Link>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export { HOUSEHOLD_TAB_LABELS };
