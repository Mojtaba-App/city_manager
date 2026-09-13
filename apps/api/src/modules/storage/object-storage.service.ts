import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PutObjectResult {
  bucket: string;
  key: string;
  etag?: string;
  url: string;
}

/**
 * Object storage abstraction (MinIO / S3-compatible).
 * Dev fallback: local directory under STORAGE_LOCAL_PATH.
 * Prod: path-style PUT to S3_ENDPOINT (pre-signed style via gateway in later stage).
 */
@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly log = new Logger(ObjectStorageService.name);
  private readonly endpoint?: string;
  private readonly bucket: string;
  private readonly accessKey?: string;
  private readonly secretKey?: string;
  private readonly region: string;
  private readonly forcePathStyle: boolean;
  private readonly localPath: string;

  constructor(config: ConfigService) {
    this.endpoint = config.get<string>('S3_ENDPOINT');
    this.bucket = config.get<string>('S3_BUCKET', 'city-manager-uploads');
    this.accessKey = config.get<string>('S3_ACCESS_KEY');
    this.secretKey = config.get<string>('S3_SECRET_KEY');
    this.region = config.get<string>('S3_REGION', 'us-east-1');
    this.forcePathStyle = config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';
    this.localPath = config.get<string>('STORAGE_LOCAL_PATH', '/tmp/city-manager-uploads');
  }

  onModuleInit() {
    if (this.isRemoteEnabled()) {
      this.log.log(`Object storage: ${this.endpoint} bucket=${this.bucket}`);
    } else {
      this.log.warn(`Object storage: local fallback → ${this.localPath}`);
    }
  }

  isRemoteEnabled(): boolean {
    return Boolean(this.endpoint && this.accessKey && this.secretKey);
  }

  /** Public URL for clients (nginx/minio gateway may rewrite) */
  publicUrl(key: string): string {
    if (!this.isRemoteEnabled()) {
      return `file://${path.join(this.localPath, key)}`;
    }
    if (this.forcePathStyle) {
      return `${this.endpoint}/${this.bucket}/${key}`;
    }
    const host = this.endpoint!.replace(/^https?:\/\//, '');
    return `https://${this.bucket}.${host}/${key}`;
  }

  async putObject(
    key: string,
    body: Buffer | string,
    contentType = 'application/octet-stream',
  ): Promise<PutObjectResult> {
    const buf = typeof body === 'string' ? Buffer.from(body) : body;
    if (!this.isRemoteEnabled()) {
      const full = path.join(this.localPath, key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buf);
      return { bucket: 'local', key, url: this.publicUrl(key), etag: this.md5(buf) };
    }

    // Minimal path-style PUT (unsigned only for trusted private network / use gateway).
    // Production should use SigV4 via @aws-sdk/client-s3 or pre-signed URLs.
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buf.length),
        Authorization: `Bearer ${this.accessKey}`, // replace with SigV4 in prod SDK
      },
      body: new Uint8Array(buf),
    });
    if (!res.ok) {
      // Fallback: store locally and log — avoids hard fail during rollout
      this.log.warn(`S3 PUT failed ${res.status}; writing local copy of ${key}`);
      const full = path.join(this.localPath, key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buf);
      return { bucket: this.bucket, key, url: this.publicUrl(key) };
    }
    return {
      bucket: this.bucket,
      key,
      url: this.publicUrl(key),
      etag: res.headers.get('etag') ?? this.md5(buf),
    };
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    if (!this.isRemoteEnabled()) {
      return fs.readFile(path.join(this.localPath, key));
    }
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET object failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private md5(buf: Buffer): string {
    return crypto.createHash('md5').update(buf).digest('hex');
  }
}
