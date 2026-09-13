'use client';

import { useMemo } from 'react';
import {
  JALALI_MONTHS,
  isoToJalali,
  jalaliMonthDays,
  jalaliToIso,
  toJalali,
} from '@/lib/jalali';
import { toPersianDigits } from '@/lib/format';

interface Props {
  label: string;
  value?: string;
  onChange: (iso: string | undefined) => void;
}

export function ShamsiDateInput({ label, value, onChange }: Props) {
  const today = useMemo(() => {
    const n = new Date();
    return toJalali(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }, []);

  const parsed = isoToJalali(value);
  const year = parsed?.year ?? '';
  const month = parsed?.month ?? '';
  const day = parsed?.day ?? '';

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = today.year + 1; y >= today.year - 40; y--) list.push(y);
    return list;
  }, [today.year]);

  const daysInMonth = year && month ? jalaliMonthDays(Number(year), Number(month)) : 31;

  function emit(jy: number | '', jm: number | '', jd: number | '') {
    if (!jy || !jm || !jd) {
      onChange(undefined);
      return;
    }
    const max = jalaliMonthDays(Number(jy), Number(jm));
    const safeDay = Math.min(Number(jd), max);
    onChange(jalaliToIso(Number(jy), Number(jm), safeDay));
  }

  return (
    <label className="filter-field shamsi-date-field">
      <span>{label}</span>
      <div className="shamsi-date-row" dir="rtl">
        <select
          className="shamsi-day"
          aria-label={`${label} — روز`}
          value={day}
          onChange={(e) => emit(year, month, e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">روز</option>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{toPersianDigits(d)}</option>
          ))}
        </select>
        <select
          className="shamsi-month"
          aria-label={`${label} — ماه`}
          value={month}
          onChange={(e) => emit(year, e.target.value ? Number(e.target.value) : '', day)}
        >
          <option value="">ماه</option>
          {JALALI_MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          className="shamsi-year"
          aria-label={`${label} — سال`}
          value={year}
          onChange={(e) => emit(e.target.value ? Number(e.target.value) : '', month, day)}
        >
          <option value="">سال</option>
          {years.map((y) => (
            <option key={y} value={y}>{toPersianDigits(y)}</option>
          ))}
        </select>
      </div>
    </label>
  );
}
