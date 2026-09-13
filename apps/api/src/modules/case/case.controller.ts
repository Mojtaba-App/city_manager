import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ParseUUIDPipe,
  ForbiddenException, UseInterceptors, UploadedFile, Res, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, JwtPayload, CaseEntityType } from '@city-manager/shared';
import { Audited } from '../../common/decorators/audit.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CaseDwellingsService } from './services/case-dwellings.service';
import { HouseholdsService } from './services/households.service';
import { MembersService, hasPiiPermission } from './services/members.service';
import { OwnershipService, InsuranceService, AgenciesService, FormsService } from './services/support-services';
import {
  CreateDwellingDto, CreateHouseholdDto, UpdateHouseholdDto, CreateMemberDto,
  CreateOwnershipDto, CreateInsuranceDto, CreateAgencyDto, UpsertFormDefinitionDto,
} from './dto/case.dto';
import {
  CreateCaseTaskDto, UpdateCaseTaskDto, CreateFieldVisitDto, CompleteFieldVisitDto,
  CreateSupportPackageDto, AssignSupportPackageDto, UpdateSupportAssignmentDto,
  AssignHouseholdDto, VulnerabilityAssessmentDto, SendMessageDto, OperationsQueryDto,
} from './dto/operations.dto';
import { HouseholdAssignmentService } from './services/household-assignment.service';
import { CaseTasksService } from './services/case-tasks.service';
import { FieldVisitsService } from './services/field-visits.service';
import { SupportPackagesService } from './services/support-packages.service';
import { HouseholdDocumentsService } from './services/household-documents.service';
import { VulnerabilityService } from './services/vulnerability.service';
import { MessagingDispatchService } from './services/messaging-dispatch.service';
import { OperationalEventsService } from './services/operational-events.service';
import { UsersService } from '../users/users.service';

function orgId(user: JwtPayload): string {
  if (!user.orgId) throw new ForbiddenException('سازمان کاربر تعریف نشده');
  return user.orgId;
}

@ApiTags('case')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('case')
export class CaseController {
  constructor(
    private readonly dwellings: CaseDwellingsService,
    private readonly households: HouseholdsService,
    private readonly members: MembersService,
    private readonly ownership: OwnershipService,
    private readonly insurance: InsuranceService,
    private readonly agencies: AgenciesService,
    private readonly forms: FormsService,
    private readonly assignment: HouseholdAssignmentService,
    private readonly tasks: CaseTasksService,
    private readonly visits: FieldVisitsService,
    private readonly packages: SupportPackagesService,
    private readonly documents: HouseholdDocumentsService,
    private readonly vulnerability: VulnerabilityService,
    private readonly messaging: MessagingDispatchService,
    private readonly events: OperationalEventsService,
    private readonly users: UsersService,
  ) {}

  // --- Dwellings ---
  @Get('dwellings')
  @Permissions(Permission.DWELLINGS_READ)
  listDwellings(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.dwellings.findAll(orgId(user), query);
  }

  @Get('dwellings/:id')
  @Permissions(Permission.DWELLINGS_READ)
  getDwelling(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.dwellings.findOne(orgId(user), id);
  }

  @Post('dwellings')
  @Permissions(Permission.DWELLINGS_WRITE)
  @Audited({ action: 'dwelling.create', resource: 'dwelling' })
  createDwelling(@CurrentUser() user: JwtPayload, @Body() dto: CreateDwellingDto) {
    return this.dwellings.create(orgId(user), user.sub, dto);
  }

  @Patch('dwellings/:id')
  @Permissions(Permission.DWELLINGS_WRITE)
  @Audited({ action: 'dwelling.update', resource: 'dwelling' })
  updateDwelling(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDwellingDto) {
    return this.dwellings.update(orgId(user), user.sub, id, dto);
  }

  @Post('dwellings/:id/ownership')
  @Permissions(Permission.DWELLINGS_WRITE)
  @Audited({ action: 'ownership.create', resource: 'dwelling' })
  addOwnership(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOwnershipDto,
  ) {
    return this.ownership.create(orgId(user), user.sub, id, dto);
  }

