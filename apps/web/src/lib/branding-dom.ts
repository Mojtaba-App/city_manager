/** DOM helpers for org branding (favicon / title). */

export function applyFavicon(href: string, opts?: { type?: string }) {
  if (typeof document === 'undefined' || !href) return;

  const ensure = (rel: string) => {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    if (opts?.type) link.type = opts.type;
    else link.removeAttribute('type');
    link.href = href;
    return link;
  };

  ensure('icon');
  ensure('shortcut icon');

  // Keep touch icon in sync when a raster image is used.
  if (!href.startsWith('data:image/svg') && !/\.ico(\?|$)/i.test(href)) {
    ensure('apple-touch-icon');
  }
}

export function clearFaviconToDefault() {
  if (typeof document === 'undefined') return;
  for (const rel of ['icon', 'shortcut icon', 'apple-touch-icon']) {
    document.querySelectorAll(`link[rel="${rel}"]`).forEach((n) => n.remove());
  }
}

export function guessImageMime(file: File): string | undefined {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'ico') return 'image/x-icon';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return undefined;
}

/** Downscale / recompress large uploads so org_branding settings stay lightweight. */
export async function optimizeImageFile(
  file: File,
  opts: { maxBytes: number; maxEdge: number; quality?: number },
): Promise<string> {
  const mime = guessImageMime(file) ?? 'image/png';
  const isIco = mime.includes('icon') || /\.ico$/i.test(file.name);
  const isSvg = mime.includes('svg');

  if (isIco || isSvg) {
    if (file.size > opts.maxBytes) {
      throw new Error(`حجم فایل بیش از ${Math.round(opts.maxBytes / 1000)} کیلوبایت است`);
    }
    return readFileAsDataUrl(file);
  }

  if (file.size <= opts.maxBytes && !opts.maxEdge) {
    return readFileAsDataUrl(file);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size > opts.maxBytes) {
      throw new Error(`حجم فایل بیش از ${Math.round(opts.maxBytes / 1000)} کیلوبایت است`);
    }
    return readFileAsDataUrl(file);
  }

  try {
    const scale = Math.min(1, opts.maxEdge / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return readFileAsDataUrl(file);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const outMime = mime.includes('png') && file.size < opts.maxBytes ? 'image/png' : 'image/jpeg';
    let quality = opts.quality ?? 0.82;
    let dataUrl = canvas.toDataURL(outMime, quality);
    while (dataUrl.length * 0.75 > opts.maxBytes && quality > 0.45) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length * 0.75 > opts.maxBytes) {
      throw new Error(`پس از فشرده‌سازی هنوز حجم زیاد است (حداکثر حدود ${Math.round(opts.maxBytes / 1000)} کیلوبایت)`);
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود'));
    reader.readAsDataURL(file);
  });
}
