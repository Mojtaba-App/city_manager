import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  JwtPayload,
  Permission,
  SystemRole,
} from '@city-manager/shared';
import { Permissions, Public } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audited } from '../../common/decorators/audit.decorator';
import { AuditService } from '../audit/audit.service';
import { AbacService } from './services/abac.service';
import { RowLevelAccessService } from './services/row-level-access.service';
import { SecretVaultService } from './services/secret-vault.service';
import { OauthService } from './services/oauth.service';
import { SecurityOverviewService } from './services/security-overview.service';
import { FieldMaskingService } from './services/field-masking.service';
import { PiiAccessService } from './services/pii-access.service';
import { UpdateAbacPolicyDto } from './dto/security-write.dto';

function requireOrg(user: JwtPayload, bodyOrgId?: string): string {
  if (user.roles.includes(SystemRole.SUPER_ADMIN) && bodyOrgId) return bodyOrgId;
  if (user.orgId) return user.orgId;
  throw new BadRequestException('سازمان کاربر مشخص نیست');
}

function orgScope(user: JwtPayload): string | null {
  return user.roles.includes(SystemRole.SUPER_ADMIN) ? null : user.orgId;
}

function ok<T>(data: T) {
  return { success: true as const, data };
}

@ApiTags('security')
@ApiBearerAuth()
@Controller('security')
export class SecurityController {
  constructor(
    private readonly overview: SecurityOverviewService,
    private readonly audit: AuditService,
    private readonly abac: AbacService,
    private readonly rls: RowLevelAccessService,
    private readonly secrets: SecretVaultService,
    private readonly oauth: OauthService,
    private readonly masking: FieldMaskingService,
    private readonly piiAccess: PiiAccessService,
  ) {}

  @Get('overview')
  @Permissions(Permission.SECURITY_READ)
  async getOverview(@CurrentUser() user: JwtPayload) {
    return ok(await this.overview.getOverview(orgScope(user)));
  }

  @Get('audit')
  @Permissions(Permission.AUDIT_READ)
  async queryAudit(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('outcome') outcome?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return ok(
      await this.audit.query(orgScope(user), {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 30,
        action,
        resource,
        userId,
        outcome: outcome as never,
        from,
        to,
        q,
      }),
    );
  }

  @Get('policies')
  @Permissions(Permission.SECURITY_READ)
  async listPolicies(@CurrentUser() user: JwtPayload) {
    return ok(await this.abac.listPolicies(orgScope(user)));
  }

