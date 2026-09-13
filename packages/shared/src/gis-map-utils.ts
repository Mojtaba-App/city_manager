/** Pure GIS map helpers — filter, search, and HUD counts. */

/**
 * Manages an "exclusive filter" list where empty = all visible.
 *
 * Rules:
 *  - selected = []  → all items visible (sentinel for "no filter")
 *  - checked = true → ensure id is included; if result = all, collapse back to []
 *  - checked = false → remove id; result can never be empty (guards against hiding everything)
 *    — if removing the last id would empty the list, keep the current selection unchanged
 */
export function toggleExclusiveFilter(
  allIds: string[],
  selected: string[],
  id: string,
  checked: boolean,
): string[] {
  if (!allIds.length) return selected;
  const current = selected.length === 0 ? [...allIds] : [...selected];
  if (checked) {
    if (current.includes(id)) return current.length >= allIds.length ? [] : current;
    const next = [...current, id];
    return next.length >= allIds.length ? [] : next;
  }
  const next = current.filter((item) => item !== id);
  // Never collapse to empty (would silently show all instead of none).
  if (next.length === 0) return current;
  return next;
}

export function featureSearchHaystack(props: Record<string, unknown> | null | undefined): string {
  if (!props) return '';
  return [
    props.name,
    props.title,
    props.code,
    props.mapLabel,
    props.dwellingCode,
    props.dwelling_code,
    props.layerName,
    props.layer_name,
    props.fabricTypeName,
    props.category,
  ]
    .filter((v) => v != null && String(v).length > 0)
    .join(' ');
}

export function countFeaturesByLayer(
  features: Array<{ properties?: Record<string, unknown> | null }>,
): { total: number; urban: number; fabrics: number; neighborhoods: number; dwellings: number } {
  const counts = { total: features.length, urban: 0, fabrics: 0, neighborhoods: 0, dwellings: 0 };
  for (const f of features) {
    const layer = String(f.properties?.layer ?? '');
    if (layer === 'urban') counts.urban += 1;
    else if (layer === 'fabrics') counts.fabrics += 1;
    else if (layer === 'neighborhoods') counts.neighborhoods += 1;
    else if (layer === 'dwellings') counts.dwellings += 1;
  }
  return counts;
}
