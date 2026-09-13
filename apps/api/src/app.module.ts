import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { buildThrottlerModuleOptions } from './config/throttler.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { GisModule } from './modules/gis/gis.module';
import { CaseModule } from './modules/case/case.module';
import { TrajectoryModule } from './modules/trajectory/trajectory.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { SecurityModule } from './modules/security/security.module';
import { StorageModule } from './modules/storage/storage.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { PresenceModule } from './modules/presence/presence.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildThrottlerModuleOptions(config),
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AuditModule,
    GisModule,
    CaseModule,
    TrajectoryModule,
    AdminModule,
    AnalyticsModule,
    IntegrationModule,
    SecurityModule,
    StorageModule,
    CollaborationModule,
    PresenceModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
