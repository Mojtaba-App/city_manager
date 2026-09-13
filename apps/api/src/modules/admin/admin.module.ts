import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { SystemSetting } from './entities/system-setting.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { AdminUsersService } from './services/admin-users.service';
import { RolesService } from './services/roles.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { ReportsExecutionService } from './services/reports-execution.service';
import { ReportSchedulesService } from './services/report-schedules.service';
import { ReportScheduleWorkerService } from './services/report-schedule-worker.service';
import { ReportRegistryService } from './services/report-registry.service';
import { GlobalSearchService } from './services/global-search.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { ReportDefinitionEntity } from '../analytics/entities/report-definition.entity';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { CaseModule } from '../case/case.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    CaseModule,
    SecurityModule,
    TypeOrmModule.forFeature([
      SystemSetting, ReportSchedule, User, Role, UserRole, AuditLog, ReportDefinitionEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [
    AdminUsersService,
    RolesService,
    AdminDashboardService,
    ReportsExecutionService,
    ReportSchedulesService,
    ReportScheduleWorkerService,
    ReportRegistryService,
    GlobalSearchService,
  ],
  exports: [AdminDashboardService, ReportsExecutionService, ReportSchedulesService, ReportScheduleWorkerService],
})
export class AdminModule {}
