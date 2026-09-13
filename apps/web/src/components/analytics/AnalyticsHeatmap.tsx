'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { HeatmapPoint, NeighborhoodChoropleth } from '@city-manager/shared';
import { formatNumber } from '@/lib/format';

export type AnalyticsHeatmapHandle = {
  captureMapDataUrl: () => string | null;
};

export const AnalyticsHeatmap = forwardRef<AnalyticsHeatmapHandle, {
  points: HeatmapPoint[];
  neighborhoods: NeighborhoodChoropleth[];
}>(function AnalyticsHeatmap({ points, neighborhoods }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useImperativeHandle(ref, () => ({
    captureMapDataUrl() {
      const map = mapRef.current;
      if (!map) return null;
      try {
        map.triggerRepaint();
        return map.getCanvas().toDataURL('image/jpeg', 0.85);
      } catch {
        return null;
      }
    },
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [48.669, 31.3203],
      zoom: 12,
      preserveDrawingBuffer: true,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    mapRef.current = map;
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const heatFc = {
        type: 'FeatureCollection' as const,
        features: points.map((p) => ({
          type: 'Feature' as const,
          properties: { weight: p.weight, label: p.label ?? '' },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
      };

      const polyFc = {
        type: 'FeatureCollection' as const,
        features: neighborhoods
          .filter((n) => n.geometry)
          .map((n) => ({
            type: 'Feature' as const,
            properties: {
              name: n.name,
              householdCount: n.householdCount,
              avgVulnerability: n.avgVulnerability ?? 0,
              avgIncome: n.avgIncome ?? null,
            },
            geometry: n.geometry as {
              type: string;
              coordinates: unknown;
            },
          })),
      };

      if (map.getSource('heat')) {
        (map.getSource('heat') as maplibregl.GeoJSONSource).setData(heatFc as never);
      } else {
        map.addSource('heat', { type: 'geojson', data: heatFc as never });
        map.addLayer({
          id: 'heat-layer',
          type: 'heatmap',
          source: 'heat',
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 10, 1],
            'heatmap-intensity': 1.1,
            'heatmap-radius': 28,
            'heatmap-opacity': 0.75,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.2, '#78d3ef',
              0.4, '#35b779',
              0.6, '#fde725',
              0.8, '#f8961e',
              1, '#d00000',
            ],
          },
        });
      }

      if (map.getSource('nbhd')) {
        (map.getSource('nbhd') as maplibregl.GeoJSONSource).setData(polyFc as never);
      } else if (polyFc.features.length) {
        map.addSource('nbhd', { type: 'geojson', data: polyFc as never });
        map.addLayer({
          id: 'nbhd-fill',
          type: 'fill',
          source: 'nbhd',
          paint: {
            'fill-color': [
              'interpolate', ['linear'], ['get', 'avgVulnerability'],
              0, '#e6f1f4',
              5, '#fde725',
              10, '#d00000',
            ],
            'fill-opacity': 0.28,
          },
        });
        map.addLayer({
          id: 'nbhd-line',
          type: 'line',
          source: 'nbhd',
          paint: { 'line-color': '#0f4c5c', 'line-width': 1.5 },
        });
        map.on('click', 'nbhd-fill', (e) => {
          const f = e.features?.[0];
          if (!f || !popupRef.current) return;
          const p = f.properties ?? {};
          popupRef.current
            .setLngLat(e.lngLat)
            .setHTML(
              `<strong>${String(p.name ?? 'محله')}</strong>`
              + `<div>خانوار: ${formatNumber(Number(p.householdCount ?? 0))}</div>`
              + `<div>آسیب‌پذیری: ${formatNumber(Number(p.avgVulnerability ?? 0))}</div>`,
            )
            .addTo(map);
        });
        map.on('mouseenter', 'nbhd-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'nbhd-fill', () => { map.getCanvas().style.cursor = ''; });
      }

      const bounds = new maplibregl.LngLatBounds();
      let hasBound = false;
      points.forEach((p) => {
        bounds.extend([p.lng, p.lat]);
        hasBound = true;
      });
      for (const n of neighborhoods) {
        const g = n.geometry as { type?: string; coordinates?: unknown } | null | undefined;
        if (!g?.coordinates) continue;
        const walk = (coords: unknown): void => {
          if (!Array.isArray(coords)) return;
          if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            bounds.extend([coords[0] as number, coords[1] as number]);
            hasBound = true;
            return;
          }
          for (const c of coords) walk(c);
        };
        walk(g.coordinates);
      }
      if (hasBound) map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [points, neighborhoods]);

  const empty = points.length === 0 && !neighborhoods.some((n) => n.geometry);

  return (
    <div className="card analytics-map-card">
      <div className="card-head">
        <div>
          <h3>تحلیل فضایی و Heatmap آسیب‌پذیری</h3>
          <p className="muted">
            وزن بر اساس درآمد، مالکیت، بیکاری و نمره آسیب‌پذیری
            {points.length > 0 ? ` · ${formatNumber(points.length)} نقطه` : ''}
          </p>
        </div>
        <div className="heat-legend">
          <span>کم</span>
          <i />
          <span>زیاد</span>
        </div>
      </div>
      <div className="analytics-map-wrap">
        {empty && (
          <p className="muted analytics-map-empty">
            برای این فیلتر نقطه یا محدوده محله‌ای جهت نمایش فضایی نیست.
          </p>
        )}
        <div ref={containerRef} className="analytics-map" />
      </div>
    </div>
  );
});
