import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Connector } from '../entities/connector.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { SecretsCryptoService } from './secrets-crypto.service';
import { ConnectorsService } from './connectors.service';
import { SyncRunnerService } from './sync-runner.service';

@Injectable()
export class WebhookService {
  constructor(
    @InjectRepository(Connector) private readonly connectorRepo: Repository<Connector>,
    @InjectRepository(WebhookEvent) private readonly eventRepo: Repository<WebhookEvent>,
    private readonly secrets: SecretsCryptoService,
    private readonly connectors: ConnectorsService,
    private readonly runner: SyncRunnerService,
  ) {}

  async receive(
    code: string,
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
    rawBody?: string,
    organizationId?: string,
  ) {
    const connector = await this.resolveConnector(code, organizationId);

    const secrets = this.connectors.getDecryptedSecrets(connector);
    const secret = String(secrets.webhookSecret ?? '').trim();
    if (!secret) {
      throw new UnauthorizedException(
        'این webhook بدون secret پیکربندی شده است. ابتدا webhookSecret را در کانکتور تنظیم کنید.',
      );
    }

    const raw = typeof rawBody === 'string' && rawBody.length > 0
      ? rawBody
      : JSON.stringify(body);
    const provided = String(
      headers['x-signature']
      ?? headers['x-hub-signature-256']
      ?? headers['x-webhook-signature']
      ?? '',
    ).replace(/^sha256=/i, '');
    const expected = this.secrets.hmacSha256(secret, raw);
    const signatureValid = provided.length > 0 && this.secrets.equalHexTimingSafe(provided, expected);
    if (!signatureValid) throw new UnauthorizedException('امضای webhook نامعتبر است');

    const event = await this.eventRepo.save(
      this.eventRepo.create({
        organizationId: connector.organizationId,
        connectorId: connector.id,
        eventType: String(body.event ?? body.type ?? headers['x-event-type'] ?? 'webhook'),
        signatureValid,
        headers: this.sanitizeHeaders(headers),
        payload: body,
        processingStatus: 'received',
      }),
    );

    try {
      const records = Array.isArray(body.data)
        ? (body.data as Record<string, unknown>[])
        : Array.isArray(body.items)
          ? (body.items as Record<string, unknown>[])
          : [body];

      const jobResult = await this.runner.runWithRecords(
        connector.organizationId,
        connector.id,
        records,
        undefined,
        'webhook',
      );

      event.processingStatus = 'processed';
      event.processedAt = new Date();
      event.syncJobId = (jobResult.data as { id: string }).id;
      await this.eventRepo.save(event);

      return {
        success: true,
        data: { eventId: event.id, syncJobId: event.syncJobId },
      };
    } catch (e) {
      event.processingStatus = 'failed';
      event.errorMessage = e instanceof Error ? e.message : 'خطای پردازش webhook';
      await this.eventRepo.save(event);
      throw e;
    }
  }

  async listEvents(orgId: string, connectorId?: string, limit = 50) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (connectorId) where.connectorId = connectorId;
    const data = await this.eventRepo.find({
      where,
      order: { receivedAt: 'DESC' },
      take: limit,
    });
    return { success: true, data };
  }

  private async resolveConnector(code: string, organizationId?: string): Promise<Connector> {
    if (organizationId) {
      const connector = await this.connectorRepo.findOne({
        where: {
          code,
          organizationId,
          isActive: true,
          deletedAt: IsNull(),
        },
      });
      if (!connector) throw new NotFoundException('کانکتور webhook یافت نشد');
      return connector;
    }

    const matches = await this.connectorRepo.find({
      where: { code, isActive: true, deletedAt: IsNull() },
      take: 2,
    });
    if (matches.length === 0) throw new NotFoundException('کانکتور webhook یافت نشد');
    if (matches.length > 1) {
      throw new BadRequestException(
        'کد webhook بین چند سازمان مشترک است؛ از مسیر /integrations/webhooks/:orgId/:code استفاده کنید',
      );
    }
    return matches[0];
  }

  private sanitizeHeaders(headers: Record<string, string | string[] | undefined>) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (/authorization|cookie|secret|api-?key/i.test(k)) continue;
      out[k] = Array.isArray(v) ? v.join(',') : String(v ?? '');
    }
    return out;
  }
}
