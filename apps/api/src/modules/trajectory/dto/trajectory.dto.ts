import {
  IsString, IsOptional, IsNumber, IsUUID, IsEnum, IsObject, IsDateString,
  IsInt, Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  TrajectoryRecordType, LifeEventType, SupportTrajectoryStatus,
  EmploymentStatus, EducationLevel,
} from '@city-manager/shared';

export class CreateTrajectoryRecordDto {
  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  memberId?: string;

  @ApiProperty({ enum: TrajectoryRecordType })
  @IsEnum(TrajectoryRecordType)
  recordType!: TrajectoryRecordType;

  @ApiPropertyOptional({ enum: LifeEventType })
  @IsOptional() @IsEnum(LifeEventType)
  eventType?: LifeEventType;

  @ApiProperty()
  @IsDateString()
  eventDate!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional() @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  employerName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  previousJobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  monthlyIncome?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  previousIncome?: number;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional() @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  educationField?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  dwellingId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  previousDwellingId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  dwellingAddress?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  previousDwellingAddress?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  qualityOfLifeScore?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  previousQolScore?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  qolDimensions?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: SupportTrajectoryStatus })
  @IsOptional() @IsEnum(SupportTrajectoryStatus)
  supportStatus?: SupportTrajectoryStatus;

  @ApiPropertyOptional({ enum: SupportTrajectoryStatus })
  @IsOptional() @IsEnum(SupportTrajectoryStatus)
  previousSupportStatus?: SupportTrajectoryStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  supportAgencyId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateTrajectoryRecordDto extends PartialType(CreateTrajectoryRecordDto) {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  changeReason?: string;
}

export class CreateExpertNoteDto {
  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  recordId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  title?: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  noteType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isConfidential?: boolean;
}

export class CompareTrajectoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  memberId?: string;
}
