import {
  MapLegendItem,
  MapPrintLayoutSettings,
  computePrintLayoutBoxes,
  formatMapExtent,
  formatScaleBarLabel,
  formatScaleRatio,
  mapFrameMetersPerPixel,
  metersPerPixel,
  niceScaleMeters,
  paperSizePx,
} from '@city-manager/shared';

export interface ComposeMapPrintInput {
  mapCanvas: HTMLCanvasElement;
  settings: MapPrintLayoutSettings;
  legend: MapLegendItem[];
  latitude: number;
  zoom: number;
  bounds: { west: number; south: number; east: number; north: number };
  logo?: HTMLImageElement | null;
  dateLabel?: string;
}

/** فونت چاپ نقشه — هم‌راستا با UI فارسی سامانه */
const PRINT_FONT = 'Vazirmatn, Tahoma, sans-serif';

export async function ensurePrintFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`400 12px ${PRINT_FONT}`),
      document.fonts.load(`700 12px ${PRINT_FONT}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* fallback to system fonts if load fails */
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0 || !text.trim()) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 6);
}

function drawNorthArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.38, size * 0.55);
  ctx.lineTo(0, size * 0.18);
  ctx.lineTo(-size * 0.38, size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.38, size * 0.55);
  ctx.lineTo(0, size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.font = `bold ${Math.round(size * 0.42)}px ${PRINT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.strokeText('N', 0, size * 0.62);
  ctx.fillText('N', 0, size * 0.62);
  ctx.restore();
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  barPx: number,
  meters: number,
) {
  const h = 8;
  const segs = 4;
  const segW = barPx / segs;
  ctx.save();
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#111827' : '#ffffff';
    ctx.fillRect(x + i * segW, y, segW, h);
  }
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barPx, h);
  ctx.fillStyle = '#111827';
  ctx.font = `11px ${PRINT_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('0', x, y - 2);
  ctx.textAlign = 'right';
  ctx.fillText(formatScaleBarLabel(meters), x + barPx, y - 2);
  ctx.restore();
}

function drawLegend(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, items: MapLegendItem[]) {
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 13px ${PRINT_FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.direction = 'rtl';
  ctx.fillText('راهنما', box.x + box.w - 10, box.y + 8);
  const rowH = 22;
  const startY = box.y + 30;
  items.slice(0, Math.floor((box.h - 40) / rowH)).forEach((item, i) => {
    const iy = startY + i * rowH;
    const sw = 14;
    const sx = box.x + 10;
    ctx.fillStyle = item.color;
    ctx.strokeStyle = '#334155';
    if (item.swatch === 'point') {
      ctx.beginPath();
      ctx.arc(sx + sw / 2, iy + 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (item.swatch === 'line') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, iy + 8);
      ctx.lineTo(sx + sw, iy + 8);
      ctx.stroke();
    } else {
      ctx.fillRect(sx, iy + 2, sw, 12);
      ctx.strokeRect(sx, iy + 2, sw, 12);
    }
    ctx.fillStyle = '#1e293b';
    ctx.font = `11px ${PRINT_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(item.label, box.x + box.w - 10, iy + 2);
  });
  ctx.restore();
}

