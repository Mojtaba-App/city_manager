import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapPrintLayoutSettings } from '@city-manager/shared';
import { composeMapPrintCanvas, ComposeMapPrintInput, ensurePrintFontsReady } from './map-print-compose';

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function fileSlug(title: string): string {
  const s = title.trim().replace(/\s+/g, '-').slice(0, 40);
  return s || 'map';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Capture current map viewport (requires preserveDrawingBuffer on Map). */
export async function captureMapCanvas(map: MapLibreMap): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const run = () => {
      try {
        const canvas = map.getCanvas();
        if (!canvas.width || !canvas.height) {
          reject(new Error('بوم نقشه خالی است'));
          return;
        }
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext('2d');
        if (!ctx) {
          reject(new Error('عدم دسترسی به canvas'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    map.once('idle', run);
    map.triggerRepaint();
  });
}

export async function exportComposedMap(
  composed: HTMLCanvasElement,
  format: 'png' | 'pdf',
  title: string,
): Promise<void> {
  const base = `${fileSlug(title)}-${stamp()}`;
  if (format === 'png') {
    await new Promise<void>((resolve, reject) => {
      composed.toBlob((blob) => {
        if (!blob) {
          reject(new Error('ساخت تصویر ناموفق بود'));
          return;
        }
        downloadBlob(blob, `${base}.png`);
        resolve();
      }, 'image/png');
    });
    return;
  }

  const jpegDataUrl = composed.toDataURL('image/jpeg', 0.92);
  const jpegBase64 = jpegDataUrl.split(',')[1];
  const jpegBytes = Uint8Array.from(atob(jpegBase64), (c) => c.charCodeAt(0));
  const imgW = composed.width;
  const imgH = composed.height;
  const pageW = imgW;
  const pageH = imgH;

  const parts: (string | Uint8Array)[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  const enc = new TextEncoder();
  const push = (chunk: string | Uint8Array) => {
    parts.push(chunk);
    cursor += typeof chunk === 'string' ? enc.encode(chunk).length : chunk.length;
  };
  const startObj = (n: number) => {
    offsets[n] = cursor;
  };

  push('%PDF-1.4\n');
  startObj(1);
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2);
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  startObj(3);
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`,
  );
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q\n`;
  const contentBin = enc.encode(content);
  startObj(4);
  push(`4 0 obj\n<< /Length ${contentBin.length} >>\nstream\n`);
  push(contentBin);
  push('\nendstream\nendobj\n');
  startObj(5);
  push(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  push(jpegBytes);
  push('\nendstream\nendobj\n');
  const xrefStart = cursor;
  push('xref\n0 6\n');
  push('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  downloadBlob(new Blob(parts as BlobPart[], { type: 'application/pdf' }), `${base}.pdf`);
}

export async function exportMapWithLayout(
  map: MapLibreMap,
  settings: MapPrintLayoutSettings,
  extra: Omit<ComposeMapPrintInput, 'mapCanvas' | 'settings'>,
  format: 'png' | 'pdf',
): Promise<void> {
  const mapCanvas = await captureMapCanvas(map);
  await ensurePrintFontsReady();
  const composed = composeMapPrintCanvas({ mapCanvas, settings, ...extra });
  await exportComposedMap(composed, format, settings.title);
}
