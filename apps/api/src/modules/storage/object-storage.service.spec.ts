import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ObjectStorageService } from './object-storage.service';

describe('ObjectStorageService (local fallback)', () => {
  let dir: string;
  let svc: ObjectStorageService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cm-storage-'));
    const config = {
      get: (key: string, def?: string) => {
        if (key === 'STORAGE_LOCAL_PATH') return dir;
        if (key === 'S3_BUCKET') return 'bucket';
        return def;
      },
    } as ConfigService;
    svc = new ObjectStorageService(config);
    svc.onModuleInit();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('isRemoteEnabled is false without S3 env', () => {
    expect(svc.isRemoteEnabled()).toBe(false);
  });

  it('put/get object locally', async () => {
    const put = await svc.putObject('gis/a.geojson', '{"type":"FeatureCollection"}', 'application/json');
    expect(put.bucket).toBe('local');
    expect(put.key).toBe('gis/a.geojson');
    const buf = await svc.getObjectBuffer('gis/a.geojson');
    expect(buf.toString()).toContain('FeatureCollection');
  });
});
