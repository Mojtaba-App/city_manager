import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncJob } from '../entities/sync-job.entity';
import { SyncJobLog } from '../entities/sync-job-log.entity';
import { FieldMapping } from '../entities/field-mapping.entity';
import { ExternalIdMapping } from '../entities/external-id-mapping.entity';
import { ConnectorsService } from './connectors.service';
import { ConnectionTestService } from './connection-test.service';
import { SyncEntityWriterService } from './sync-entity-writer.service';
import { SyncDlqService } from './sync-dlq.service';
import { parseCsvRecords } from './csv-parse';
import { ConnectorType, SyncJobStatus, DEFAULT_RETRY_POLICY } from '@city-manager/shared';

@Injectable()
export class SyncRunnerService {
  private readonly logger = new Logger(SyncRunnerService.name);

  constructor(
    @InjectRepository(SyncJob) private readonly jobRepo: Repository<SyncJob>,
    @InjectRepository(SyncJobLog) private readonly logRepo: Repository<SyncJobLog>,
    @InjectRepository(FieldMapping) private readonly mapRepo: Repository<FieldMapping>,
    @InjectRepository(ExternalIdMapping) private readonly extRepo: Repository<ExternalIdMapping>,
    private readonly connectors: ConnectorsService,
    private readonly connectionTest: ConnectionTestService,
    private readonly writer: SyncEntityWriterService,
    private readonly dlq: SyncDlqService,
  ) {}

