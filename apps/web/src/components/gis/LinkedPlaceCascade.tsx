'use client';

import { useMemo } from 'react';
import {
  fabricTypesForNeighborhood,
  filterNeighborhoodsByKind,
  NeighborhoodKind,
  NEIGHBORHOOD_KIND_LABELS,
  neighborhoodKind,
  NEW_LINKED_ID,
  syncLinkedPlaceSelection,
  type LinkedPlaceIds,
} from '@city-manager/shared';

export type CascadeNeighborhood = {
  id: string;
  name: string;
  code?: string;
  metadata?: Record<string, unknown>;
  fabric_type_ids?: string[];
  neighborhood_kind?: string;
};

export type CascadeFabric = {
  id: string;
  name?: string;
  code?: string;
  neighborhood_id?: string | null;
  fabric_type_id?: string | null;
  fabric_type_name?: string;
};

export type CascadeFabricType = {
  id: string;
  name: string;
  code?: string;
};

export function LinkedPlaceCascade({
  neighborhoods,
  fabrics,
  fabricTypes,
  value,
  onChange,
  allowCreate = false,
  showFabricType = true,
  showNeighborhoodKind = false,
  required = false,
  disabled = false,
  variant = 'settings',
}: {
  neighborhoods: CascadeNeighborhood[];
  fabrics: CascadeFabric[];
  fabricTypes: CascadeFabricType[];
  value: LinkedPlaceIds;
  onChange: (next: LinkedPlaceIds) => void;
  allowCreate?: boolean;
  showFabricType?: boolean;
  showNeighborhoodKind?: boolean;
  required?: boolean;
  disabled?: boolean;
  variant?: 'settings' | 'form';
}) {
  const fieldClass = variant === 'form' ? 'form-group' : 'settings-field';
  const labelClass = variant === 'form' ? undefined : 'settings-field-label';

  const kind = value.neighborhoodKind ?? NeighborhoodKind.REGENERATION_TARGET;
  const isUrban = kind === NeighborhoodKind.URBAN;
  const isNew = value.neighborhoodId === NEW_LINKED_ID;

  const urbanNeighborhoods = useMemo(
    () => filterNeighborhoodsByKind(neighborhoods, NeighborhoodKind.URBAN),
    [neighborhoods],
  );

  const selectableNeighborhoods = useMemo(() => {
    if (showNeighborhoodKind && isNew) {
      return kind === NeighborhoodKind.URBAN
        ? urbanNeighborhoods
        : neighborhoods.filter((n) => neighborhoodKind(n) === NeighborhoodKind.REGENERATION_TARGET || neighborhoodKind(n) === NeighborhoodKind.URBAN);
    }
    return neighborhoods;
  }, [showNeighborhoodKind, isNew, kind, urbanNeighborhoods, neighborhoods]);

  const neighborhood = neighborhoods.find((n) => n.id === value.neighborhoodId);
  const effectiveKind = isNew ? kind : neighborhoodKind(neighborhood ?? {});

  const typeOptions = useMemo(() => {
    if (effectiveKind === NeighborhoodKind.URBAN) {
      return fabricTypesForNeighborhood(
        { metadata: { neighborhoodKind: NeighborhoodKind.URBAN } },
        fabricTypes,
        fabrics,
        value.neighborhoodId || NEW_LINKED_ID,
      );
    }
    return fabricTypesForNeighborhood(neighborhood, fabricTypes, fabrics, value.neighborhoodId);
  }, [effectiveKind, neighborhood, fabricTypes, fabrics, value.neighborhoodId]);

  function emit(partial: Partial<LinkedPlaceIds>) {
    onChange(syncLinkedPlaceSelection({ ...value, ...partial }, fabrics, value, fabricTypes));
  }

  function onKindChange(nextKind: NeighborhoodKind) {
    const next: LinkedPlaceIds = {
      ...value,
      neighborhoodKind: nextKind,
      parentUrbanNeighborhoodId: nextKind === NeighborhoodKind.URBAN ? '' : value.parentUrbanNeighborhoodId,
    };
    if (nextKind === NeighborhoodKind.URBAN) {
      onChange(syncLinkedPlaceSelection(
        { ...next, fabricTypeId: '' },
        fabrics,
        value,
        fabricTypes,
      ));
      return;
    }
    onChange(syncLinkedPlaceSelection(next, fabrics, value, fabricTypes));
  }

  const typeDisabled = disabled
    || (!value.neighborhoodId && !allowCreate)
    || (effectiveKind === NeighborhoodKind.URBAN);

  return (
    <div className={`linked-place-cascade linked-place-cascade--${variant}`}>
      {showNeighborhoodKind && (
        <label className={fieldClass}>
          <span className={labelClass}>نوع محله</span>
          <select
            value={kind}
            disabled={disabled}
            onChange={(e) => onKindChange(e.target.value as NeighborhoodKind)}
          >
            <option value={NeighborhoodKind.URBAN}>{NEIGHBORHOOD_KIND_LABELS[NeighborhoodKind.URBAN]}</option>
            <option value={NeighborhoodKind.REGENERATION_TARGET}>
              {NEIGHBORHOOD_KIND_LABELS[NeighborhoodKind.REGENERATION_TARGET]}
            </option>
          </select>
        </label>
      )}

      {showNeighborhoodKind && kind === NeighborhoodKind.REGENERATION_TARGET && isNew && (
        <label className={fieldClass}>
          <span className={labelClass}>محله شهری والد</span>
          <select
            value={value.parentUrbanNeighborhoodId ?? ''}
            disabled={disabled}
            onChange={(e) => emit({ parentUrbanNeighborhoodId: e.target.value })}
          >
            <option value="">— بدون والد (مستقل) —</option>
            {urbanNeighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}{n.code ? ` (${n.code})` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={fieldClass}>
        <span className={labelClass}>
          {showNeighborhoodKind
            ? (kind === NeighborhoodKind.URBAN ? 'محله شهری' : 'محله هدف')
            : 'محله'}
          {required ? <em className="req-star"> *</em> : null}
        </span>
        <select
          value={value.neighborhoodId}
          disabled={disabled}
          onChange={(e) => emit({
            neighborhoodId: e.target.value,
            fabricTypeId: e.target.value === NEW_LINKED_ID ? value.fabricTypeId : '',
          })}
        >
          <option value="">{required ? 'انتخاب محله…' : '— انتخاب محله —'}</option>
          {allowCreate && <option value={NEW_LINKED_ID}>＋ محله جدید</option>}
          {selectableNeighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {neighborhoodKind(n) === NeighborhoodKind.URBAN ? '◆ ' : '▸ '}
              {n.name}{n.code ? ` (${n.code})` : ''}
            </option>
          ))}
        </select>
      </label>

      {showFabricType && (
        <label className={fieldClass}>
          <span className={labelClass}>نوع بافت</span>
          {effectiveKind === NeighborhoodKind.URBAN ? (
            <select value={value.fabricTypeId || typeOptions[0]?.id || ''} disabled>
              <option value={typeOptions[0]?.id ?? ''}>
                {typeOptions[0]?.name ?? 'بافت عادی'}
              </option>
            </select>
          ) : (
            <select
              value={value.fabricTypeId}
              disabled={typeDisabled}
              onChange={(e) => emit({ fabricTypeId: e.target.value })}
            >
              <option value="">
                {value.neighborhoodId || allowCreate ? '— انتخاب نوع بافت —' : 'ابتدا محله را انتخاب کنید'}
              </option>
              {allowCreate && isNew && <option value={NEW_LINKED_ID}>＋ نوع بافت جدید</option>}
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.code ? ` (${t.code})` : ''}
                </option>
              ))}
            </select>
          )}
        </label>
      )}
    </div>
  );
}
