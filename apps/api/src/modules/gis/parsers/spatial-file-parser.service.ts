import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { SpatialFileFormat } from '@city-manager/shared';

// jszip CJS/ESM interop under Nest/ts-node
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require('jszip') as typeof import('jszip');

export interface ParsedGeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }>;
}

@Injectable()
export class SpatialFileParserService {
  private readonly logger = new Logger(SpatialFileParserService.name);

  async parse(
    buffer: Buffer,
    filename: string,
    mimeType?: string,
  ): Promise<{ format: SpatialFileFormat; geojson: ParsedGeoJson }> {
    const format = this.detectFormat(filename, mimeType);
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    switch (format) {
      case SpatialFileFormat.GEOJSON:
        return { format, geojson: this.parseGeoJson(data) };
      case SpatialFileFormat.KML:
        return { format, geojson: this.parseKml(data) };
      case SpatialFileFormat.KMZ:
        return { format, geojson: await this.parseKmz(data) };
      case SpatialFileFormat.SHAPEFILE:
        return { format, geojson: await this.parseShapefile(data, filename) };
      default:
        throw new BadRequestException('فرمت فایل پشتیبانی نمی‌شود');
    }
  }

  private detectFormat(filename: string, mimeType?: string): SpatialFileFormat {
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (ext === 'geojson' || ext === 'json') return SpatialFileFormat.GEOJSON;
    if (ext === 'kml') return SpatialFileFormat.KML;
    if (ext === 'kmz') return SpatialFileFormat.KMZ;
    if (ext === 'zip' || ext === 'shp') return SpatialFileFormat.SHAPEFILE;
    if (mimeType?.includes('geo+json')) return SpatialFileFormat.GEOJSON;
    if (mimeType?.includes('kml')) return SpatialFileFormat.KML;
    throw new BadRequestException(
      'فرمت مجاز: GeoJSON, KML, KMZ, Shapefile (zip)',
    );
  }

