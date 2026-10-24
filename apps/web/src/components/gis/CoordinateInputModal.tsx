'use client';

import { useMemo, useState } from 'react';
import {
  CoordSystem,
  IRAN_UTM_ZONES,
  parseCoordinateText,
  UtmHemisphere,
  wgs84ToUtm,
} from '@city-manager/shared';
import type { Geometry } from 'geojson';
import { pointsToGeometry, LngLat } from './draw-geometry';

const WGS84_SAMPLE = '48.669, 31.320\n48.675, 31.320\n48.675, 31.326\n48.669, 31.326';

function utmSample(zone: number): string {
  const pts: Array<[number, number]> = [
    [48.669, 31.32],
    [48.675, 31.32],
    [48.675, 31.326],
    [48.669, 31.326],
  ];
  return pts
    .map(([lng, lat]) => {
      const u = wgs84ToUtm(lng, lat, zone);
      return `${u.easting.toFixed(2)}, ${u.northing.toFixed(2)}`;
    })
    .join('\n');
}

export function CoordinateInputModal({
  onApply,
  onClose,
}: {
  onApply: (geometry: Geometry) => void;
  onClose: () => void;
}) {
  const [system, setSystem] = useState<CoordSystem>('wgs84');
  const [text, setText] = useState(WGS84_SAMPLE);
  const [kind, setKind] = useState<'polygon' | 'line' | 'point'>('polygon');
  const [swap, setSwap] = useState(false);
  const [zone, setZone] = useState(39);
  const [hemisphere, setHemisphere] = useState<UtmHemisphere>('N');
  const [error, setError] = useState('');

  const otherZones = useMemo(
    () => Array.from({ length: 60 }, (_, i) => i + 1).filter((z) => !(IRAN_UTM_ZONES as readonly number[]).includes(z)),
    [],
  );

  function applySystem(next: CoordSystem) {
    const parsed = parseCoordinateText(text, {
      system,
      swapLatLng: swap,
      utmZone: zone,
      utmHemisphere: hemisphere,
    });
    setSystem(next);
    setError('');
    if (!parsed.ok || parsed.points.length === 0) {
      setText(next === 'utm' ? utmSample(zone) : WGS84_SAMPLE);
      return;
    }
    if (next === 'utm') {
      const z = zone || 39;
      setText(
        parsed.points
          .map(([lng, lat]) => {
            const u = wgs84ToUtm(lng, lat, z);
            return `${u.easting.toFixed(2)}, ${u.northing.toFixed(2)}`;
          })
          .join('\n'),
      );
      return;
    }
    setText(parsed.points.map(([lng, lat]) => `${lng.toFixed(6)}, ${lat.toFixed(6)}`).join('\n'));
  }

  function submit() {
    const parsed = parseCoordinateText(text, {
      system,
      swapLatLng: swap,
      utmZone: zone,
      utmHemisphere: hemisphere,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const geometry = pointsToGeometry(parsed.points as LngLat[], kind);
    if (!geometry) {
      setError(
        kind === 'point'
          ? 'حداقل یک نقطه لازم است'
          : kind === 'line'
            ? 'حداقل دو نقطه برای خط لازم است'
            : 'حداقل سه نقطه برای چندضلعی لازم است',
      );
      return;
    }
    onApply(geometry);
    onClose();
  }

  return (
    <div className="gis-upload-modal" role="dialog" aria-modal="true" aria-labelledby="gis-coord-title">
      <div className="gis-upload-card gis-coord-card">
        <h3 id="gis-coord-title">ورود مختصات</h3>

        <div className="gis-coord-mode" role="tablist" aria-label="سامانه مختصات">
          <button
            type="button"
            role="tab"
            aria-selected={system === 'wgs84'}
            className={system === 'wgs84' ? 'active' : ''}
            onClick={() => applySystem('wgs84')}
          >
            طول و عرض جغرافیایی
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={system === 'utm'}
            className={system === 'utm' ? 'active' : ''}
            onClick={() => applySystem('utm')}
          >
            UTM
          </button>
        </div>

        <p className="gis-upload-hint">
          {system === 'wgs84' ? (
            <>
              هر سطر یک نقطه به‌صورت <code>طول، عرض</code> (lng, lat) — مثلاً <code>48.669, 31.320</code>
              {' '}یا آرایه JSON مثل <code>[[51.39,35.69],[51.40,35.70]]</code>
            </>
          ) : (
            <>
              هر سطر <code>Easting, Northing</code> در زون انتخابی — مثلاً <code>277215.41, 3465122.08</code>
              . زون‌های رایج ایران ۳۸ تا ۴۱ شمالی است.
            </>
          )}
        </p>

        <label className="form-group">
          <span>نوع هندسه</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="polygon">چندضلعی (Polygon)</option>
            <option value="line">خط (Line)</option>
            <option value="point">نقطه (Point)</option>
          </select>
        </label>

        {system === 'wgs84' ? (
          <label className="gis-check">
            <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} />
            ترتیب lat,lng است (به‌جای lng,lat)
          </label>
        ) : (
          <div className="gis-coord-utm-fields">
            <label className="form-group">
              <span>زون UTM</span>
              <select value={zone} onChange={(e) => setZone(Number(e.target.value))}>
                <optgroup label="ایران">
                  {IRAN_UTM_ZONES.map((z) => (
                    <option key={z} value={z}>{z}N</option>
                  ))}
                </optgroup>
                <optgroup label="سایر زون‌ها">
                  {otherZones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="form-group">
              <span>نیمکره</span>
              <select value={hemisphere} onChange={(e) => setHemisphere(e.target.value as UtmHemisphere)}>
                <option value="N">شمالی (N)</option>
                <option value="S">جنوبی (S)</option>
              </select>
            </label>
          </div>
        )}

        <label className="form-group form-full">
          <span>{system === 'utm' ? 'Easting, Northing' : 'مختصات'}</span>
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            dir="ltr"
          />
        </label>

        {error && <p className="error-message">{error}</p>}

        <div className="gis-upload-actions">
          <button type="button" className="btn btn-primary" onClick={submit}>اعمال روی نقشه</button>
          <button type="button" className="btn" onClick={onClose}>انصراف</button>
        </div>
      </div>
    </div>
  );
}
