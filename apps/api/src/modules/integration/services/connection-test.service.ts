import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connector } from '../entities/connector.entity';
import { ConnectionTest } from '../entities/connection-test.entity';
import { ConnectorsService } from './connectors.service';
import { AuthType } from '@city-manager/shared';

@Injectable()
export class ConnectionTestService {
  constructor(
    @InjectRepository(ConnectionTest) private readonly testRepo: Repository<ConnectionTest>,
    private readonly connectors: ConnectorsService,
  ) {}

  async test(orgId: string, connectorId: string, userId: string) {
    const connector = await this.connectors.require(orgId, connectorId);
    const started = Date.now();
    let success = false;
    let statusCode: number | undefined;
    let message = '';
    let responsePreview = '';

    try {
      if (connector.connectorType === 'webhook') {
        success = true;
        message = `Webhook آماده است. آدرس دریافت: /integrations/webhooks/${connector.organizationId}/${connector.code}`;
      } else {
        const result = await this.httpProbe(connector);
        success = result.ok;
        statusCode = result.statusCode;
        message = result.message;
        responsePreview = result.preview;
      }
    } catch (e) {
      success = false;
      message = e instanceof Error ? e.message : 'خطای ناشناخته در تست اتصال';
    }

    const latencyMs = Date.now() - started;
    const saved = await this.testRepo.save(
      this.testRepo.create({
        connectorId,
        success,
        statusCode,
        latencyMs,
        message,
        responsePreview: responsePreview.slice(0, 2000),
        testedBy: userId,
      }),
    );

    connector.lastTestAt = new Date();
    connector.lastTestOk = success;
    connector.lastTestMessage = message;
    await this.connectors.saveConnector(connector);

    return {
      success: true,
      data: {
        id: saved.id,
        ok: success,
        statusCode,
        latencyMs,
        message,
        responsePreview: responsePreview.slice(0, 500),
        testedAt: saved.testedAt,
      },
    };
  }

  async listTests(orgId: string, connectorId: string) {
    await this.connectors.require(orgId, connectorId);
    const data = await this.testRepo.find({
      where: { connectorId },
      order: { testedAt: 'DESC' },
      take: 20,
    });
    return { success: true, data };
  }

  private async httpProbe(connector: Connector) {
    const cfg = connector.connectionConfig ?? {};
    const baseUrl = String(cfg.baseUrl ?? '').replace(/\/$/, '');
    if (!baseUrl) throw new Error('baseUrl تنظیم نشده است');

    const endpoints = (cfg.endpoints ?? {}) as { health?: string; list?: string };
    const path = endpoints.health || endpoints.list || '/';
    const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const timeoutMs = Number(cfg.timeoutMs ?? 15000);
    const headers = await this.buildAuthHeaders(connector);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      const text = await res.text();
      return {
        ok: res.ok,
        statusCode: res.status,
        message: res.ok
          ? `اتصال موفق — HTTP ${res.status}`
          : `پاسخ ناموفق — HTTP ${res.status}`,
        preview: text.slice(0, 2000),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async buildAuthHeaders(connector: Connector): Promise<Record<string, string>> {
    const cfg = connector.connectionConfig ?? {};
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((cfg.headers as Record<string, string>) ?? {}),
    };
    const auth = (cfg.auth ?? { type: AuthType.NONE }) as { type: string; headerName?: string; username?: string };
    const secrets = this.connectors.getDecryptedSecrets(connector);

    switch (auth.type) {
      case AuthType.API_KEY:
        headers[auth.headerName || 'X-API-Key'] = String(secrets.apiKey ?? '');
        break;
      case AuthType.BEARER:
        headers.Authorization = `Bearer ${String(secrets.bearerToken ?? '')}`;
        break;
      case AuthType.BASIC: {
        const token = Buffer.from(`${auth.username ?? ''}:${String(secrets.password ?? '')}`).toString('base64');
        headers.Authorization = `Basic ${token}`;
        break;
      }
      case AuthType.CUSTOM_HEADER:
        if (auth.headerName) headers[auth.headerName] = String(secrets.headerValue ?? '');
        break;
      default:
        break;
    }
    return headers;
  }
}
