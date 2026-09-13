import {
  IsOptional, IsArray, IsString, IsNumber, IsDateString, IsBoolean, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsFilterDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  neighborhoodIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  householdStatuses?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  ownershipTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  educationLevels?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  employmentStatuses?: string[];

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  incomeMin?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  incomeMax?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  memberRole?: string;
}

export class KpiConfigItemDto {
  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsString()
  metric!: string;

  @IsBoolean()
  enabled!: boolean;

  @Type(() => Number) @IsNumber()
  sortOrder!: number;
}

export class SaveKpiConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiConfigItemDto)
  items!: KpiConfigItemDto[];
}

export class ExportAnalyticsDto {
  @ValidateNested()
  @Type(() => AnalyticsFilterDto)
  @IsOptional()
  filters?: AnalyticsFilterDto;

  @ApiPropertyOptional({ enum: ['overview', 'distributions', 'timeseries', 'full'] })
  @IsOptional() @IsString()
  scope?: 'overview' | 'distributions' | 'timeseries' | 'full';

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  title?: string;
}
