import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageOutbox } from '../entities/household-document.entity';
import { SystemSetting } from '../../admin/entities/system-setting.entity';
import {
  ApiResponse,
  MessageChannel,
  MessageOutboxStatus,
  OperationalEvent,
  buildSmsIrBulkBody,
  buildSmsIrBulkUrl,
  isSmsIrProvider,
  parseSmsIrApiResult,
  smsIrAuthHeaders,
} from '@city-manager/shared';
import { SendMessageDto } from '../dto/operations.dto';

interface MessagingTemplate {
  code: string;
  name: string;
  body: string;
}

const DEFAULT_BACKOFF_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 5;

@Injectable()
export class MessagingDispatchService {
  private readonly log = new Logger(MessagingDispatchService.name);

  constructor(
    @InjectRepository(MessageOutbox)
    private readonly outboxRepo: Repository<MessageOutbox>,
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
    private readonly config: ConfigService,
  ) {}

  async listOutbox(orgId: string, limit = 50): Promise<ApiResponse<MessageOutbox[]>> {
    const items = await this.outboxRepo.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { success: true, data: items };
  }

  async sendManual(
    orgId: string,
    userId: string,
    householdId: string | undefined,
    dto: SendMessageDto,
  ): Promise<ApiResponse<MessageOutbox>> {
    return this.dispatch(orgId, userId, {
      householdId,
      channel: dto.channel,
      recipient: dto.recipient.trim(),
      subject: dto.subject?.trim(),
      body: dto.body.trim(),
      templateCode: dto.templateCode,
      eventType: 'manual',
    });
  }

  async sendEvent(
    orgId: string,
    userId: string | undefined,
    opts: {
      householdId?: string;
      event: OperationalEvent | string;
      channel: MessageChannel;
      recipient: string;
      templateCode?: string;
      vars?: Record<string, string>;
      subject?: string;
      /** When true (default), enqueue and rely on worker/retry; OTP can set sync=true */
      sync?: boolean;
    },
  ): Promise<MessageOutbox | null> {
    const cfg = await this.loadChannelConfig(orgId, opts.channel);
    if (!cfg.enabled) return null;

    const body = opts.templateCode
      ? this.renderTemplate(cfg.templates, opts.templateCode, opts.vars ?? {})
      : this.renderTemplate(cfg.templates, this.defaultTemplateForEvent(opts.event), opts.vars ?? {});

    if (!body) return null;

    const result = await this.dispatch(orgId, userId, {
      householdId: opts.householdId,
      channel: opts.channel,
      recipient: opts.recipient,
      subject: opts.subject ?? cfg.defaultSubject,
      body,
      templateCode: opts.templateCode,
      eventType: opts.event,
      sync: opts.sync ?? (opts.event === 'password_reset' || opts.templateCode === 'otp'),
    });
    return result.data ?? null;
  }

