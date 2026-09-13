'use client';

import { FormDefinitionSchema, FormFieldSchema } from '@city-manager/shared';

export function DynamicForm({
  schema,
  values,
  onChange,
}: {
  schema: FormDefinitionSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (!schema.fields?.length) return null;

  const bySection = schema.fields.reduce<Record<string, FormFieldSchema[]>>((acc, f) => {
    const sec = f.section ?? 'default';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(f);
    return acc;
  }, {});

  return (
    <div className="dynamic-form">
      {Object.entries(bySection).map(([sectionId, fields]) => {
        const sectionTitle = schema.sections?.find((s) => s.id === sectionId)?.title ?? 'فیلدهای اضافه';
        return (
          <div key={sectionId} className="form-section">
            <h4>{sectionTitle}</h4>
            {fields.map((field) => (
              <label key={field.key} className="form-group">
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                {field.type === 'select' ? (
                  <select
                    value={String(values[field.key] ?? '')}
                    onChange={(e) => onChange(field.key, e.target.value)}
                  >
                    <option value="">—</option>
                    {field.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={String(values[field.key] ?? '')}
                    onChange={(e) => onChange(field.key, e.target.value)}
                  />
                ) : field.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.key])}
                    onChange={(e) => onChange(field.key, e.target.checked)}
                  />
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    value={String(values[field.key] ?? '')}
                    onChange={(e) =>
                      onChange(
                        field.key,
                        field.type === 'number' ? Number(e.target.value) : e.target.value,
                      )
                    }
                  />
                )}
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
