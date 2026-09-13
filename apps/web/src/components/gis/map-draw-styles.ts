/** High-contrast draw colors — readable on OSM and satellite */

export const DRAW_IDLE = '#00E5FF';
export const DRAW_ACTIVE = '#FF2D95';
export const DRAW_HALO = '#FFFFFF';
export const DRAW_PREVIEW = '#FFE600';

/**
 * MapLibre does NOT support data-driven `line-dasharray`.
 * Active vs idle stroke must be separate layers with static dasharrays.
 */
export const mapDrawStyles = [
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'active', 'true']],
    paint: {
      'fill-color': DRAW_IDLE,
      'fill-opacity': 0.18,
    },
  },
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
    paint: {
      'fill-color': DRAW_ACTIVE,
      'fill-opacity': 0.28,
    },
  },
  {
    id: 'gl-draw-polygon-stroke-halo',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': DRAW_HALO,
      'line-width': 5.5,
      'line-opacity': 0.95,
    },
  },
  {
    id: 'gl-draw-line-string-halo',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': DRAW_HALO,
      'line-width': 6,
      'line-opacity': 0.9,
    },
  },
  {
    id: 'gl-draw-lines-inactive',
    type: 'line',
    filter: [
      'all',
      ['!=', 'active', 'true'],
      ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': DRAW_IDLE,
      'line-width': 3,
      'line-dasharray': [2, 0],
    },
  },
  {
    id: 'gl-draw-lines-active',
    type: 'line',
    filter: [
      'all',
      ['==', 'active', 'true'],
      ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': DRAW_ACTIVE,
      'line-width': 3.5,
      'line-dasharray': [0.2, 2],
    },
  },
  {
    id: 'gl-draw-point-outer-inactive',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'active', 'true']],
    paint: {
      'circle-radius': 7,
      'circle-color': DRAW_HALO,
      'circle-stroke-width': 2,
      'circle-stroke-color': DRAW_IDLE,
    },
  },
  {
    id: 'gl-draw-point-outer-active',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['==', 'active', 'true']],
    paint: {
      'circle-radius': 9,
      'circle-color': DRAW_HALO,
      'circle-stroke-width': 2,
      'circle-stroke-color': DRAW_ACTIVE,
    },
  },
  {
    id: 'gl-draw-point-inner-inactive',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'active', 'true']],
    paint: {
      'circle-radius': 4,
      'circle-color': DRAW_IDLE,
    },
  },
  {
    id: 'gl-draw-point-inner-active',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['==', 'active', 'true']],
    paint: {
      'circle-radius': 5,
      'circle-color': DRAW_ACTIVE,
    },
  },
  {
    id: 'gl-draw-vertex-outer',
    type: 'circle',
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['==', 'meta', 'vertex'],
      ['!=', 'mode', 'simple_select'],
    ],
    paint: {
      'circle-radius': 7,
      'circle-color': DRAW_HALO,
      'circle-stroke-width': 2,
      'circle-stroke-color': DRAW_ACTIVE,
    },
  },
  {
    id: 'gl-draw-vertex-inner',
    type: 'circle',
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['==', 'meta', 'vertex'],
      ['!=', 'mode', 'simple_select'],
    ],
    paint: {
      'circle-radius': 4,
      'circle-color': DRAW_ACTIVE,
    },
  },
  {
    id: 'gl-draw-midpoint',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': 4,
      'circle-color': DRAW_PREVIEW,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#111',
    },
  },
];