  @Post('policies')
  @Permissions(Permission.SECURITY_WRITE)
  @Audited({ action: 'abac.policy.create', resource: 'abac_policy', severity: 'warning' })
  async createPolicy(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      name: string;
      description?: string;
      effect: 'allow' | 'deny';
      priority?: number;
      resourceType: string;
      actions: string[];
      condition?: Record<string, unknown>;
      isActive?: boolean;
      organizationId?: string;
    },
  ) {
    return ok(await this.abac.createPolicy(requireOrg(user, body.organizationId), body));
  }

  @Patch('policies/:id')
  @Permissions(Permission.SECURITY_WRITE)
  @Audited({ action: 'abac.policy.update', resource: 'abac_policy', severity: 'warning' })
  async updatePolicy(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateAbacPolicyDto,
  ) {
    const row = await this.abac.updatePolicy(orgScope(user), id, body as never);
    if (!row) throw new BadRequestException('سیاست یافت نشد');
    return ok(row);
  }

  @Delete('policies/:id')
  @Permissions(Permission.SECURITY_WRITE)
  @Audited({ action: 'abac.policy.delete', resource: 'abac_policy', severity: 'critical' })
  async deletePolicy(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const done = await this.abac.deletePolicy(orgScope(user), id);
    if (!done) throw new BadRequestException('سیاست یافت نشد');
    return ok(null);
  }

  @Post('evaluate')
  @Permissions(Permission.SECURITY_READ)
  async evaluate(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      resource: {
        type: string;
        id?: string;
        organizationId?: string;
        neighborhoodId?: string;
      };
      action: string;
    },
  ) {
    const subject = await this.abac.buildSubject(
      user.sub,
      user.orgId,
      user.roles,
      user.permissions,
    );
    return ok(await this.abac.evaluate(subject, body.resource, { action: body.action }));
  }

  @Get('secrets')
  @Permissions(Permission.SECRETS_MANAGE)
  async listSecrets(@CurrentUser() user: JwtPayload) {
    return ok(await this.secrets.list(requireOrg(user)));
  }

  @Post('secrets')
  @Permissions(Permission.SECRETS_MANAGE)
  @Audited({ action: 'secret.upsert', resource: 'managed_secret', severity: 'warning' })
  async upsertSecret(
    @CurrentUser() user: JwtPayload,
    @Body() body: { key: string; value: string; description?: string; organizationId?: string },
  ) {
    return ok(
      await this.secrets.upsert(
        requireOrg(user, body.organizationId),
        body.key,
        body.value,
        body.description,
        user.sub,
      ),
    );
  }

  @Post('secrets/:key/rotate')
  @Permissions(Permission.SECRETS_MANAGE)
  @Audited({ action: 'secret.rotate', resource: 'managed_secret', severity: 'critical' })
  async rotateSecret(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
    @Body() body: { value: string },
  ) {
    return ok(await this.secrets.rotate(requireOrg(user), key, body.value));
  }

  @Delete('secrets/:key')
  @Permissions(Permission.SECRETS_MANAGE)
  @Audited({ action: 'secret.delete', resource: 'managed_secret', severity: 'critical' })
  async deleteSecret(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    await this.secrets.remove(requireOrg(user), key);
    return ok(null);
  }

  @Get('oauth/clients')
  @Permissions(Permission.OAUTH_MANAGE)
  async listOauth(@CurrentUser() user: JwtPayload) {
    return ok(await this.oauth.list(requireOrg(user)));
  }

  @Post('oauth/clients')
  @Permissions(Permission.OAUTH_MANAGE)
  @Audited({ action: 'oauth.client.create', resource: 'oauth_client', severity: 'warning' })
  async createOauth(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; scopes?: string[] },
  ) {
    return ok(await this.oauth.create(requireOrg(user), body.name, body.scopes ?? [], user.sub));
  }

  @Post('oauth/clients/:id/revoke')
  @Permissions(Permission.OAUTH_MANAGE)
  @Audited({ action: 'oauth.client.revoke', resource: 'oauth_client', severity: 'warning' })
  async revokeOauth(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.oauth.revoke(requireOrg(user), id);
    return ok(null);
  }

  @Get('users/:userId/geo-scopes')
  @Permissions(Permission.USERS_READ)
  async getGeoScopes(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return ok(await this.rls.listGeoScopes(userId, requireOrg(user)));
  }

  @Patch('users/:userId/geo-scopes')
  @Permissions(Permission.USERS_WRITE)
  @Audited({ action: 'geo_scope.update', resource: 'user_geo_scope', resourceIdParam: 'params.userId' })
  async setGeoScopes(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() body: { scopes: Array<{ neighborhoodId?: string; zoneId?: string }> },
  ) {
    return ok(await this.rls.setGeoScopes(userId, requireOrg(user), body.scopes ?? []));
  }

  @Post('masking/preview')
  @Permissions(Permission.SECURITY_READ)
  previewMasking(
    @CurrentUser() user: JwtPayload,
    @Body() body: { record: Record<string, unknown> },
  ) {
    return ok({
      originalKeys: Object.keys(body.record ?? {}),
      protected: this.masking.protectRecord(body.record ?? {}, user),
      permissions: user.permissions.filter(
        (p) => String(p).includes('pii') || String(p).includes('insurance'),
      ),
    });
  }

  @Get('pii/access-logs')
  @Permissions(Permission.AUDIT_READ)
  async listPiiAccessLogs(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.piiAccess.listAccessLogs(requireOrg(user), limit ? Number(limit) : 50);
  }

  @Get('pii/export-logs')
  @Permissions(Permission.AUDIT_READ)
  async listExportLogs(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.piiAccess.listExportLogs(requireOrg(user), limit ? Number(limit) : 50);
  }

  @Post('pii/grants')
  @Permissions(Permission.SECURITY_WRITE)
  @Audited({ action: 'pii.grant.create', resource: 'pii_access_grant', severity: 'warning' })
  async createPiiGrant(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      resourceType: string;
      resourceId?: string;
      fields?: string[];
      purpose: string;
      reason: string;
      expiresInHours?: number;
    },
  ) {
    return this.piiAccess.createGrant(requireOrg(user), user.sub, user.sub, body);
  }
}

@ApiTags('oauth')
@Controller('oauth')
export class OauthTokenController {
  constructor(private readonly oauth: OauthService) {}

  @Public()
  @Post('token')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async token(@Req() req: { body: Record<string, string> }) {
    const grant = req.body.grant_type;
    if (grant !== 'client_credentials') {
      throw new BadRequestException('فقط client_credentials پشتیبانی می‌شود');
    }
    return this.oauth.clientCredentialsToken(req.body.client_id, req.body.client_secret);
  }
}