export function composeMapPrintCanvas(input: ComposeMapPrintInput): HTMLCanvasElement {
  const { settings, mapCanvas, legend } = input;
  const page = paperSizePx(settings.paper, settings.orientation, settings.dpi);
  const boxes = computePrintLayoutBoxes(settings, page.width, page.height);
  const out = document.createElement('canvas');
  out.width = page.width;
  out.height = page.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('عدم دسترسی به canvas');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.direction = 'rtl';

  if (settings.showBorder) {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, page.width - 16, page.height - 16);
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, page.width - 28, page.height - 28);
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${Math.round(boxes.title.h * 0.38)}px ${PRINT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(settings.title || 'نقشه', boxes.title.x + boxes.title.w / 2, boxes.title.y + boxes.title.h * 0.42);
  if (settings.subtitle.trim()) {
    ctx.font = `${Math.round(boxes.title.h * 0.24)}px ${PRINT_FONT}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(settings.subtitle.trim(), boxes.title.x + boxes.title.w / 2, boxes.title.y + boxes.title.h * 0.78);
  }

  const mapBox = boxes.map;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(mapBox.x, mapBox.y, mapBox.w, mapBox.h);
  const fit = Math.min(mapBox.w / mapCanvas.width, mapBox.h / mapCanvas.height);
  const drawW = mapCanvas.width * fit;
  const drawH = mapCanvas.height * fit;
  const dx = mapBox.x + (mapBox.w - drawW) / 2;
  const dy = mapBox.y + (mapBox.h - drawH) / 2;
  ctx.drawImage(mapCanvas, dx, dy, drawW, drawH);

  if (settings.showNeatline) {
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(dx, dy, drawW, drawH);
  }

  if (settings.showNorthArrow) {
    const size = Math.max(16, Math.min(36, drawW * 0.045));
    drawNorthArrow(ctx, dx + drawW - size - 18, dy + size + 16, size);
  }

  const mpp = mapFrameMetersPerPixel({
    latitude: input.latitude,
    zoom: input.zoom,
    sourceWidthPx: mapCanvas.width,
    drawnWidthPx: drawW,
  });
  const targetBar = drawW * 0.28;
  const niceM = niceScaleMeters(targetBar * mpp);
  const barPx = niceM / mpp;
  const paperMeters = (drawW / page.width) * (page.widthMm / 1000);
  const groundMeters = mapCanvas.width * metersPerPixel(input.latitude, input.zoom);
  const ratio = formatScaleRatio(groundMeters, paperMeters);

  if (settings.showScale && barPx > 20 && barPx < drawW) {
    drawScaleBar(ctx, dx + 12, dy + drawH - 28, barPx, niceM);
    ctx.fillStyle = '#111827';
    ctx.font = `11px ${PRINT_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.direction = 'ltr';
    ctx.fillText(ratio, dx + 12, dy + drawH - 16);
    ctx.direction = 'rtl';
  }

  if (settings.showLegend && boxes.legend) {
    drawLegend(ctx, boxes.legend, legend);
  }

  const footer = boxes.footer;
  const footerTextW = boxes.logo ? footer.w - boxes.logo.w - 12 : footer.w;
  ctx.fillStyle = '#334155';
  ctx.font = `11px ${PRINT_FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const meta: string[] = [];
  if (settings.showDate) meta.push(input.dateLabel ?? new Date().toLocaleString('fa-IR'));
  if (settings.showCrs) meta.push('سامانه مختصات: WGS84 / EPSG:4326');
  if (settings.showExtent) meta.push(`محدوده: ${formatMapExtent(input.bounds)}`);
  if (settings.showProducer && (settings.producer.trim() || settings.organization.trim())) {
    meta.push(`تهیه‌کننده: ${[settings.organization, settings.producer].filter(Boolean).join(' — ')}`);
  }
  meta.forEach((line, i) => {
    ctx.fillText(line, footer.x + footerTextW, footer.y + 4 + i * 14);
  });

  if (settings.description.trim()) {
    ctx.fillStyle = '#1e293b';
    ctx.font = `11px ${PRINT_FONT}`;
    const lines = wrapText(ctx, `توضیحات: ${settings.description.trim()}`, footerTextW - 8);
    lines.forEach((line, i) => {
      ctx.fillText(line, footer.x + footerTextW, footer.y + 4 + meta.length * 14 + i * 14);
    });
  }

  if (settings.showDisclaimer && settings.disclaimer.trim()) {
    ctx.fillStyle = '#64748b';
    ctx.font = `10px ${PRINT_FONT}`;
    ctx.fillText(settings.disclaimer.trim(), footer.x + footerTextW, footer.y + footer.h - 16);
  }

  if (settings.showLogo && boxes.logo && input.logo) {
    roundRect(ctx, boxes.logo.x, boxes.logo.y, boxes.logo.w, boxes.logo.h, 6);
    ctx.save();
    ctx.clip();
    ctx.drawImage(input.logo, boxes.logo.x, boxes.logo.y, boxes.logo.w, boxes.logo.h);
    ctx.restore();
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(boxes.logo.x, boxes.logo.y, boxes.logo.w, boxes.logo.h);
  }

  return out;
}
