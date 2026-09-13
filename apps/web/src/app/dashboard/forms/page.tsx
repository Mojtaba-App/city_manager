'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader, PermissionGate } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { useAuth } from '@/lib/auth';
import { fetchFormDefinitions, upsertFormDefinition } from '@/lib/regeneration-api';
import { apiFetch } from '@/lib/api';
import { DynamicFormFields } from '@/components/case/DynamicFormFields';
import {
  CASE_ENTITY_TYPE_LABELS,
  CaseEntityType,
  FORM_FIELD_TYPE_LABELS,
  FORM_FIELD_TYPES,
  FormDefinitionSchema,
  FormFieldSchema,
  FormNextStep,
  getFormNextSteps,
  nextUniqueFieldKey,
  validateFormDefinitionSchema,
} from '@city-manager/shared';
import { useFeedback } from '@/components/ui/Feedback';
import { formatNumber } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

type SavedDef = {
  id?: string;
  entityType?: string;
  name?: string;
  version?: number;
};

function emptySchema(): FormDefinitionSchema {
  return { sections: [], fields: [] };
}

export default function FormsBuilderPage() {
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const canWrite = hasPermission('forms:write');
  const [definitions, setDefinitions] = useState<SavedDef[]>([]);
  const [entityType, setEntityType] = useState<string>(CaseEntityType.HOUSEHOLD);
  const [name, setName] = useState('');
  const [schema, setSchema] = useState<FormDefinitionSchema>(emptySchema);
  const [busy, setBusy] = useState(false);
  const [schemaBusy, setSchemaBusy] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [nextSteps, setNextSteps] = useState<FormNextStep[] | null>(null);
  const { loading, error, setError, run } = useQueryLoad();

  const entityLabel = CASE_ENTITY_TYPE_LABELS[entityType as CaseEntityType] ?? entityType;

  async function loadList() {
    const res = await fetchFormDefinitions();
    if (res.success && res.data) setDefinitions(res.data as SavedDef[]);
    else if (!res.success) setError(res.error?.message ?? 'بارگذاری فرم‌ها ناموفق بود');
    return (res.success && res.data ? res.data : []) as SavedDef[];
  }

  async function loadSchema(type: string, defs?: SavedDef[]) {
    setSchemaBusy(true);
    setNextSteps(null);
    try {
      const res = await apiFetch<FormDefinitionSchema>(`/case/forms/${type}`, {});
      if (res.success && res.data) {
        setSchema({
          sections: Array.isArray(res.data.sections) ? res.data.sections : [],
          fields: Array.isArray(res.data.fields) ? res.data.fields : [],
        });
        const list = defs ?? definitions;
        const def = list.find((d) => d.entityType === type);
        setName(String(def?.name ?? CASE_ENTITY_TYPE_LABELS[type as CaseEntityType] ?? type));
        setPreviewValues({});
      } else if (!res.success) {
        setError(res.error?.message ?? 'بارگذاری طرح فرم ناموفق بود');
      }
    } finally {
      setSchemaBusy(false);
    }
  }

  useEffect(() => {
    void run(async () => {
      const defs = await loadList();
      await loadSchema(CaseEntityType.HOUSEHOLD, defs);
    });
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    void loadSchema(entityType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  function addSection() {
    const id = `section_${Date.now()}`;
    setSchema((s) => ({
      ...s,
      sections: [...s.sections, { id, title: `بخش ${s.sections.length + 1}` }],
    }));
  }

  function removeSection(id: string) {
    setSchema((s) => ({
      sections: s.sections.filter((sec) => sec.id !== id),
      fields: s.fields.map((f) => (f.section === id ? { ...f, section: undefined } : f)),
    }));
  }

  function addField(sectionId?: string) {
    const key = nextUniqueFieldKey(schema.fields);
    setSchema((s) => ({
      ...s,
      fields: [
        ...s.fields,
        { key, label: 'فیلد جدید', type: 'text', section: sectionId, required: false },
      ],
    }));
  }

  function updateField(index: number, patch: Partial<FormFieldSchema>) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.map((f, i) => {
        if (i !== index) return f;
        const next = { ...f, ...patch };
        if (patch.type === 'select' && !(next.options?.length)) {
          next.options = [{ value: 'opt_1', label: 'گزینه ۱' }];
        }
        if (patch.type && patch.type !== 'select') {
          next.options = undefined;
        }
        return next;
      }),
    }));
  }

  function updateOption(fieldIndex: number, optIndex: number, patch: { value?: string; label?: string }) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.map((f, i) => {
        if (i !== fieldIndex) return f;
        const options = [...(f.options ?? [])];
        options[optIndex] = { ...options[optIndex], ...patch };
        return { ...f, options };
      }),
    }));
  }

  function addOption(fieldIndex: number) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.map((f, i) => {
        if (i !== fieldIndex) return f;
        const n = (f.options?.length ?? 0) + 1;
        return {
          ...f,
          options: [...(f.options ?? []), { value: `opt_${n}`, label: `گزینه ${n}` }],
        };
      }),
    }));
  }

  function removeOption(fieldIndex: number, optIndex: number) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.map((f, i) => {
        if (i !== fieldIndex) return f;
        return { ...f, options: (f.options ?? []).filter((_, oi) => oi !== optIndex) };
      }),
    }));
  }

  function removeField(index: number) {
    setSchema((s) => ({ ...s, fields: s.fields.filter((_, i) => i !== index) }));
  }

  const liveSchemaErrors = useMemo(() => validateFormDefinitionSchema(schema), [schema]);

  async function save() {
    if (!name.trim()) {
      feedback.error('نام فرم الزامی است');
      return;
    }
    const msgs = validateFormDefinitionSchema(schema);
    if (msgs.length) {
      feedback.error(msgs[0]);
      return;
    }
    setBusy(true);
    setNextSteps(null);
    const res = await upsertFormDefinition({ entityType, name: name.trim(), schema });
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ذخیره ناموفق');
      return;
    }
    feedback.success('فرم ذخیره شد');
    setNextSteps(getFormNextSteps(entityType));
    const defs = await loadList();
    const def = defs.find((d) => d.entityType === entityType);
    if (def?.name) setName(String(def.name));
  }

  return (
    <AppShell title="فرم‌ساز">
      <PermissionGate allow={hasPermission('forms:read')}>
        <div className="regen-page forms-builder-page">
          <PageHeader
            title="فرم‌ساز پویا"
            description="تعریف بخش‌ها و فیلدهای سفارشی برای موجودیت‌های پرونده"
          />

          <section className="card regen-intro">
            <p className="regen-section-hint muted">
              <strong>موجودیت</strong> نوع داده (خانوار، عضو، …) است.
              {' '}
              <strong>بخش</strong> گروه‌بندی فیلدها و
              {' '}
              <strong>کلید (key)</strong> شناسه فنی در ذخیره JSON است.
            </p>
          </section>

          <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری فرم‌ساز…">
            {nextSteps && (
              <section className="card forms-next-card" role="status">
                <div>
                  <strong>فرم «{name || entityLabel}» ذخیره شد</strong>
                  <p className="muted">
                    از این به بعد هنگام کار روی {entityLabel} همین فیلدها نمایش داده می‌شوند. مرحله بعد:
                  </p>
                  <ul className="forms-next-list">
                    {nextSteps.map((step) => (
                      <li key={step.href}>
                        <Link href={step.href} className="btn btn-sm btn-primary">{step.label}</Link>
                        <span className="muted">{step.hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => setNextSteps(null)}>
                  ادامه ویرایش
                </button>
              </section>
            )}

            <div className="regen-workspace forms-workspace">
              <aside className="card forms-sidebar">
                <div className="card-head">
                  <div>
                    <h3>تنظیمات فرم</h3>
                  </div>
                </div>

                <div className="sec-form-rows">
                  <label className="settings-field sec-form-row">
                    <span className="settings-field-label">نوع موجودیت</span>
                    <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                      {Object.values(CaseEntityType).map((t) => (
                        <option key={t} value={t}>{CASE_ENTITY_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    <span className="settings-field-hint">فرم برای کدام بخش پرونده اعمال شود</span>
                  </label>

                  <label className="settings-field sec-form-row">
                    <span className="settings-field-label">نام فرم</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً فرم تکمیلی خانوار" />
                  </label>

                  {canWrite && (
                    <div className="form-actions">
                      <button type="button" className="btn btn-primary" disabled={busy || schemaBusy} onClick={() => void save()}>
                        {busy ? 'در حال ذخیره…' : 'ذخیره فرم'}
                      </button>
                    </div>
                  )}
                  {liveSchemaErrors.length > 0 && (
                    <p className="field-error" role="alert">{liveSchemaErrors[0]}</p>
                  )}
                </div>

                <div className="forms-saved-list">
                  <h4 className="forms-subtitle">فرم‌های ثبت‌شده</h4>
                  {definitions.length === 0 ? (
                    <p className="muted forms-empty">فرم سفارشی ثبت نشده</p>
                  ) : (
                    <ul className="forms-def-list">
                      {definitions.map((d) => (
                        <li key={String(d.id ?? d.entityType)}>
                          <button
                            type="button"
                            className={`forms-def-btn ${entityType === String(d.entityType) ? 'active' : ''}`}
                            onClick={() => setEntityType(String(d.entityType))}
                          >
                            <strong>{String(d.name)}</strong>
                            <small>
                              {CASE_ENTITY_TYPE_LABELS[d.entityType as CaseEntityType] ?? String(d.entityType)}
                              {d.version != null ? ` · نسخه ${formatNumber(Number(d.version))}` : ''}
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>

              <section className="card forms-designer">
                <div className="card-head">
                  <div>
                    <h3>طراحی فیلدها</h3>
                    <p className="regen-section-hint muted">
                      {formatNumber(schema.fields.length)} فیلد در {formatNumber(schema.sections.length)} بخش
                      {schemaBusy ? ' — در حال همگام‌سازی…' : ''}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="forms-designer-actions">
                      <button type="button" className="btn btn-sm" onClick={addSection}>+ بخش</button>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => addField(schema.sections[0]?.id)}>
                        + فیلد
                      </button>
                    </div>
                  )}
                </div>

                {schema.sections.length > 0 && (
                  <div className="forms-sections-bar">
                    {schema.sections.map((sec, si) => (
                      <label key={sec.id} className="forms-section-chip">
                        <NavIcon name="layers" size={14} />
                        <input
                          value={sec.title}
                          disabled={!canWrite}
                          onChange={(e) => setSchema((s) => ({
                            ...s,
                            sections: s.sections.map((x, i) => (i === si ? { ...x, title: e.target.value } : x)),
                          }))}
                        />
                        {canWrite && (
                          <button
                            type="button"
                            className="forms-section-remove"
                            aria-label="حذف بخش"
                            onClick={() => removeSection(sec.id)}
                          >
                            ×
                          </button>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                {schema.fields.length === 0 ? (
                  <EmptyState
                    title="فیلدی تعریف نشده"
                    description={canWrite ? '«+ فیلد» را بزنید یا ابتدا یک بخش بسازید.' : undefined}
                  />
                ) : (
                  <ul className="forms-field-list">
                    {schema.fields.map((f, i) => (
                      <li key={`${f.key}-${i}`} className="forms-field-card">
                        <div className="forms-field-card-head">
                          <span className="forms-field-index">{i + 1}</span>
                          <strong>{f.label || 'فیلد بدون برچسب'}</strong>
                          {f.required && <span className="status-pill info">الزامی</span>}
                        </div>
                        <div className="forms-field-grid">
                          <label>
                            <span>برچسب</span>
                            <input
                              value={f.label}
                              disabled={!canWrite}
                              placeholder="برچسب نمایشی"
                              onChange={(e) => updateField(i, { label: e.target.value })}
                            />
                          </label>
                          <label>
                            <span>کلید (key)</span>
                            <input
                              className="input-ltr"
                              value={f.key}
                              disabled={!canWrite}
                              placeholder="field_key"
                              dir="ltr"
                              onChange={(e) => updateField(i, { key: e.target.value })}
                            />
                          </label>
                          <label>
                            <span>نوع</span>
                            <select
                              value={f.type}
                              disabled={!canWrite}
                              onChange={(e) => updateField(i, { type: e.target.value as FormFieldSchema['type'] })}
                            >
                              {FORM_FIELD_TYPES.map((t) => (
                                <option key={t} value={t}>{FORM_FIELD_TYPE_LABELS[t]}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>بخش</span>
                            <select
                              value={f.section ?? ''}
                              disabled={!canWrite}
                              onChange={(e) => updateField(i, { section: e.target.value || undefined })}
                            >
                              <option value="">بدون بخش</option>
                              {schema.sections.map((s) => (
                                <option key={s.id} value={s.id}>{s.title}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        {f.type === 'select' && (
                          <div className="forms-options">
                            <span className="forms-options-label">گزینه‌های انتخاب</span>
                            {(f.options ?? []).map((opt, oi) => (
                              <div key={`${oi}-${opt.value}`} className="forms-option-row">
                                <input
                                  className="input-ltr"
                                  dir="ltr"
                                  disabled={!canWrite}
                                  value={opt.value}
                                  placeholder="value"
                                  onChange={(e) => updateOption(i, oi, { value: e.target.value })}
                                />
                                <input
                                  disabled={!canWrite}
                                  value={opt.label}
                                  placeholder="برچسب"
                                  onChange={(e) => updateOption(i, oi, { label: e.target.value })}
                                />
                                {canWrite && (
                                  <button type="button" className="btn btn-sm" onClick={() => removeOption(i, oi)}>حذف</button>
                                )}
                              </div>
                            ))}
                            {canWrite && (
                              <button type="button" className="btn btn-sm" onClick={() => addOption(i)}>+ گزینه</button>
                            )}
                          </div>
                        )}
                        <div className="forms-field-footer">
                          <label className="forms-field-check">
                            <input
                              type="checkbox"
                              checked={Boolean(f.required)}
                              disabled={!canWrite}
                              onChange={(e) => updateField(i, { required: e.target.checked })}
                            />
                            فیلد الزامی
                          </label>
                          {canWrite && (
                            <button type="button" className="btn btn-sm regen-btn-danger" onClick={() => removeField(i)}>
                              حذف
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {schema.fields.length > 0 && (
                  <div className="forms-preview">
                    <h4 className="forms-subtitle">پیش‌نمایش</h4>
                    <p className="muted forms-empty">نمایش همان فیلدها هنگام پر کردن پرونده</p>
                    <DynamicFormFields
                      schema={schema}
                      values={previewValues}
                      onChange={(key, value) => setPreviewValues((prev) => ({ ...prev, [key]: value }))}
                      errors={{}}
                    />
                  </div>
                )}
              </section>
            </div>
          </QueryState>
        </div>
      </PermissionGate>
    </AppShell>
  );
}
