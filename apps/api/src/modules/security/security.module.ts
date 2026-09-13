import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AbacPolicy } from './entities/abac-policy.entity';
import { UserGeoScope } from './entities/user-geo-scope.entity';
import { OauthClient } from './entities/oauth-client.entity';
import { ManagedSecret } from './entities/managed-secret.entity';
import { DataAccessLog, ExportLog, PiiAccessGrant } from './entities/pii-governance.entity';
import { Role } from '../users/entities/role.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { User } from '../users/entities/user.entity';
import { AuditModule } from '../audit/audit.module';
import { CaseModule } from '../case/case.module';
import { FieldMaskingService } from './services/field-masking.service';
import { AbacService } from './services/abac.service';
import { RowLevelAccessService } from './services/row-level-access.service';
import { SecretVaultService } from './services/secret-vault.service';
import { OauthService } from './services/oauth.service';
import { SecurityOverviewService } from './services/security-overview.service';
import { PiiAccessService } from './services/pii-access.service';
import { SecurityController, OauthTokenController } from './security.controller';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';

@Module({
  imports: [
    CaseModule,
    TypeOrmModule.forFeature([
      AbacPolicy,
      UserGeoScope,
      OauthClient,
      ManagedSecret,
      DataAccessLog,
      ExportLog,
      PiiAccessGrant,
      Role,
      UserRole,
      User,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        },
      }),
    }),
    AuditModule,
  ],
  controllers: [SecurityController, OauthTokenController],
  providers: [
    FieldMaskingService,
    AbacService,
    RowLevelAccessService,
    SecretVaultService,
    OauthService,
    SecurityOverviewService,
    PiiAccessService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [
    FieldMaskingService,
    AbacService,
    RowLevelAccessService,
    SecretVaultService,
    OauthService,
    PiiAccessService,
  ],
})
export class SecurityModule {}
