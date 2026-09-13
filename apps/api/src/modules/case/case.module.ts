import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseController } from './case.controller';
import { Dwelling } from './entities/dwelling.entity';
import { Household } from './entities/household.entity';
import { FamilyMember } from './entities/family-member.entity';
import { OwnershipRecord } from './entities/ownership-record.entity';
import { InsuranceRecord } from './entities/insurance-record.entity';
import { Agency } from './entities/agency.entity';
import { EntityChangeLog } from './entities/entity-change-log.entity';
import { FormDefinition } from './entities/form-definition.entity';
import { HouseholdStatusHistory } from './entities/household-status-history.entity';
import { CaseTask } from './entities/case-task.entity';
import { FieldVisit } from './entities/field-visit.entity';
import { SupportPackage, HouseholdSupportAssignment } from './entities/support-package.entity';
import { HouseholdDocument, VulnerabilityAssessment, MessageOutbox } from './entities/household-document.entity';
import { SystemSetting } from '../admin/entities/system-setting.entity';
import { CaseDwellingsService } from './services/case-dwellings.service';
import { DwellingFacadeService } from './services/dwelling-facade.service';
import { HouseholdsService } from './services/households.service';
import { MembersService } from './services/members.service';
import { OwnershipService, InsuranceService, AgenciesService, FormsService } from './services/support-services';
import { PiiCryptoService } from './services/pii-crypto.service';
import { ChangeLogService } from './services/change-log.service';
import { HouseholdAssignmentService } from './services/household-assignment.service';
import { CaseTasksService } from './services/case-tasks.service';
import { FieldVisitsService } from './services/field-visits.service';
import { SupportPackagesService } from './services/support-packages.service';
import { HouseholdDocumentsService } from './services/household-documents.service';
import { VulnerabilityService } from './services/vulnerability.service';
import { MessagingDispatchService } from './services/messaging-dispatch.service';
import { MessageOutboxWorkerService } from './services/message-outbox-worker.service';
import { OperationalEventsService } from './services/operational-events.service';
import { StorageModule } from '../storage/storage.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { UsersModule } from '../users/users.module';
import { ConfigModule } from '@nestjs/config';
import { UserGeoScope } from '../security/entities/user-geo-scope.entity';
import { AbacPolicy } from '../security/entities/abac-policy.entity';
import { User } from '../users/entities/user.entity';
import { AbacService } from '../security/services/abac.service';
import { RowLevelAccessService } from '../security/services/row-level-access.service';

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    CollaborationModule,
    UsersModule,
    TypeOrmModule.forFeature([
      Dwelling, Household, FamilyMember, OwnershipRecord, InsuranceRecord,
      Agency, EntityChangeLog, FormDefinition, HouseholdStatusHistory,
      CaseTask, FieldVisit, SupportPackage, HouseholdSupportAssignment,
      HouseholdDocument, VulnerabilityAssessment, MessageOutbox, SystemSetting,
      UserGeoScope, AbacPolicy, User,
    ]),
  ],
  controllers: [CaseController],
  providers: [
    CaseDwellingsService, DwellingFacadeService, HouseholdsService, MembersService,
    OwnershipService, InsuranceService, AgenciesService, FormsService,
    PiiCryptoService, ChangeLogService,
    HouseholdAssignmentService, CaseTasksService, FieldVisitsService,
    SupportPackagesService, HouseholdDocumentsService, VulnerabilityService,
    MessagingDispatchService, MessageOutboxWorkerService, OperationalEventsService,
    AbacService, RowLevelAccessService,
  ],
  exports: [
    CaseDwellingsService,
    DwellingFacadeService,
    ChangeLogService,
    PiiCryptoService,
    MessagingDispatchService,
    MessageOutboxWorkerService,
    TypeOrmModule,
  ],
})
export class CaseModule {}