  async listJobs(orgId: string, connectorId?: string, limit = 30) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (connectorId) where.connectorId = connectorId;
    const data = await this.jobRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { success: true, data };
  }

  async getJob(orgId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId, organizationId: orgId } });
    if (!job) return { success: false, error: { code: 'NOT_FOUND', message: 'جاب یافت نشد' } };
    const logs = await this.logRepo.find({
      where: { syncJobId: jobId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    return { success: true, data: { job, logs } };
  }

  async run(
    orgId: string,
    connectorId: string,
    userId?: string,
    triggerType: 'manual' | 'schedule' | 'webhook' | 'retry' = 'manual',
    existingJobId?: string,
  ) {
    const connector = await this.connectors.require(orgId, connectorId);
    let job = existingJobId
      ? await this.jobRepo.findOne({ where: { id: existingJobId } })
      : null;

    if (!job) {
      job = await this.jobRepo.save(
        this.jobRepo.create({
          organizationId: orgId,
          connectorId,
          status: SyncJobStatus.RUNNING,
          triggerType,
          startedAt: new Date(),
          triggeredBy: userId,
          attempt: 1,
        }),
      );
    } else {
      job.status = SyncJobStatus.RUNNING;
      job.startedAt = new Date();
      job.attempt += 1;
      await this.jobRepo.save(job);
    }

    await this.log(job.id, 'info', `شروع همگام‌سازی (${triggerType})`);

    try {
      const mappings = await this.mapRepo.find({
        where: { connectorId },
        order: { sortOrder: 'ASC' },
      });

      let records: Record<string, unknown>[] = [];
      if (connector.connectorType === ConnectorType.REST_API || connector.connectorType === 'rest_api') {
        records = await this.fetchRestRecords(connector);
      } else if (connector.connectorType === ConnectorType.CSV_FILE || connector.connectorType === 'csv_file') {
        records = await this.fetchCsvRecords(connector);
      } else if (connector.connectorType === ConnectorType.WEBHOOK || connector.connectorType === 'webhook') {
        await this.log(job.id, 'info', 'کانکتور webhook — همگام‌سازی از صف رویدادها انجام می‌شود');
      } else {
        await this.log(job.id, 'warn', `نوع کانکتور ${connector.connectorType} در این نسخه فقط ثبت وضعیت می‌شود`);
      }

      const result = await this.processRecords(
        orgId,
        connectorId,
        connector.targetEntity,
        job.id,
        records,
        mappings,
      );

      job.recordsRead = records.length;
      job.recordsWritten = result.written;
      job.recordsFailed = result.failed;
      job.finishedAt = new Date();
      job.resultSummary = { mappedSamples: result.mappedSamples, mappingsCount: mappings.length };
      job.status = result.failed === 0
        ? SyncJobStatus.SUCCESS
        : result.written > 0
          ? SyncJobStatus.PARTIAL
          : records.length === 0 && (connector.connectorType === ConnectorType.WEBHOOK || connector.connectorType === 'webhook')
            ? SyncJobStatus.SUCCESS
            : SyncJobStatus.FAILED;
      job.errorSummary = result.failed > 0 ? `${result.failed} رکورد ناموفق` : undefined;
      await this.jobRepo.save(job);

      connector.lastSyncAt = new Date();
      connector.lastSyncStatus = job.status;
      if (connector.scheduleIntervalMinutes) {
        connector.nextRunAt = new Date(Date.now() + connector.scheduleIntervalMinutes * 60_000);
      }
      await this.connectors.saveConnector(connector);

      await this.log(job.id, 'info', `پایان همگام‌سازی — وضعیت: ${job.status}`);
      return { success: true, data: job };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'خطای همگام‌سازی';
      this.logger.error(msg);
      job.status = SyncJobStatus.FAILED;
      job.errorSummary = msg;
      job.finishedAt = new Date();
      await this.jobRepo.save(job);
      await this.log(job.id, 'error', msg);
      connector.lastSyncAt = new Date();
      connector.lastSyncStatus = SyncJobStatus.FAILED;
      await this.connectors.saveConnector(connector);
      throw e;
    }
  }

  async runWithRecords(
    orgId: string,
    connectorId: string,
    records: Record<string, unknown>[],
    userId?: string,
    triggerType: 'manual' | 'schedule' | 'webhook' | 'retry' = 'webhook',
  ) {
    const connector = await this.connectors.require(orgId, connectorId);
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        organizationId: orgId,
        connectorId,
        status: SyncJobStatus.RUNNING,
        triggerType,
        startedAt: new Date(),
        triggeredBy: userId,
      }),
    );
    await this.log(job.id, 'info', `پردازش ${records.length} رکورد ورودی (${triggerType})`);

    const mappings = await this.mapRepo.find({ where: { connectorId }, order: { sortOrder: 'ASC' } });
    const result = await this.processRecords(
      orgId,
      connectorId,
      connector.targetEntity,
      job.id,
      records,
      mappings,
    );

    job.recordsRead = records.length;
    job.recordsWritten = result.written;
    job.recordsFailed = result.failed;
    job.finishedAt = new Date();
    job.status = result.failed === 0
      ? SyncJobStatus.SUCCESS
      : result.written > 0
        ? SyncJobStatus.PARTIAL
        : SyncJobStatus.FAILED;
    await this.jobRepo.save(job);
    connector.lastSyncAt = new Date();
    connector.lastSyncStatus = job.status;
    await this.connectors.saveConnector(connector);
    return { success: true, data: job };
  }

  private async processRecords(
    orgId: string,
    connectorId: string,
    targetEntity: string,
    jobId: string,
    records: Record<string, unknown>[],
    mappings: FieldMapping[],
  ) {
    let written = 0;
    let failed = 0;
    const mappedSamples: Record<string, unknown>[] = [];

    for (const raw of records) {
      let externalId = '';
      try {
        const mapped = this.applyMappings(raw, mappings);
        externalId = String(
          mapped.externalId
          ?? raw.id
          ?? raw.code
          ?? raw.nationalId
          ?? raw.caseNumber
          ?? JSON.stringify(raw).slice(0, 64),
        );

        const writeResult = await this.writer.writeMapped(
          orgId,
          connectorId,
          targetEntity,
          externalId,
          mapped,
        );

        const existing = await this.extRepo.findOne({
          where: { connectorId, entityType: targetEntity, externalId },
        });
        if (existing) {
          existing.lastPayload = mapped;
          existing.lastSyncedAt = new Date();
          if (writeResult?.internalId) existing.internalId = writeResult.internalId;
          await this.extRepo.save(existing);
        } else if (!writeResult) {
          await this.extRepo.save(
            this.extRepo.create({
              connectorId,
              entityType: targetEntity,
              externalId,
              lastPayload: mapped,
            }),
          );
        }

        written += 1;
        if (mappedSamples.length < 5) mappedSamples.push(mapped);
        await this.log(
          jobId,
          'info',
          writeResult
            ? `رکورد ${writeResult.entityType} ${writeResult.created ? 'ایجاد' : 'به‌روز'} شد`
            : 'رکورد نگاشت ذخیره شد',
          externalId,
          { mapped, internalId: writeResult?.internalId },
        );
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : 'خطای نگاشت';
        await this.log(jobId, 'error', msg, externalId || undefined, { raw });
        await this.dlq.push({
          organizationId: orgId,
          connectorId,
          syncJobId: jobId,
          entityType: targetEntity,
          externalId: externalId || undefined,
          payload: raw,
          errorMessage: msg,
        });
      }
    }

    return { written, failed, mappedSamples };
  }

  async enqueueRetry(
    orgId: string,
    connectorId: string,
    userId: string,
    queue: {
      enqueue: (
        orgId: string,
        connectorId: string,
        syncJobId: string | undefined,
        payload: Record<string, unknown>,
        maxAttempts?: number,
      ) => Promise<unknown>;
    },
  ) {
    const connector = await this.connectors.require(orgId, connectorId);
    const retry = (connector.connectionConfig?.retry as typeof DEFAULT_RETRY_POLICY) ?? DEFAULT_RETRY_POLICY;
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        organizationId: orgId,
        connectorId,
        status: SyncJobStatus.QUEUED,
        triggerType: 'manual',
        triggeredBy: userId,
      }),
    );
    await queue.enqueue(orgId, connectorId, job.id, { triggeredBy: userId }, retry.maxAttempts);
    await this.log(job.id, 'info', 'جاب در صف retry قرار گرفت');
    return { success: true, data: job };
  }

  applyMappings(
    raw: Record<string, unknown>,
    mappings: FieldMapping[],
  ): Record<string, unknown> {
    if (!mappings.length) return { ...raw };
    const out: Record<string, unknown> = {};
    for (const m of mappings) {
      const value = this.resolvePath(raw, m.sourceField);
      if ((value === undefined || value === null || value === '') && m.isRequired) {
        throw new Error(`فیلد الزامی موجود نیست: ${m.sourceField}`);
      }
      out[m.targetField] = this.applyTransform(value, m.transformRule ?? {});
    }
    return out;
  }

  private async fetchCsvRecords(connector: Awaited<ReturnType<ConnectorsService['require']>>) {
    const cfg = connector.connectionConfig ?? {};
    if (typeof cfg.csvText === 'string' && cfg.csvText.trim()) {
      return parseCsvRecords(cfg.csvText);
    }
    const csvUrl = String(cfg.csvUrl ?? cfg.fileUrl ?? '').trim();
    if (!csvUrl) {
      throw new Error('برای کانکتور CSV باید csvUrl یا csvText در connectionConfig تنظیم شود');
    }
    const headers = await this.connectionTest.buildAuthHeaders(connector);
    const timeoutMs = Number(cfg.timeoutMs ?? 30000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(csvUrl, { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} هنگام دریافت CSV`);
      const text = await res.text();
      return parseCsvRecords(text);
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchRestRecords(connector: Awaited<ReturnType<ConnectorsService['require']>>) {
    const cfg = connector.connectionConfig ?? {};
    const baseUrl = String(cfg.baseUrl ?? '').replace(/\/$/, '');
    const endpoints = (cfg.endpoints ?? {}) as { list?: string };
    if (!baseUrl || !endpoints.list) {
      throw new Error('برای sync نوع REST باید baseUrl و endpoints.list تنظیم شود');
    }
    const path = endpoints.list;
    const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = await this.connectionTest.buildAuthHeaders(connector);
    const timeoutMs = Number(cfg.timeoutMs ?? 15000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} از سرویس بیرونی`);
      const json = await res.json() as unknown;
      if (Array.isArray(json)) return json as Record<string, unknown>[];
      if (json && typeof json === 'object') {
        const obj = json as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
        if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
        if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
        return [obj];
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  private resolvePath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as object)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private applyTransform(value: unknown, rule: Record<string, unknown>): unknown {
    if (!rule || !Object.keys(rule).length) return value;
    if (rule.type === 'string') return value == null ? value : String(value);
    if (rule.type === 'number') return value == null || value === '' ? null : Number(value);
    if (rule.type === 'boolean') return Boolean(value);
    if (rule.type === 'map' && rule.map && typeof rule.map === 'object') {
      const map = rule.map as Record<string, unknown>;
      return map[String(value)] ?? rule.default ?? value;
    }
    if (rule.type === 'default' && (value === undefined || value === null || value === '')) {
      return rule.value;
    }
    return value;
  }

  private async log(
    syncJobId: string,
    logLevel: string,
    message: string,
    recordRef?: string,
    payload?: Record<string, unknown>,
  ) {
    await this.logRepo.save(
      this.logRepo.create({ syncJobId, logLevel, message, recordRef, payload }),
    );
  }
}
