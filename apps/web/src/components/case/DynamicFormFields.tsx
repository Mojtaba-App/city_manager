'use client';

import { FormDefinitionSchema, FormFieldSchema, validateDynamicRequired } from '@city-manager/shared';

export { validateDynamicRequired };

export function DynamicFormFields({
  schema,
  values,
  onChange,
  errors,
}: {
  schema: FormDefinitionSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
}) {
  if (!schema.fields?.length) return null;

  const bySection = schema.fields.reduce<Record<string, FormFieldSchema[]>>((acc, f) => {
    const s = f.section ?? 'default';
    acc[s] = acc[s] ?? [];
    acc[s].push(f);
    return acc;
  }, {});

  return (
    <div className="dynamic-form">
      {Object.entries(bySection).map(([sectionId, fields]) => {
        const sectionTitle = schema.sections?.find((s) => s.id === sectionId)?.title ?? 'فیلدهای تکمیلی';
        return (
          <div key={sectionId} className="form-section">
            <h4>{sectionTitle}</h4>
            <div className="form-grid">
              {fields.map((field) => {
                const err = errors?.[field.key];
                return (
                  <label
                    key={field.key}
                    className={`form-group ${err ? 'has-error' : ''} ${field.type === 'textarea' ? 'form-full' : ''}`}
                  >
                    <span>
                      {field.label}
                      {field.required ? <em className="req-star"> *</em> : null}
                    </span>
                    {field.type === 'select' ? (
                      <select
                        required={field.required}
                        aria-invalid={Boolean(err)}
                        value={String(values[field.key] ?? '')}
                        onChange={(e) => onChange(field.key, e.target.value)}
                      >
                        <option value="">انتخاب کنید…</option>
                        {field.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        required={field.required}
                        aria-invalid={Boolean(err)}
                        value={String(values[field.key] ?? '')}
                        onChange={(e) => onChange(field.key, e.target.value)}
                      />
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        required={field.required}
                        aria-invalid={Boolean(err)}
                        value={values[field.key] != null ? String(values[field.key]) : ''}
                        onChange={(e) => onChange(field.key, e.target.value ? Number(e.target.value) : '')}
                      />
                    ) : field.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={Boolean(values[field.key])}
                        onChange={(e) => onChange(field.key, e.target.checked)}
                      />
                    ) : (
                      <input
                        type={field.type === 'date' ? 'date' : 'text'}
                        required={field.required}
                        aria-invalid={Boolean(err)}
                        value={String(values[field.key] ?? '')}
                        onChange={(e) => onChange(field.key, e.target.value)}
                      />
                    )}
                    {err && <small className="field-error">{err}</small>}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
