import {
  IsString, IsOptional, IsEnum, IsUUID, IsDateString, IsNumber, IsArray, IsBoolean,
  MaxLength, Min, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CaseTaskType, CaseTaskStatus, CaseTaskPriority, FieldVisitStatus,
  SupportPackageCategory, SupportAssignmentStatus, HouseholdDocumentCategory,
  MessageChannel,
} from '@city-manager/shared';

export class ChecklistItemDto {
  @ApiProperty()
  @IsString() @MaxLength(300)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  done?: boolean;
}

export class CreateCaseTaskDto {
  @ApiProperty()
  @IsString() @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CaseTaskType })
  @IsOptional() @IsEnum(CaseTaskType)
  taskType?: CaseTaskType;

  @ApiPropertyOptional({ enum: CaseTaskPriority })
  @IsOptional() @IsEnum(CaseTaskPriority)
  priority?: CaseTaskPriority;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ type: [ChecklistItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];
}

export class UpdateCaseTaskDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CaseTaskStatus })
  @IsOptional() @IsEnum(CaseTaskStatus)
  status?: CaseTaskStatus;

  @ApiPropertyOptional({ enum: CaseTaskPriority })
  @IsOptional() @IsEnum(CaseTaskPriority)
  priority?: CaseTaskPriority;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ type: [ChecklistItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];
}

export class CreateFieldVisitDto {
  @ApiProperty()
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  taskId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  addressNote?: string;
}

export class CompleteFieldVisitDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ enum: FieldVisitStatus })
  @IsOptional() @IsEnum(FieldVisitStatus)
  status?: FieldVisitStatus;
}

export class CreateSupportPackageDto {
  @ApiProperty()
  @IsString() @MaxLength(50)
  code!: string;

  @ApiProperty()
  @IsString() @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ enum: SupportPackageCategory })
  @IsOptional() @IsEnum(SupportPackageCategory)
  category?: SupportPackageCategory;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  budgetAmount?: number;
}

export class AssignSupportPackageDto {
  @ApiProperty()
  @IsUUID()
  packageId!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  assignedAt?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  outcomeNotes?: string;
}

export class UpdateSupportAssignmentDto {
  @ApiPropertyOptional({ enum: SupportAssignmentStatus })
  @IsOptional() @IsEnum(SupportAssignmentStatus)
  status?: SupportAssignmentStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  outcomeNotes?: string;
}

export class AssignHouseholdDto {
  @ApiProperty()
  @IsUUID()
  assignedUserId!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  note?: string;
}

export class VulnerabilityAssessmentDto {
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0)
  incomeScore!: number;

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0)
  housingScore!: number;

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0)
  healthScore!: number;

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0)
  employmentScore!: number;

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0)
  educationScore!: number;

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0)
  familySizeScore!: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}

export class SendMessageDto {
  @ApiProperty({ enum: MessageChannel })
  @IsEnum(MessageChannel)
  channel!: MessageChannel;

  @ApiProperty()
  @IsString() @MaxLength(300)
  recipient!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  subject?: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  templateCode?: string;
}

export class UploadDocumentMetaDto {
  @ApiProperty()
  @IsString() @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ enum: HouseholdDocumentCategory })
  @IsOptional() @IsEnum(HouseholdDocumentCategory)
  category?: HouseholdDocumentCategory;
}

export class OperationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  status?: string;
}
