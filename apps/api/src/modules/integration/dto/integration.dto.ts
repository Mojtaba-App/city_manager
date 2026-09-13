import {
  IsString, IsOptional, IsEnum, IsBoolean, IsObject, IsArray, IsNumber, IsInt,
  MaxLength, Min, ValidateNested, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ConnectorType, SyncDirection, AuthType, IntegrationTargetEntity, DEFAULT_RETRY_POLICY,
} from '@city-manager/shared';

export class RetryPolicyDto {
  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(100)
  backoffMs?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  backoffMultiplier?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt()
  maxBackoffMs?: number;
}

export class ConnectionAuthDto {
  @ApiProperty({ enum: AuthType })
  @IsEnum(AuthType)
  type!: AuthType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  bearerToken?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  username?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  password?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  headerName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  headerValue?: string;
}

export class ConnectionEndpointsDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  health?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  list?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  getById?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  webhookPath?: string;
}

export class ConnectionProfileDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'CSV file URL for csv_file connectors' })
  @IsOptional() @IsString()
  csvUrl?: string;

  @ApiPropertyOptional({ description: 'Inline CSV text (dev/test) for csv_file connectors' })
  @IsOptional() @IsString()
  csvText?: string;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => ConnectionAuthDto)
  @IsOptional()
  auth?: ConnectionAuthDto;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => ConnectionEndpointsDto)
  @IsOptional()
  endpoints?: ConnectionEndpointsDto;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt()
  timeoutMs?: number;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  @IsOptional()
  retry?: RetryPolicyDto;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  webhookSecret?: string;
}

export class CreateConnectorDto {
  @ApiProperty()
  @IsString() @MaxLength(100)
  code!: string;

  @ApiProperty()
  @IsString() @MaxLength(300)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ enum: ConnectorType })
  @IsEnum(ConnectorType)
  connectorType!: ConnectorType;

  @ApiPropertyOptional({ enum: SyncDirection })
  @IsOptional() @IsEnum(SyncDirection)
  syncDirection?: SyncDirection;

  @ApiPropertyOptional({ enum: IntegrationTargetEntity })
  @IsOptional() @IsEnum(IntegrationTargetEntity)
  targetEntity?: IntegrationTargetEntity;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => ConnectionProfileDto)
  @IsOptional()
  profile?: ConnectionProfileDto;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  scheduleCron?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  scheduleIntervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateConnectorDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SyncDirection })
  @IsOptional() @IsEnum(SyncDirection)
  syncDirection?: SyncDirection;

  @ApiPropertyOptional({ enum: IntegrationTargetEntity })
  @IsOptional() @IsEnum(IntegrationTargetEntity)
  targetEntity?: IntegrationTargetEntity;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => ConnectionProfileDto)
  @IsOptional()
  profile?: ConnectionProfileDto;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  scheduleCron?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  scheduleIntervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class FieldMappingItemDto {
  @ApiProperty()
  @IsString()
  sourceField!: string;

  @ApiProperty()
  @IsString()
  targetField!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  transformRule?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt()
  sortOrder?: number;
}

export class UpsertMappingsDto {
  @ApiProperty({ type: [FieldMappingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingItemDto)
  mappings!: FieldMappingItemDto[];
}

export { DEFAULT_RETRY_POLICY };
