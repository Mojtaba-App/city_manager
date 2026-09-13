import {
  IsString, IsOptional, IsNumber, IsUUID, IsObject, IsEnum, IsBoolean, IsDateString, Min, MaxLength,
  IsNotEmpty, Matches, MinLength, ValidateIf, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OwnershipType, MemberRole, EducationLevel, EmploymentStatus, HouseholdStatus, LandUseType, CaseEntityType } from '@city-manager/shared';

export class CreateDwellingDto {
  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  neighborhoodId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  dwellingCode?: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'عنوان ملک الزامی است' })
  @IsString() @MaxLength(300)
  title!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'استان الزامی است' })
  @IsString() @MaxLength(100)
  province!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'شهر الزامی است' })
  @IsString() @MaxLength(100)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  district?: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'خیابان الزامی است' })
  @IsString() @MaxLength(300)
  street!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  alley?: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'پلاک الزامی است' })
  @IsString() @MaxLength(50)
  plaque!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  fullAddress?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  areaSqm?: number;

  @ApiProperty()
  @IsNotEmpty({ message: 'نوع ساختمان الزامی است' })
  @IsString() @MaxLength(100)
  buildingType!: string;

  @ApiPropertyOptional({ enum: LandUseType, description: 'کاربری زمین' })
  @IsOptional() @IsEnum(LandUseType)
  landUse?: LandUseType;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  floorCount?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  unitCount?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  constructionYear?: number;

  @ApiPropertyOptional({ description: 'قدمت ابنیه (سال)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  buildingAgeYears?: number;

  @ApiPropertyOptional({ description: 'GeoJSON Point' })
  @IsOptional() @IsObject()
  geometry?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  customFields?: Record<string, unknown>;
}

export class CreateOwnershipDto {
  @ApiProperty({ enum: OwnershipType })
  @IsEnum(OwnershipType)
  ownershipType!: OwnershipType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  leaseStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  leaseEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  monthlyRent?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  documentReference?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}

export class CreateHouseholdDto {
  @ApiProperty()
  @IsUUID()
  dwellingId!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  neighborhoodId?: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'شماره پرونده الزامی است' })
  @IsString() @MaxLength(100)
  caseNumber!: string;

  @ApiPropertyOptional({ enum: HouseholdStatus })
  @IsOptional() @IsEnum(HouseholdStatus)
  status?: HouseholdStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  registeredAt?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'کاربر مسئول پرونده' })
  @IsOptional() @IsUUID()
  assignedUserId?: string;
}

export class UpdateHouseholdDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: HouseholdStatus })
  @IsOptional() @IsEnum(HouseholdStatus)
  status?: HouseholdStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  statusChangeReason?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  customFields?: Record<string, unknown>;

  /**
   * Optimistic lock: send the current `version` value you loaded.
   * If another user saved in the meantime the version will mismatch
   * and you will receive a 409 Conflict.
   */
  @ApiPropertyOptional({ description: 'نسخه پرونده برای قفل خوش‌بینانه' })
  @IsOptional() @Type(() => Number) @IsNumber()
  expectedVersion?: number;
}

export class CreateMemberDto {
  @ApiProperty({ enum: MemberRole })
  @IsEnum(MemberRole)
  memberRole!: MemberRole;

  @ApiProperty()
  @IsString() @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString() @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.birthDate != null && String(o.birthDate).trim() !== '')
  @IsDateString({}, { message: 'تاریخ تولد نامعتبر است' })
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  fatherName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  motherName?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.nationalId != null && String(o.nationalId).trim() !== '')
  @Matches(/^\d{10}$/, { message: 'کد ملی باید ۱۰ رقم باشد' })
  nationalId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.phone != null && String(o.phone).trim() !== '')
  @MinLength(10, { message: 'شماره تلفن باید حداقل ۱۰ رقم باشد' })
  phone?: string;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional() @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  educationField?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional() @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  monthlyIncome?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isBeneficiary?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  customFields?: Record<string, unknown>;
}

export class CreateInsuranceDto {
  @ApiProperty()
  @IsString()
  insuranceType!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  policyNumber?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  coverageStart?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  coverageEnd?: string;
}

export class CreateAgencyDto {
  @ApiProperty()
  @IsString() @MaxLength(100)
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  agencyType?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  contactEmail?: string;
}

export class UpsertFormDefinitionDto {
  @ApiProperty({ enum: CaseEntityType })
  @IsNotEmpty({ message: 'نوع موجودیت الزامی است' })
  @IsIn(Object.values(CaseEntityType), { message: 'نوع موجودیت نامعتبر است' })
  entityType!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'نام فرم الزامی است' })
  @IsString() @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsObject({ message: 'ساختار فرم الزامی است' })
  schema!: Record<string, unknown>;
}
