import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../modules/users/entities/role.entity';
import { UserRole } from '../modules/users/entities/user-role.entity';
import { Organization } from '../modules/organizations/entities/organization.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { FabricType } from '../modules/gis/entities/fabric-type.entity';
import { Fabric } from '../modules/gis/entities/fabric.entity';
import { Neighborhood } from '../modules/gis/entities/neighborhood.entity';
import { RegenerationProgram } from '../modules/gis/entities/regeneration-program.entity';
import { Dwelling } from '../modules/case/entities/dwelling.entity';
import { Household } from '../modules/case/entities/household.entity';
import { FamilyMember } from '../modules/case/entities/family-member.entity';
import { OwnershipRecord } from '../modules/case/entities/ownership-record.entity';
import { InsuranceRecord } from '../modules/case/entities/insurance-record.entity';
import { Agency } from '../modules/case/entities/agency.entity';
import { EntityChangeLog } from '../modules/case/entities/entity-change-log.entity';
import { FormDefinition } from '../modules/case/entities/form-definition.entity';
import { HouseholdStatusHistory } from '../modules/case/entities/household-status-history.entity';
import { LifeTrajectoryRecord } from '../modules/trajectory/entities/life-trajectory-record.entity';
import { TrajectoryRecordVersion } from '../modules/trajectory/entities/trajectory-record-version.entity';
import { ExpertNote } from '../modules/trajectory/entities/expert-note.entity';
import { SystemSetting } from '../modules/admin/entities/system-setting.entity';
import { KpiDefinition } from '../modules/analytics/entities/kpi-definition.entity';
import { ReportSnapshot } from '../modules/analytics/entities/report-snapshot.entity';
import { ReportDefinitionEntity } from '../modules/analytics/entities/report-definition.entity';
import { Connector } from '../modules/integration/entities/connector.entity';
import { FieldMapping } from '../modules/integration/entities/field-mapping.entity';
import { SyncJob } from '../modules/integration/entities/sync-job.entity';
import { SyncJobLog } from '../modules/integration/entities/sync-job-log.entity';
import { SyncQueueItem } from '../modules/integration/entities/sync-queue-item.entity';
import { WebhookEvent } from '../modules/integration/entities/webhook-event.entity';
import { ExternalIdMapping } from '../modules/integration/entities/external-id-mapping.entity';
import { ConnectionTest } from '../modules/integration/entities/connection-test.entity';
import { SpatialUpload } from '../modules/gis/entities/spatial-upload.entity';
import { AreaProject } from '../modules/gis/entities/area-project.entity';
import { GisLayer, LayerVersion, LayerFeature } from '../modules/gis/entities/gis-layer.entity';
import { ReportSchedule } from '../modules/admin/entities/report-schedule.entity';
import { AbacPolicy } from '../modules/security/entities/abac-policy.entity';
import { UserGeoScope } from '../modules/security/entities/user-geo-scope.entity';
import { OauthClient } from '../modules/security/entities/oauth-client.entity';
import { ManagedSecret } from '../modules/security/entities/managed-secret.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get<string>('POSTGRES_USER', 'city_manager'),
        password: config.get<string>('POSTGRES_PASSWORD'),
        database: config.get<string>('POSTGRES_DB', 'city_manager'),
        autoLoadEntities: true,
        // Connection pool tuning: support ~10 concurrent analytical users
        // without exhausting connections (each analytical page = ~7 queries).
        extra: {
          max: Number(config.get('DB_POOL_MAX', '40')),
          min: Number(config.get('DB_POOL_MIN', '5')),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          // Kill runaway analytical queries; protects the pool under load.
          statement_timeout: Number(config.get('DB_STATEMENT_TIMEOUT_MS', '30000')),
        },
        entities: [
          User, Role, UserRole, Organization, AuditLog, RefreshToken,
          FabricType, Fabric, Neighborhood, RegenerationProgram, SpatialUpload,
          AreaProject, GisLayer, LayerVersion, LayerFeature,
          Dwelling, Household, FamilyMember, OwnershipRecord, InsuranceRecord,
          Agency, EntityChangeLog, FormDefinition, HouseholdStatusHistory,
          LifeTrajectoryRecord, TrajectoryRecordVersion, ExpertNote,
          SystemSetting, KpiDefinition, ReportSnapshot, ReportDefinitionEntity,
          Connector, FieldMapping, SyncJob, SyncJobLog,
          SyncQueueItem, WebhookEvent, ExternalIdMapping, ConnectionTest,
          AbacPolicy, UserGeoScope, OauthClient, ManagedSecret, ReportSchedule,
        ],
        migrations: [`${__dirname}/migrations/*{.ts,.js}`],
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
