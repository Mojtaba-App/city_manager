import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Permission, SecurityOverviewDto } from '@city-manager/shared';
import { Role } from '../../users/entities/role.entity';
import { UserRole } from '../../users/entities/user-role.entity';
import { AbacPolicy } from '../entities/abac-policy.entity';
import { UserGeoScope } from '../entities/user-geo-scope.entity';
import { AuditService } from '../../audit/audit.service';
import { SecretVaultService } from './secret-vault.service';
import { OauthService } from './oauth.service';

@Injectable()
export class SecurityOverviewService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(AbacPolicy) private readonly policyRepo: Repository<AbacPolicy>,
    @InjectRepository(UserGeoScope) private readonly geoRepo: Repository<UserGeoScope>,
    private readonly audit: AuditService,
    private readonly secrets: SecretVaultService,
    private readonly oauth: OauthService,
    private readonly config: ConfigService,
  ) {}

  async getOverview(orgId: string | null): Promise<SecurityOverviewDto> {
    const roleCount = await this.roleRepo.count();
    const permissionCount = Object.values(Permission).length;
    const usersWithRoles = await this.userRoleRepo
      .createQueryBuilder('ur')
      .select('COUNT(DISTINCT ur.user_id)', 'c')
      .getRawOne()
      .then((r) => Number(r?.c ?? 0));

    const policyCount = await this.policyRepo.count();
    const activePolicies = await this.policyRepo.count({ where: { isActive: true } });
    const geoScopedUsers = await this.geoRepo
      .createQueryBuilder('g')
      .select('COUNT(DISTINCT g.user_id)', 'c')
      .getRawOne()
      .then((r) => Number(r?.c ?? 0));

    const audit = await this.audit.stats(orgId);
    const secrets = await this.secrets.count(orgId);
    const oauth = await this.oauth.count(orgId);

    return {
      rbac: { roleCount, permissionCount, usersWithRoles },
      abac: { policyCount, activePolicies, geoScopedUsers },
      audit,
      secrets: { managedCount: secrets },
      oauth: { clientCount: oauth.all, activeClients: oauth.active },
      rateLimit: {
        ttlSeconds: Number(this.config.get('THROTTLE_TTL', 60)),
        limit: Number(this.config.get('THROTTLE_LIMIT', 120)),
        authLimit: Number(this.config.get('THROTTLE_AUTH_LIMIT', 10)),
      },
    };
  }
}
