import {
  IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsString() @MaxLength(50)
  type!: string;

  @ApiProperty()
  @IsString() @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  body?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  link?: string;
}

export class CreateConsentDto {
  @ApiProperty()
  @IsUUID()
  householdId!: string;

  @ApiProperty()
  @IsString() @MaxLength(50)
  purpose!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  scopeFields?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  grantedByName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  grantNow?: boolean;
}

export class GrantConsentDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  grantedByName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  evidenceDocumentId?: string;
}

export class CreateReferralDto {
  @ApiProperty()
  @IsUUID()
  householdId!: string;

  @ApiPropertyOptional({ description: 'partner_agency | municipal_district' })
  @IsOptional() @IsString() @MaxLength(40)
  destinationKind?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Municipal district 1–8 when destination is municipal_district' })
  @IsOptional() @IsNumber() @Min(1) @Max(8)
  municipalDistrict?: number;

  @ApiProperty()
  @IsString() @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  scopeFields?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  consentId?: string;

  /** Create+grant a consent covering selected scopes when consentId is omitted */
  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  createConsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  grantedByName?: string;
}

export class AttachReferralConsentDto {
  @ApiProperty()
  @IsUUID()
  consentId!: string;
}

export class UpdateReferralStatusDto {
  @ApiProperty()
  @IsString() @MaxLength(30)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  responseNotes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  externalReference?: string;
}

export class CreatePortalInviteDto {
  @ApiProperty()
  @IsUUID()
  householdId!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  recipientName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(20)
  recipientPhone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() @Min(1) @Max(90)
  expiresInDays?: number;
}

export class PortalRedeemDto {
  @ApiProperty()
  @IsString() @MaxLength(64)
  inviteCode!: string;
}

export class PortalUploadMetaDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  category?: string;
}

export class FieldCompleteDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  photoDocumentIds?: string[];
}

export class FieldSearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  plaque?: string;
}
