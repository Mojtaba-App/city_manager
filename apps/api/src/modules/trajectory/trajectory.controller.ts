import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, JwtPayload } from '@city-manager/shared';
import { TrajectoryRecordsService, hasTrajectoryPiiPermission } from './services/trajectory-records.service';
import { ExpertNotesService } from './services/expert-notes.service';
import {
  CreateTrajectoryRecordDto, UpdateTrajectoryRecordDto, CreateExpertNoteDto, CompareTrajectoryQueryDto,
} from './dto/trajectory.dto';

function orgId(user: JwtPayload): string {
  if (!user.orgId) throw new ForbiddenException('سازمان کاربر تعریف نشده');
  return user.orgId;
}

@ApiTags('trajectory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trajectory')
export class TrajectoryController {
  constructor(
    private readonly records: TrajectoryRecordsService,
    private readonly notes: ExpertNotesService,
  ) {}

  @Get('households/:householdId/timeline')
  @Permissions(Permission.TRAJECTORY_READ)
  timeline(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query('memberId') memberId?: string,
  ) {
    return this.records.findByHousehold(
      orgId(user), householdId, memberId,
      hasTrajectoryPiiPermission(user.permissions),
    );
  }

  @Get('households/:householdId/trends')
  @Permissions(Permission.TRAJECTORY_READ)
  trends(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query('memberId') memberId?: string,
  ) {
    return this.records.getTrends(
      orgId(user), householdId, memberId,
      hasTrajectoryPiiPermission(user.permissions),
    );
  }

  @Get('households/:householdId/compare')
  @Permissions(Permission.TRAJECTORY_READ)
  compare(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query() query: CompareTrajectoryQueryDto,
  ) {
    return this.records.compare(
      orgId(user), householdId, query.fromDate, query.toDate, query.memberId,
      hasTrajectoryPiiPermission(user.permissions),
    );
  }

  @Get('records/:id')
  @Permissions(Permission.TRAJECTORY_READ)
  getRecord(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.records.findOne(orgId(user), id, hasTrajectoryPiiPermission(user.permissions));
  }

  @Post('households/:householdId/records')
  @Permissions(Permission.TRAJECTORY_WRITE)
  createRecord(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: CreateTrajectoryRecordDto,
  ) {
    return this.records.create(orgId(user), user.sub, householdId, dto);
  }

  @Patch('records/:id')
  @Permissions(Permission.TRAJECTORY_WRITE)
  updateRecord(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrajectoryRecordDto,
  ) {
    return this.records.update(orgId(user), user.sub, id, dto);
  }

  @Get('households/:householdId/notes')
  @Permissions(Permission.TRAJECTORY_READ)
  listNotes(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query('memberId') memberId?: string,
  ) {
    return this.notes.findByHousehold(orgId(user), householdId, memberId);
  }

  @Post('households/:householdId/notes')
  @Permissions(Permission.TRAJECTORY_WRITE)
  createNote(
    @CurrentUser() user: JwtPayload,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: CreateExpertNoteDto,
  ) {
    return this.notes.create(orgId(user), user.sub, householdId, dto);
  }
}