  /** Worker entry: deliver one outbox row with retry bookkeeping */
  async processOutboxItem(id: string): Promise<MessageOutbox | null> {
    const saved = await this.outboxRepo.findOne({ where: { id } });
    if (!saved) return null;
    if (saved.status === MessageOutboxStatus.SENT || saved.status === MessageOutboxStatus.SKIPPED) {
      return saved;
    }
    if (saved.attempt >= saved.maxAttempts) {
      saved.status = MessageOutboxStatus.FAILED;
      saved.errorMessage = saved.errorMessage ?? 'حداکثر تلاش ارسال به اتمام رسید';
      return this.outboxRepo.save(saved);
    }

    saved.attempt += 1;
    await this.outboxRepo.save(saved);

    try {
      const cfg = await this.loadChannelConfig(saved.organizationId, saved.channel as MessageChannel);
      if (!cfg.enabled) {
        saved.status = MessageOutboxStatus.SKIPPED;
        saved.errorMessage = 'کانال غیرفعال است';
        saved.nextAttemptAt = null;
        return this.outboxRepo.save(saved);
      }
      await this.deliver(cfg, saved.channel as MessageChannel, saved.recipient, saved.subject, saved.body);
      saved.status = MessageOutboxStatus.SENT;
      saved.sentAt = new Date();
      saved.errorMessage = undefined;
      saved.nextAttemptAt = null;
      return this.outboxRepo.save(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ارسال ناموفق';
      this.log.warn(`Message dispatch failed: ${message}`);
      saved.status = MessageOutboxStatus.FAILED;
      saved.errorMessage = message;
      const backoff = Math.min(300_000, DEFAULT_BACKOFF_MS * Math.pow(2, Math.max(0, saved.attempt - 1)));
      saved.nextAttemptAt = new Date(Date.now() + backoff);
      return this.outboxRepo.save(saved);
    }
  }

  private async dispatch(
    orgId: string,
    userId: string | undefined,
    input: {
      householdId?: string;
      channel: MessageChannel;
      recipient: string;
      subject?: string;
      body: string;
      templateCode?: string;
      eventType?: string;
      sync?: boolean;
    },
  ): Promise<ApiResponse<MessageOutbox>> {
    const row = this.outboxRepo.create({
      organizationId: orgId,
      householdId: input.householdId,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      templateCode: input.templateCode,
      eventType: input.eventType,
      status: MessageOutboxStatus.PENDING,
      attempt: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt: new Date(),
      createdBy: userId,
    });
    let saved = await this.outboxRepo.save(row);

    const syncFirst = input.sync === true
      || this.config.get<string>('MESSAGING_SYNC_DISPATCH', '0') === '1';

    if (syncFirst) {
      saved = (await this.processOutboxItem(saved.id)) ?? saved;
    }
    // else: MessageOutboxWorker picks it up asynchronously

    return { success: true, data: saved };
  }

  private async deliver(
    cfg: ChannelConfig,
    channel: MessageChannel,
    recipient: string,
    subject: string | undefined,
    body: string,
  ): Promise<void> {
    if (!cfg.apiBaseUrl) {
      this.log.log(`[${channel}] → ${recipient}: ${body.slice(0, 120)}`);
      return;
    }

    if (channel === MessageChannel.SMS && isSmsIrProvider(cfg.provider, cfg.apiBaseUrl)) {
      const url = buildSmsIrBulkUrl(cfg.apiBaseUrl);
      const res = await fetch(url, {
        method: 'POST',
        headers: smsIrAuthHeaders(cfg.apiKey),
        body: JSON.stringify(buildSmsIrBulkBody(cfg.sender, recipient, body)),
      });
      let json: unknown = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }
      const parsed = parseSmsIrApiResult(json, res.ok);
      if (!parsed.ok) throw new Error(parsed.message || `HTTP ${res.status}`);
      return;
    }

    const url = cfg.apiBaseUrl.replace(/\/$/, '') + (channel === MessageChannel.SMS ? '/send' : '/send-email');
    const payload = channel === MessageChannel.SMS
      ? { to: recipient, from: cfg.sender, message: body, apiKey: cfg.apiKey }
      : { to: recipient, from: cfg.fromEmail, fromName: cfg.fromName, subject: subject ?? 'پیام سامانه', body, apiKey: cfg.apiKey };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  }

  private async loadChannelConfig(orgId: string, channel: MessageChannel): Promise<ChannelConfig> {
    const key = channel === MessageChannel.SMS ? 'messaging_sms' : 'messaging_email';
    const row = await this.settingsRepo.findOne({ where: { organizationId: orgId, key } });
    const raw = (row?.value ?? {}) as Record<string, unknown>;
    const templates = Array.isArray(raw.templates)
      ? (raw.templates as MessagingTemplate[])
      : [];
    return {
      enabled: Boolean(raw.enabled),
      provider: typeof raw.provider === 'string' ? raw.provider : '',
      apiBaseUrl: typeof raw.apiBaseUrl === 'string' ? raw.apiBaseUrl : '',
      apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
      sender: typeof raw.sender === 'string' ? raw.sender : '',
      fromEmail: typeof raw.fromEmail === 'string' ? raw.fromEmail : '',
      fromName: typeof raw.fromName === 'string' ? raw.fromName : 'City Manager',
      defaultSubject: channel === MessageChannel.EMAIL ? 'اطلاع‌رسانی پرونده خانوار' : undefined,
      templates,
    };
  }

  private renderTemplate(
    templates: MessagingTemplate[],
    code: string,
    vars: Record<string, string>,
  ): string | null {
    const tpl = templates.find((t) => t.code === code);
    if (!tpl) return null;
    let out = tpl.body;
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return out;
  }

  private defaultTemplateForEvent(event: string): string {
    switch (event) {
      case OperationalEvent.TASK_CREATED: return 'task_created';
      case OperationalEvent.VISIT_SCHEDULED: return 'visit_scheduled';
      case OperationalEvent.SUPPORT_ASSIGNED: return 'support_assigned';
      case OperationalEvent.HOUSEHOLD_ASSIGNED: return 'household_assigned';
      case OperationalEvent.VULNERABILITY_HIGH: return 'vulnerability_high';
      default: return 'general_notice';
    }
  }
}

interface ChannelConfig {
  enabled: boolean;
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  sender: string;
  fromEmail: string;
  fromName: string;
  defaultSubject?: string;
  templates: MessagingTemplate[];
}
