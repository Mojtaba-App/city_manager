import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Connector } from '../entities/connector.entity';
import { FieldMapping } from '../entities/field-mapping.entity';
import { CreateConnectorDto, UpdateConnectorDto, UpsertMappingsDto, ConnectionProfileDto } from '../dto/integration.dto';
import { SecretsCryptoService } from './secrets-crypto.service';
import { AuthType, ConnectorType, DEFAULT_RETRY_POLICY, SyncDirection, IntegrationTargetEntity } from '@city-manager/shared';

@Injectable()
export class ConnectorsService {
  constructor(
    @InjectRepository(Connector) private readonly repo: Repository<Connector>,
    @InjectRepository(FieldMapping) private readonly mapRepo: Repository<FieldMapping>,
    private readonly secrets: SecretsCryptoService,
  ) {}

  async findAll(orgId: string) {
    const rows = await this.repo.find({
      where: { organizationId: orgId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return { success: true, data: rows.map((r) => this.toPublic(r)) };
  }

  async findOne(orgId: string, id: string) {
    const row = await this.require(orgId, id);
    const mappings = await this.mapRepo.find({
      where: { connectorId: id },
      order: { sortOrder: 'ASC' },
    });
    return { success: true, data: { ...this.toPublic(row), mappings } };
  }

  async findByCode(orgId: string | null, code: string) {
    const where: Record<string, unknown> = { code, deletedAt: IsNull(), isActive: true };
    if (orgId) where.organizationId = orgId;
    return this.repo.findOne({ where });
  }

  async create(orgId: string, userId: string, dto: CreateConnectorDto) {
    const exists = await this.repo.findOne({ where: { organizationId: orgId, code: dto.code } });
    if (exists && !exists.deletedAt) throw new ConflictException('کد کانکتور تکراری است');

    const { config, secretsEnc } = this.packProfile(dto.profile);
    this.assertWebhookSecret(dto.connectorType, secretsEnc ? this.decryptSecretsEnc(secretsEnc) : {});
    const interval = dto.scheduleIntervalMinutes;
    const saved = await this.repo.save(
      this.repo.create({
        organizationId: orgId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        connectorType: dto.connectorType,
        syncDirection: dto.syncDirection ?? SyncDirection.INBOUND,
        targetEntity: dto.targetEntity ?? IntegrationTargetEntity.HOUSEHOLD,
        connectionConfig: config,
        authSecretsEnc: secretsEnc,
        isActive: dto.isActive ?? true,
        scheduleCron: dto.scheduleCron,
        scheduleIntervalMinutes: interval,
        nextRunAt: interval ? new Date(Date.now() + interval * 60_000) : undefined,
        createdBy: userId,
      }),
    );
    return { success: true, data: this.toPublic(saved) };
  }

  async update(orgId: string, id: string, dto: UpdateConnectorDto) {
    const row = await this.require(orgId, id);
    if (dto.name != null) row.name = dto.name;
    if (dto.description != null) row.description = dto.description;
    if (dto.syncDirection != null) row.syncDirection = dto.syncDirection;
    if (dto.targetEntity != null) row.targetEntity = dto.targetEntity;
    if (dto.scheduleCron != null) row.scheduleCron = dto.scheduleCron;
    if (dto.scheduleIntervalMinutes != null) {
      row.scheduleIntervalMinutes = dto.scheduleIntervalMinutes;
      row.nextRunAt = new Date(Date.now() + dto.scheduleIntervalMinutes * 60_000);
    }
    if (dto.isActive != null) row.isActive = dto.isActive;
    if (dto.profile) {
      const { config, secretsEnc } = this.packProfile(dto.profile, row);
      row.connectionConfig = config;
      if (secretsEnc) row.authSecretsEnc = secretsEnc;
    }
    this.assertWebhookSecret(row.connectorType, this.getDecryptedSecrets(row));
    const saved = await this.repo.save(row);
    return { success: true, data: this.toPublic(saved) };
  }

  async softDelete(orgId: string, id: string) {
    const row = await this.require(orgId, id);
    row.deletedAt = new Date();
    row.isActive = false;
    await this.repo.save(row);
    return { success: true, data: { id } };
  }

  async upsertMappings(orgId: string, connectorId: string, dto: UpsertMappingsDto) {
    await this.require(orgId, connectorId);
    await this.mapRepo.delete({ connectorId });
    const rows = dto.mappings.map((m, i) =>
      this.mapRepo.create({
        connectorId,
        sourceField: m.sourceField,
        targetField: m.targetField,
        transformRule: m.transformRule ?? {},
        isRequired: m.isRequired ?? false,
        sortOrder: m.sortOrder ?? i,
      }),
    );
    const saved = await this.mapRepo.save(rows);
    return { success: true, data: saved };
  }

  async saveConnector(connector: Connector) {
    return this.repo.save(connector);
  }

  getDecryptedSecrets(connector: Connector): Record<string, unknown> {
    if (!connector.authSecretsEnc) return {};
    try {
      return this.secrets.decryptJson(connector.authSecretsEnc);
    } catch {
      return {};
    }
  }

  async require(orgId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!row) throw new NotFoundException('کانکتور یافت نشد');
    return row;
  }

  toPublic(row: Connector) {
    const cfg = { ...(row.connectionConfig ?? {}) };
    const auth = (cfg.auth as Record<string, unknown>) ?? { type: AuthType.NONE };
    const secrets = this.getDecryptedSecrets(row);
    return {
      id: row.id,
      organizationId: row.organizationId,
      code: row.code,
      name: row.name,
      description: row.description,
      connectorType: row.connectorType,
      syncDirection: row.syncDirection,
      targetEntity: row.targetEntity,
      isActive: row.isActive,
      scheduleCron: row.scheduleCron,
      scheduleIntervalMinutes: row.scheduleIntervalMinutes,
      nextRunAt: row.nextRunAt,
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      lastTestAt: row.lastTestAt,
      lastTestOk: row.lastTestOk,
      lastTestMessage: row.lastTestMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      profile: {
        baseUrl: cfg.baseUrl,
        csvUrl: cfg.csvUrl,
        endpoints: cfg.endpoints ?? {},
        headers: cfg.headers ?? {},
        timeoutMs: cfg.timeoutMs ?? 15000,
        retry: cfg.retry ?? DEFAULT_RETRY_POLICY,
        auth: {
          type: auth.type ?? AuthType.NONE,
          headerName: auth.headerName,
          username: auth.username,
          hasApiKey: Boolean(secrets.apiKey),
          hasBearerToken: Boolean(secrets.bearerToken),
          hasPassword: Boolean(secrets.password),
          hasWebhookSecret: Boolean(secrets.webhookSecret),
        },
      },
      webhookUrlHint: `/integrations/webhooks/${row.organizationId}/${row.code}`,
    };
  }

  private assertWebhookSecret(connectorType: string, secrets: Record<string, unknown>) {
    if (connectorType !== ConnectorType.WEBHOOK) return;
    if (!String(secrets.webhookSecret ?? '').trim()) {
      throw new BadRequestException('برای کانکتور webhook مقدار webhookSecret الزامی است');
    }
  }

  private decryptSecretsEnc(enc: string): Record<string, unknown> {
    try {
      return this.secrets.decryptJson(enc);
    } catch {
      return {};
    }
  }

  private packProfile(profile?: ConnectionProfileDto, existing?: Connector) {
    const prevSecrets = existing ? this.getDecryptedSecrets(existing) : {};
    const prevCfg = (existing?.connectionConfig ?? {}) as Record<string, unknown>;
    const auth = profile?.auth;
    const secrets: Record<string, unknown> = { ...prevSecrets };

    if (auth) {
      if (auth.apiKey) secrets.apiKey = auth.apiKey;
      if (auth.bearerToken) secrets.bearerToken = auth.bearerToken;
      if (auth.password) secrets.password = auth.password;
      if (auth.headerValue) secrets.headerValue = auth.headerValue;
    }
    if (profile?.webhookSecret) secrets.webhookSecret = profile.webhookSecret;

    const config = {
      baseUrl: profile?.baseUrl ?? prevCfg.baseUrl,
      csvUrl: profile?.csvUrl ?? prevCfg.csvUrl,
      csvText: profile?.csvText ?? prevCfg.csvText,
      endpoints: profile?.endpoints ?? prevCfg.endpoints ?? {},
      headers: profile?.headers ?? prevCfg.headers ?? {},
      timeoutMs: profile?.timeoutMs ?? prevCfg.timeoutMs ?? 15000,
      retry: {
        ...DEFAULT_RETRY_POLICY,
        ...((prevCfg.retry as object) ?? {}),
        ...(profile?.retry ?? {}),
      },
      auth: {
        type: auth?.type ?? (prevCfg.auth as { type?: string })?.type ?? AuthType.NONE,
        headerName: auth?.headerName ?? (prevCfg.auth as { headerName?: string })?.headerName,
        username: auth?.username ?? (prevCfg.auth as { username?: string })?.username,
      },
    };

    const secretsEnc = Object.keys(secrets).length
      ? this.secrets.encryptJson(secrets)
      : existing?.authSecretsEnc;

    return { config, secretsEnc };
  }
}
