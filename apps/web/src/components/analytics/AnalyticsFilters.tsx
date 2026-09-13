'use client';

import { AnalyticsFilter, AnalyticsFilterErrors } from '@city-manager/shared';
import { ShamsiDateInput } from '@/components/analytics/ShamsiDateInput';

type Option = { key?: string; id?: string; label?: string; name?: string };

interface Props {
  filters: AnalyticsFilter;
  options: {
    neighborhoods: Array<{ id: string; name: string }>;
    householdStatuses: Array<{ key: string; label: string }>;
    ownershipTypes: Array<{ key: string; label: string }>;
    educationLevels: Array<{ key: string; label: string }>;
    employmentStatuses: Array<{ key: string; label: string }>;
  } | null;
  errors?: AnalyticsFilterErrors;
  onChange: (f: AnalyticsFilter) => void;
  onApply: () => void;
  onReset: () => void;
}

function MultiSelect({
  label,
  values,
  options,
  onChange,
  hint,
}: {
  label: string;
  values: string[];
  options: Option[];
  onChange: (v: string[]) => void;
  hint?: string;
}) {
  return (
    <label className="filter-field">
      <span>
        {label}
        {values.length > 0 ? ` (${values.length})` : ''}
      </span>
      <select
        multiple
        value={values}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
        aria-label={label}
      >
        {options.map((o) => {
          const value = o.key ?? o.id ?? '';
          const text = o.label ?? o.name ?? value;
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
      {hint && <small className="filter-field-hint">{hint}</small>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <small className="filter-field-error" role="alert">{message}</small>;
}

export function AnalyticsFilters({
  filters,
  options,
  errors = {},
  onChange,
  onApply,
  onReset,
}: Props) {
  if (!options) {
    return (
      <div className="card analytics-filters">
        <p className="muted">در حال بارگذاری گزینه‌های فیلتر…</p>
      </div>
    );
  }

  return (
    <div className="card analytics-filters">
      <div className="filter-section">
        <h4 className="filter-section-title">دسته‌بندی (اختیاری — چندانتخابی)</h4>
        <p className="filter-section-hint muted">
          برای انتخاب چند مورد از Ctrl (ویندوز) یا ⌘ (مک) استفاده کنید. خالی = همه.
        </p>
        <div className="filter-grid filter-grid-cats">
          <MultiSelect
            label="محله"
            values={filters.neighborhoodIds ?? []}
            options={options.neighborhoods}
            onChange={(neighborhoodIds) => onChange({ ...filters, neighborhoodIds })}
          />
          <MultiSelect
            label="وضعیت خانوار"
            values={filters.householdStatuses ?? []}
            options={options.householdStatuses}
            onChange={(householdStatuses) => onChange({ ...filters, householdStatuses })}
          />
          <MultiSelect
            label="مالکیت"
            values={filters.ownershipTypes ?? []}
            options={options.ownershipTypes}
            onChange={(ownershipTypes) => onChange({ ...filters, ownershipTypes })}
          />
          <MultiSelect
            label="تحصیلات"
            values={filters.educationLevels ?? []}
            options={options.educationLevels}
            onChange={(educationLevels) => onChange({ ...filters, educationLevels })}
          />
          <MultiSelect
            label="اشتغال"
            values={filters.employmentStatuses ?? []}
            options={options.employmentStatuses}
            onChange={(employmentStatuses) => onChange({ ...filters, employmentStatuses })}
          />
        </div>
      </div>

      <div className="filter-section">
        <h4 className="filter-section-title">بازه زمانی ثبت خانوار (شمسی)</h4>
        <div className="filter-row filter-row-dates">
          <div>
            <ShamsiDateInput
              label="از تاریخ"
              value={filters.fromDate}
              onChange={(fromDate) => onChange({ ...filters, fromDate })}
            />
            <FieldError message={errors.fromDate} />
          </div>
          <div>
            <ShamsiDateInput
              label="تا تاریخ"
              value={filters.toDate}
              onChange={(toDate) => onChange({ ...filters, toDate })}
            />
            <FieldError message={errors.toDate} />
          </div>
        </div>
        <FieldError message={errors.dateRange} />
      </div>

      <div className="filter-section">
        <h4 className="filter-section-title">محدوده درآمد ماهانه (ریال)</h4>
        <div className="filter-row filter-row-income">
          <label className={`filter-field ${errors.incomeMin || errors.incomeRange ? 'has-error' : ''}`}>
            <span>حداقل درآمد</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              dir="ltr"
              placeholder="مثلاً 5000000"
              value={filters.incomeMin ?? ''}
              onChange={(e) => onChange({
                ...filters,
                incomeMin: e.target.value ? Number(e.target.value) : undefined,
              })}
            />
            <FieldError message={errors.incomeMin} />
          </label>
          <label className={`filter-field ${errors.incomeMax || errors.incomeRange ? 'has-error' : ''}`}>
            <span>حداکثر درآمد</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              dir="ltr"
              placeholder="مثلاً 20000000"
              value={filters.incomeMax ?? ''}
              onChange={(e) => onChange({
                ...filters,
                incomeMax: e.target.value ? Number(e.target.value) : undefined,
              })}
            />
            <FieldError message={errors.incomeMax} />
          </label>
        </div>
        <FieldError message={errors.incomeRange} />
      </div>

      <div className="form-actions filter-actions">
        <button type="button" className="btn btn-primary" onClick={onApply}>اعمال فیلتر</button>
        <button type="button" className="btn" onClick={onReset}>پاک کردن</button>
      </div>
    </div>
  );
}