  // --- Households ---
  @Get('households')
  @Permissions(Permission.HOUSEHOLDS_READ)
  listHouseholds(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.households.findAll(orgId(user), query, user);
  }

  @Get('assignees')
  @Permissions(Permission.HOUSEHOLDS_WRITE)
  listAssignees(@CurrentUser() user: JwtPayload) {
    return this.users.listAssignees(orgId(user));
  }

  @Get('households/priority-queue')
  @Permissions(Permission.OPERATIONS_READ)
  priorityQueue(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.assignment.priorityQueue(orgId(user), limit ? Number(limit) : 50);
  }

  @Get('households/by-dwelling/:dwellingId')
  @Permissions(Permission.HOUSEHOLDS_READ)
  householdByDwelling(
    @CurrentUser() user: JwtPayload,
    @Param('dwellingId', ParseUUIDPipe) dwellingId: string,
  ) {
    return this.households.findByDwelling(orgId(user), dwellingId);
  }

  @Get('households/:id')
  @Permissions(Permission.HOUSEHOLDS_READ)
  getHousehold(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.households.findOne(orgId(user), id);
  }

  @Post('households')
  @Permissions(Permission.HOUSEHOLDS_WRITE)
  @Audited({ action: 'household.create', resource: 'household' })
  createHousehold(@CurrentUser() user: JwtPayload, @Body() dto: CreateHouseholdDto) {
    return this.households.create(orgId(user), user.sub, dto);
  }

  @Patch('households/:id')
  @Permissions(Permission.HOUSEHOLDS_WRITE)
  @Audited({ action: 'household.update', resource: 'household' })
  updateHousehold(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHouseholdDto) {
    return this.households.update(orgId(user), user.sub, id, dto);
  }

  @Post('households/:id/assign')
  @Permissions(Permission.OPERATIONS_ASSIGN)
  @Audited({ action: 'household.assign', resource: 'household', severity: 'warning' })
  assignHousehold(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignHouseholdDto,
  ) {
    return this.assignment.assign(orgId(user), id, dto.assignedUserId).then(async (res) => {
      await this.events.onHouseholdAssigned(orgId(user), user.sub, id, dto.assignedUserId);
      return res;
    });
  }

  @Delete('households/:id')
  @Permissions(Permission.HOUSEHOLDS_WRITE)
  @Audited({ action: 'household.delete', resource: 'household', severity: 'warning' })
  deleteHousehold(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.households.softDelete(orgId(user), user.sub, id);
  }

