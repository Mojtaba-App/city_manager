'use client';

import {
  URBAN_LAYER_CATEGORY_GROUPS,
  URBAN_LAYER_CATEGORY_LABELS,
  UrbanLayerCategory,
} from '@city-manager/shared';

/** Select دسته‌بندی لایه شهری با گروه‌بندی طرح‌ها */
export function UrbanLayerCategorySelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: UrbanLayerCategory | string;
  onChange: (value: UrbanLayerCategory) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <select
      id={id}
      disabled={disabled}
      value={value || UrbanLayerCategory.CUSTOM}
      onChange={(e) => onChange(e.target.value as UrbanLayerCategory)}
    >
      {URBAN_LAYER_CATEGORY_GROUPS.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.categories.map((c) => (
            <option key={c} value={c}>
              {URBAN_LAYER_CATEGORY_LABELS[c]}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
