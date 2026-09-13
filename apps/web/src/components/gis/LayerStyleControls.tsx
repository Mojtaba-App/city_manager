'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  UrbanLayerCategory,
  clampOpacity,
  isNoFill,
  normalizeHexColor,
  opacityToTransparency,
  restoreFillOpacity,
  transparencyToOpacity,
} from '@city-manager/shared';
import { UrbanLayerCategorySelect } from './UrbanLayerCategorySelect';

export function LayerStyleAccordion({
  title = 'ظاهر لایه',
  color,
  opacity = 0.35,
  noFill,
  children,
}: {
  title?: string;
  color: string;
  opacity?: number;
  noFill?: boolean;
  children: ReactNode;
}) {
  const hex = normalizeHexColor(color);
  const outlineOnly = noFill ?? isNoFill(opacity);
  const fillAlpha = clampOpacity(Number(opacity), 0.35);
  return (
    <details className="layer-style-accordion">
      <summary>
        <span
          className={`gis-color-swatch${outlineOnly ? ' gis-color-swatch-outline' : ''}`}
          style={outlineOnly ? { borderColor: hex, color: hex } : { background: hex, opacity: fillAlpha <= 0 ? 0.35 : fillAlpha }}
        />
        <span>{title}</span>
      </summary>
      {children}
    </details>
  );
}

export function LayerStyleControls({
  color,
  opacity,
  category,
  showCategory,
  onColor,
  onOpacity,
  onCategory,
  disabled,
}: {
  color: string;
  opacity: number;
  category?: string;
  showCategory?: boolean;
  onColor: (hex: string) => void;
  onOpacity: (value: number) => void;
  onCategory?: (value: UrbanLayerCategory) => void;
  disabled?: boolean;
}) {
  const noFill = isNoFill(opacity);
  const [localOpacity, setLocalOpacity] = useState(() =>
    noFill ? 0.35 : clampOpacity(Number(opacity), 0.35),
  );
  const [localColor, setLocalColor] = useState(() => normalizeHexColor(color));
  const lastColor = useRef(normalizeHexColor(color));
  const lastFilledOpacity = useRef(noFill ? 0.35 : clampOpacity(Number(opacity), 0.35));
  const lastSentOpacity = useRef(clampOpacity(Number(opacity), 0));
  const localOpacityRef = useRef(localOpacity);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  localOpacityRef.current = localOpacity;

  useEffect(() => {
    if (isNoFill(opacity)) return;
    const next = clampOpacity(Number(opacity), 0.35);
    setLocalOpacity(next);
    lastFilledOpacity.current = next;
    lastSentOpacity.current = next;
  }, [opacity]);

  useEffect(() => {
    lastSentOpacity.current = isNoFill(opacity) ? 0 : clampOpacity(Number(opacity), 0);
  }, [opacity]);

  useEffect(() => {
    const next = normalizeHexColor(color);
    setLocalColor(next);
    lastColor.current = next;
  }, [color]);

  useEffect(
    () => () => {
      clearTimeout(colorTimer.current);
    },
    [],
  );

  function commitColor(hex: string, immediate: boolean) {
    const next = normalizeHexColor(hex);
    setLocalColor(next);
    const send = () => {
      if (lastColor.current === next) return;
      lastColor.current = next;
      onColor(next);
    };
    clearTimeout(colorTimer.current);
    if (immediate) {
      send();
      return;
    }
    colorTimer.current = setTimeout(send, 450);
  }

  function commitOpacity(value: number) {
    const next = clampOpacity(value, 0);
    if (lastSentOpacity.current === next) return;
    lastSentOpacity.current = next;
    if (next > 0) lastFilledOpacity.current = next;
    onOpacity(next);
  }

  function toggleNoFill(checked: boolean) {
    if (checked) {
      commitOpacity(0);
      return;
    }
    const restored = restoreFillOpacity(lastFilledOpacity.current);
    setLocalOpacity(restored);
    commitOpacity(restored);
  }

  const transparency = opacityToTransparency(localOpacity);
  const colorValue = localColor.startsWith('#') && localColor.length === 7 ? localColor : '#2e86ab';

  return (
    <div className="layer-style-controls">
      {showCategory && onCategory && (
        <label className="layer-style-field">
          <span>دسته</span>
          <UrbanLayerCategorySelect
            disabled={disabled || noFill}
            value={category ?? UrbanLayerCategory.CUSTOM}
            onChange={onCategory}
          />
        </label>
      )}
      <label className="layer-style-field">
        <span>{noFill ? 'رنگ مرز' : 'رنگ'}</span>
        <input
          type="color"
          disabled={disabled}
          value={colorValue}
          onChange={(e) => commitColor(e.target.value, false)}
          onPointerUp={() => commitColor(localColor, true)}
          onBlur={() => commitColor(localColor, true)}
        />
      </label>
      <label className="layer-style-field layer-style-check">
        <span>بدون رنگ داخل</span>
        <input
          type="checkbox"
          disabled={disabled}
          checked={noFill}
          onChange={(e) => toggleNoFill(e.target.checked)}
        />
      </label>
      <label className="layer-style-field layer-style-slider">
        <span>شفافیت {Math.round(transparency * 100)}٪</span>
        <input
          type="range"
          min={0}
          max={99}
          disabled={disabled || noFill}
          value={Math.round(transparency * 100)}
          onChange={(e) => {
            const next = transparencyToOpacity(Number(e.target.value) / 100);
            localOpacityRef.current = next;
            setLocalOpacity(next);
          }}
          onPointerUp={() => { if (!noFill) commitOpacity(localOpacityRef.current); }}
          onBlur={() => { if (!noFill) commitOpacity(localOpacityRef.current); }}
        />
      </label>
    </div>
  );
}