  private parseGeoJson(buffer: Buffer): ParsedGeoJson {
    const parsed = JSON.parse(buffer.toString('utf-8'));
    if (parsed.type === 'Feature') {
      return { type: 'FeatureCollection', features: [parsed] };
    }
    if (parsed.type === 'FeatureCollection') {
      return parsed as ParsedGeoJson;
    }
    if (parsed.type && parsed.coordinates) {
      return {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: parsed, properties: {} }],
      };
    }
    throw new BadRequestException('GeoJSON نامعتبر است');
  }

  private parseKml(buffer: Buffer): ParsedGeoJson {
    // Node cannot build a string longer than ~512MB; huge Google-Earth KML
    // exports also OOM xmldom. Prefer DOM for modest files, buffer-scan otherwise.
    const DOM_LIMIT = 32 * 1024 * 1024;
    if (buffer.length > DOM_LIMIT) {
      this.logger.log(`KML ${Math.round(buffer.length / 1024 / 1024)}MB — buffer scan parser`);
      return this.parseKmlCoordinateScan(buffer);
    }
    try {
      return this.parseKmlDom(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/string longer than|Invalid string length|Cannot create a string/i.test(msg)) {
        this.logger.warn(`KML DOM parse hit string limit — falling back to scan`);
        return this.parseKmlCoordinateScan(buffer);
      }
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`KML DOM failed (${msg}) — falling back to scan`);
      return this.parseKmlCoordinateScan(buffer);
    }
  }

  private parseKmlDom(buffer: Buffer): ParsedGeoJson {
    const xmlText = this.decodeXmlText(buffer);
    if (!/<kml[\s>]/i.test(xmlText) && !/<Document[\s>]/i.test(xmlText)) {
      throw new BadRequestException('محتوای KML نامعتبر است');
    }
    const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    const parseError = xml.getElementsByTagName?.('parsererror')?.[0];
    if (parseError) {
      throw new BadRequestException('XML داخل KML قابل تجزیه نیست');
    }
    const geojson = kml(xml as unknown as Document) as ParsedGeoJson;
    const features = (geojson?.features ?? [])
      .filter((f) => f && f.geometry && f.geometry.type)
      .map((f) => ({
        ...f,
        properties: f.properties ?? {},
      }));
    if (!features.length) {
      throw new BadRequestException('فایل KML فاقد عارضه مکانی است');
    }
    return { type: 'FeatureCollection', features };
  }

  /**
   * Extract Polygon/LineString coordinates from a huge KML without building one giant JS string.
   * Tags and coordinate payloads are ASCII in almost all GIS exports.
   */
  private parseKmlCoordinateScan(buffer: Buffer): ParsedGeoJson {
    const open = Buffer.from('<coordinates');
    const close = Buffer.from('</coordinates>');
    const features: ParsedGeoJson['features'] = [];
    let cursor = 0;
    let guard = 0;
    const maxFeatures = 250_000;

    while (guard++ < maxFeatures) {
      const startTag = buffer.indexOf(open, cursor);
      if (startTag < 0) break;
      const gt = buffer.indexOf(0x3e /* > */, startTag);
      if (gt < 0) break;
      const endTag = buffer.indexOf(close, gt + 1);
      if (endTag < 0) break;

      const raw = buffer.subarray(gt + 1, endTag);
      // Skip absurdly large single rings (corruption) — still allow multi-MB rings
      if (raw.length > 0 && raw.length < 80 * 1024 * 1024) {
        const ring = this.parseKmlCoordinateText(raw.toString('utf8'));
        if (ring.length >= 4) {
          const props = this.extractKmlPropertiesNear(buffer, startTag);
          if (!props.name) props.name = `عارضه ${features.length + 1}`;
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: props,
          });
        } else if (ring.length >= 2) {
          // LineString fallback — ingest filters polygons; skip lines for urban layers
        }
      }
      cursor = endTag + close.length;
    }

    if (!features.length) {
      throw new BadRequestException(
        'در KML بزرگ هیچ چندضلعی با مختصات معتبر یافت نشد. فایل را در QGIS به GeoJSON تبدیل کنید.',
      );
    }
    this.logger.log(`KML scan imported ${features.length} polygon ring(s)`);
    return { type: 'FeatureCollection', features };
  }

  private parseKmlCoordinateText(text: string): [number, number][] {
    const coords: [number, number][] = [];
    const tokens = text.trim().split(/[\s\n\r\t]+/);
    for (const token of tokens) {
      if (!token) continue;
      const parts = token.split(',');
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      if (Math.abs(lon) > 180 || Math.abs(lat) > 90) continue;
      coords.push([lon, lat]);
    }
    if (coords.length >= 3) {
      const [lon0, lat0] = coords[0];
      const [lonN, latN] = coords[coords.length - 1];
      if (lon0 !== lonN || lat0 !== latN) coords.push([lon0, lat0]);
    }
    return coords;
  }

  /** Look back a window for <name>, and ExtendedData / SchemaData fields. */
  private extractKmlPropertiesNear(
    buffer: Buffer,
    beforeIndex: number,
  ): Record<string, unknown> {
    const windowStart = Math.max(0, beforeIndex - 28_000);
    const slice = buffer.subarray(windowStart, beforeIndex).toString('utf8');
    const props: Record<string, unknown> = {};

    const nameMatches = [...slice.matchAll(/<name\b[^>]*>([^<]{1,300})<\/name>/gi)];
    if (nameMatches.length) {
      const raw = nameMatches[nameMatches.length - 1][1]?.trim();
      if (raw && !/^(untitled|без названия)$/i.test(raw)) props.name = raw;
    }

    for (const m of slice.matchAll(/<SimpleData\s+name\s*=\s*["']([^"']+)["']\s*>([^<]*)<\/SimpleData>/gi)) {
      const key = m[1]?.trim();
      const val = m[2]?.trim();
      if (key && val !== undefined && val !== '') props[key] = val;
    }

    for (const m of slice.matchAll(
      /<Data\s+name\s*=\s*["']([^"']+)["']\s*>\s*(?:<displayName>[^<]*<\/displayName>\s*)?<value>([^<]*)<\/value>/gi,
    )) {
      const key = m[1]?.trim();
      const val = m[2]?.trim();
      if (key && val !== undefined && val !== '') props[key] = val;
    }

    const descMatch = slice.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i);
    if (descMatch?.[1]) {
      let raw = descMatch[1].trim();
      const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
      if (cdata?.[1]) raw = cdata[1].trim();
      raw = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      if (raw) {
        props.description = /<\/?[a-z]/i.test(raw)
          ? { '@type': 'html', value: raw }
          : raw;
      }
    }

    return props;
  }

  /** Strip BOM and decode common KML encodings (only for modest buffers). */
  private decodeXmlText(buffer: Buffer): string {
    const NODE_MAX = 0x1fffffe8;
    if (buffer.length >= NODE_MAX - 1024) {
      throw new Error('Cannot create a string longer than 0x1fffffe8 characters');
    }
    // UTF-8 BOM
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.subarray(3).toString('utf8');
    }
    // UTF-16 LE BOM — reject huge to avoid 2× inflate surprises
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      if (buffer.length > 64 * 1024 * 1024) {
        throw new Error('Cannot create a string longer than 0x1fffffe8 characters');
      }
      return buffer.toString('utf16le');
    }
    // UTF-16 BE BOM
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
      if (buffer.length > 64 * 1024 * 1024) {
        throw new Error('Cannot create a string longer than 0x1fffffe8 characters');
      }
      const swapped = Buffer.alloc(buffer.length - 2);
      for (let i = 2; i + 1 < buffer.length; i += 2) {
        swapped[i - 2] = buffer[i + 1];
        swapped[i - 1] = buffer[i];
      }
      return swapped.toString('utf16le');
    }
    let text = buffer.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return text;
  }

  private async parseKmz(buffer: Buffer): Promise<ParsedGeoJson> {
    if (!buffer?.length) {
      throw new BadRequestException('فایل KMZ خالی است');
    }
    // ZIP local-file magic
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new BadRequestException(
        'فایل KMZ معتبر نیست (ساختار ZIP یافت نشد). اگر حجم فایل بزرگ است، پس از ری‌استارت سرور دوباره آپلود کنید.',
      );
    }

    let zip: import('jszip');
    try {
      zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`KMZ unzip failed: ${detail}`);
      throw new BadRequestException(
        'خواندن KMZ ناموفق بود (فایل خراب یا ناقص است). دوباره آپلود کنید یا به‌صورت KML/GeoJSON ذخیره کنید.',
      );
    }

    const kmlPaths = Object.keys(zip.files)
      .filter((f) => !zip.files[f].dir && f.toLowerCase().endsWith('.kml'))
      .sort((a, b) => {
        const score = (p: string) => {
          const lower = p.replace(/\\/g, '/').toLowerCase();
          const base = lower.split('/').pop() ?? lower;
          if (base === 'doc.kml') return 0;
          if (lower === 'doc.kml') return 0;
          return lower.split('/').length * 10 + lower.length;
        };
        return score(a) - score(b);
      });

    if (!kmlPaths.length) {
      throw new BadRequestException('فایل KMZ فاقد KML است');
    }

    const errors: string[] = [];
    for (const path of kmlPaths) {
      try {
        const raw = await zip.files[path].async('uint8array');
        const kmlBuffer = Buffer.from(raw);
        return this.parseKml(kmlBuffer);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${path}: ${msg}`);
        this.logger.warn(`KMZ entry failed (${path}): ${msg}`);
      }
    }

    throw new BadRequestException(
      `خواندن KMZ ناموفق بود (${kmlPaths.length} فایل KML). ${errors[0] ?? 'محتوای KML نامعتبر است'}`,
    );
  }

  private async parseShapefile(buffer: Buffer, filename: string): Promise<ParsedGeoJson> {
    try {
      const g = globalThis as Record<string, unknown>;
      if (typeof g.self === 'undefined') g.self = globalThis;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const shp = require('shpjs') as (input: Buffer) => Promise<unknown>;
      const geojson = await shp(buffer);
      if (Array.isArray(geojson)) {
        return {
          type: 'FeatureCollection',
          features: geojson.flatMap((g) => (g as ParsedGeoJson).features ?? []),
        };
      }
      return geojson as ParsedGeoJson;
    } catch {
      throw new BadRequestException(
        `Shapefile نامعتبر است. فایل zip باید شامل .shp, .dbf, .shx باشد (${filename})`,
      );
    }
  }

  extractPolygons(geojson: ParsedGeoJson) {
    return geojson.features.filter((f) => {
      const t = f.geometry?.type?.toLowerCase() ?? '';
      return t.includes('polygon');
    });
  }

  extractPoints(geojson: ParsedGeoJson) {
    return geojson.features.filter((f) => {
      const t = f.geometry?.type?.toLowerCase() ?? '';
      return t === 'point' || t === 'multipoint';
    });
  }
}