  @Get('households/:id/history')
  @Permissions(Permission.HOUSEHOLDS_READ)
  householdHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.households.getHistory(CaseEntityType.HOUSEHOLD, id);
  }

  // --- Tasks ---
  @Get('operations/tasks/mine')
  @Permissions(Permission.OPERATIONS_READ)
  myTasks(@CurrentUser() user: JwtPayload, @Query() query: OperationsQueryDto) {
    return this.tasks.listMine(orgId(user), user.sub, query.status);
  }

  @Get('operations/tasks/overdue')
  @Permissions(Permission.OPERATIONS_READ)
  overdueTasks(@CurrentUser() user: JwtPayload) {
    return this.tasks.listOverdue(orgId(user));
  }

  @Get('households/:id/tasks')
  @Permissions(Permission.OPERATIONS_READ)
  listTasks(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.listByHousehold(orgId(user), id);
  }

  @Post('households/:id/tasks')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'task.create', resource: 'household' })
  createTask(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCaseTaskDto,
  ) {
    return this.tasks.create(orgId(user), user.sub, id, dto);
  }

  @Patch('households/:householdId/tasks/:taskId')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'task.update', resource: 'case_task', resourceIdParam: 'params.taskId' })
  updateTask(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateCaseTaskDto,
  ) {
    return this.tasks.update(orgId(user), user.sub, householdId, taskId, dto);
  }

  @Delete('households/:householdId/tasks/:taskId')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'task.delete', resource: 'case_task', resourceIdParam: 'params.taskId' })
  deleteTask(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.tasks.softDelete(orgId(user), householdId, taskId);
  }

  // --- Field visits ---
  @Get('households/:id/visits')
  @Permissions(Permission.OPERATIONS_READ)
  listVisits(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.listByHousehold(orgId(user), id);
  }

  @Post('households/:id/visits')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'visit.create', resource: 'household' })
  createVisit(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFieldVisitDto,
  ) {
    return this.visits.create(orgId(user), user.sub, id, dto);
  }

  @Post('households/:householdId/visits/:visitId/complete')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'visit.complete', resource: 'field_visit', resourceIdParam: 'params.visitId' })
  completeVisit(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Body() dto: CompleteFieldVisitDto,
  ) {
    return this.visits.complete(orgId(user), user.sub, householdId, visitId, dto);
  }

  @Post('households/:householdId/visits/:visitId/cancel')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'visit.cancel', resource: 'field_visit', resourceIdParam: 'params.visitId' })
  cancelVisit(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('visitId', ParseUUIDPipe) visitId: string,
  ) {
    return this.visits.cancel(orgId(user), householdId, visitId);
  }

  // --- Support packages ---
  @Get('support-packages')
  @Permissions(Permission.OPERATIONS_READ)
  listSupportPackages(@CurrentUser() user: JwtPayload) {
    return this.packages.listPackages(orgId(user));
  }

  @Post('support-packages')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'support_package.create', resource: 'support_package' })
  createSupportPackage(@CurrentUser() user: JwtPayload, @Body() dto: CreateSupportPackageDto) {
    return this.packages.createPackage(orgId(user), dto);
  }

  @Get('households/:id/support-assignments')
  @Permissions(Permission.OPERATIONS_READ)
  listSupportAssignments(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.packages.listAssignments(orgId(user), id);
  }

  @Post('households/:id/support-assignments')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'support.assign', resource: 'household' })
  assignSupport(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSupportPackageDto,
  ) {
    return this.packages.assignPackage(orgId(user), user.sub, id, dto);
  }

  @Patch('households/:householdId/support-assignments/:assignmentId')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'support.update', resource: 'support_assignment', resourceIdParam: 'params.assignmentId' })
  updateSupportAssignment(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateSupportAssignmentDto,
  ) {
    return this.packages.updateAssignment(orgId(user), householdId, assignmentId, dto);
  }

  // --- Documents ---
  @Get('households/:id/documents')
  @Permissions(Permission.DOCUMENTS_READ)
  listDocuments(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.list(orgId(user), id);
  }

  @Post('households/:id/documents')
  @Permissions(Permission.DOCUMENTS_WRITE)
  @Audited({ action: 'document.upload', resource: 'household', severity: 'warning' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  uploadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('category') category?: string,
  ) {
    if (!title?.trim()) throw new BadRequestException('عنوان سند الزامی است');
    return this.documents.upload(orgId(user), user.sub, id, file, { title, category });
  }

  @Get('households/:householdId/documents/:documentId/download')
  @Permissions(Permission.DOCUMENTS_READ)
  async downloadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ) {
    const { doc, buffer } = await this.documents.getDownload(orgId(user), householdId, documentId);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    res.send(buffer);
  }

  @Delete('households/:householdId/documents/:documentId')
  @Permissions(Permission.DOCUMENTS_WRITE)
  @Audited({ action: 'document.delete', resource: 'household_document', resourceIdParam: 'params.documentId', severity: 'warning' })
  deleteDocument(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.softDelete(orgId(user), householdId, documentId);
  }

  // --- Vulnerability ---
  @Get('households/:id/vulnerability')
  @Permissions(Permission.OPERATIONS_READ)
  listVulnerability(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.vulnerability.list(orgId(user), id);
  }

  @Post('households/:id/vulnerability')
  @Permissions(Permission.OPERATIONS_WRITE)
  @Audited({ action: 'vulnerability.assess', resource: 'household' })
  assessVulnerability(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VulnerabilityAssessmentDto,
  ) {
    return this.vulnerability.assess(orgId(user), user.sub, id, dto);
  }

  // --- Messaging ---
  @Get('operations/messages')
  @Permissions(Permission.MESSAGING_SEND)
  listMessages(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.messaging.listOutbox(orgId(user), limit ? Number(limit) : 50);
  }

  @Post('households/:id/messages')
  @Permissions(Permission.MESSAGING_SEND)
  @Audited({ action: 'message.send', resource: 'household', severity: 'warning' })
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.sendManual(orgId(user), user.sub, id, dto);
  }

  // --- Members ---
  @Get('households/:id/members')
  @Permissions(Permission.MEMBERS_READ)
  listMembers(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.members.findByHousehold(orgId(user), id, hasPiiPermission(user.permissions, false));
  }

  @Post('households/:id/members')
  @Permissions(Permission.MEMBERS_WRITE)
  @Audited({ action: 'member.create', resource: 'household' })
  addMember(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMemberDto) {
    return this.members.create(orgId(user), user.sub, id, dto, hasPiiPermission(user.permissions, true));
  }

  @Patch('households/:householdId/members/:memberId')
  @Permissions(Permission.MEMBERS_WRITE)
  @Audited({ action: 'member.update', resource: 'member', resourceIdParam: 'params.memberId' })
  updateMember(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateMemberDto,
  ) {
    return this.members.update(orgId(user), user.sub, householdId, memberId, dto, hasPiiPermission(user.permissions, true));
  }

  @Delete('households/:householdId/members/:memberId')
  @Permissions(Permission.MEMBERS_WRITE)
  @Audited({ action: 'member.delete', resource: 'member', resourceIdParam: 'params.memberId', severity: 'warning' })
  deleteMember(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.members.softDelete(orgId(user), user.sub, householdId, memberId);
  }

  // --- Insurance ---
  @Get('households/:id/insurance')
  @Permissions(Permission.INSURANCE_READ)
  listInsurance(@Param('id', ParseUUIDPipe) id: string) {
    return this.insurance.findByHousehold(id);
  }

  @Post('households/:id/insurance')
  @Permissions(Permission.INSURANCE_WRITE)
  @Audited({ action: 'insurance.create', resource: 'household' })
  addInsurance(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateInsuranceDto) {
    return this.insurance.create(orgId(user), user.sub, id, dto);
  }

  // --- Agencies ---
  @Get('agencies')
  @Permissions(Permission.AGENCIES_READ)
  listAgencies(@CurrentUser() user: JwtPayload) {
    return this.agencies.findAll(orgId(user));
  }

  @Post('agencies')
  @Permissions(Permission.AGENCIES_WRITE)
  @Audited({ action: 'agency.create', resource: 'agency' })
  createAgency(@CurrentUser() user: JwtPayload, @Body() dto: CreateAgencyDto) {
    return this.agencies.create(orgId(user), dto);
  }

  @Get('forms')
  @Permissions(Permission.FORMS_READ)
  listForms(@CurrentUser() user: JwtPayload) {
    return this.forms.listAll(orgId(user));
  }

  @Get('forms/:entityType')
  @Permissions(Permission.FORMS_READ)
  getForm(@CurrentUser() user: JwtPayload, @Param('entityType') entityType: string) {
    return this.forms.getForm(orgId(user), entityType);
  }

  @Post('forms')
  @Permissions(Permission.FORMS_WRITE)
  @Audited({ action: 'form.upsert', resource: 'form_definition', severity: 'warning' })
  upsertForm(@CurrentUser() user: JwtPayload, @Body() dto: UpsertFormDefinitionDto) {
    return this.forms.upsert(orgId(user), dto);
  }
}
