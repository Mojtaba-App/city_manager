import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OauthClientDto, Permission } from '@city-manager/shared';
import { OauthClient } from '../entities/oauth-client.entity';

/**
 * OAuth2 Client Credentials for M2M integrations.
 * Authorization Code / OIDC UI flow can wrap the same JWT issuer later.
 */
@Injectable()
export class OauthService {
  constructor(
    @InjectRepository(OauthClient)
    private readonly clientRepo: Repository<OauthClient>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async list(orgId: string): Promise<OauthClientDto[]> {
    const rows = await this.clientRepo.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    orgId: string,
    name: string,
    scopes: string[],
    userId: string,
  ): Promise<OauthClientDto> {
    if (!name?.trim()) throw new BadRequestException('نام الزامی است');
    const clientId = `cm_${crypto.randomBytes(12).toString('hex')}`;
    const clientSecret = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(clientSecret, 12);
    const row = await this.clientRepo.save(
      this.clientRepo.create({
        organizationId: orgId,
        clientId,
        clientSecretHash: hash,
        name,
        scopes: scopes.length ? scopes : [Permission.INTEGRATION_READ],
        createdBy: userId,
      }),
    );
    return { ...this.toDto(row), clientSecret };
  }

  async revoke(orgId: string, id: string): Promise<void> {
    const row = await this.clientRepo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('کلاینت یافت نشد');
    row.isActive = false;
    await this.clientRepo.save(row);
  }

  /**
   * POST /oauth/token  grant_type=client_credentials
   */
  async clientCredentialsToken(
    clientId: string,
    clientSecret: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; scope: string }> {
    const client = await this.clientRepo.findOne({ where: { clientId } });
    if (!client || !client.isActive) {
      throw new UnauthorizedException('کلاینت نامعتبر است');
    }
    const ok = await bcrypt.compare(clientSecret, client.clientSecretHash);
    if (!ok) throw new UnauthorizedException('کلاینت نامعتبر است');

    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const payload = {
      sub: `client:${client.id}`,
      email: `${client.clientId}@oauth.local`,
      orgId: client.organizationId,
      roles: [],
      permissions: client.scopes,
      client_id: client.clientId,
      token_use: 'access',
      grant: 'client_credentials',
    };
    const access_token = this.jwtService.sign(payload);
    return {
      access_token,
      token_type: 'Bearer',
      expires_in: this.parseExpiresSeconds(expiresIn),
      scope: client.scopes.join(' '),
    };
  }

  async count(orgId: string | null) {
    if (orgId) {
      const all = await this.clientRepo.count({ where: { organizationId: orgId } });
      const active = await this.clientRepo.count({
        where: { organizationId: orgId, isActive: true },
      });
      return { all, active };
    }
    const all = await this.clientRepo.count();
    const active = await this.clientRepo.count({ where: { isActive: true } });
    return { all, active };
  }

  private toDto(r: OauthClient): OauthClientDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      clientId: r.clientId,
      name: r.name,
      scopes: r.scopes,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private parseExpiresSeconds(expiry: string): number {
    const m = expiry.match(/^(\d+)([smhd])$/);
    if (!m) return 900;
    const n = parseInt(m[1], 10);
    const u = m[2];
    return u === 's' ? n : u === 'm' ? n * 60 : u === 'h' ? n * 3600 : n * 86400;
  }
}
