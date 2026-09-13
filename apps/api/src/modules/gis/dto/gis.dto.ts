import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsEnum,
  IsUUID,
  IsObject,
  Matches,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IngestTargetType, NeighborhoodStatus, UrbanLayerCategory } from '@city-manager/shared';

/** Lowercase #rrggbb; accept picker output like #FF0000 even if Transform runs after Matches. */
function toCssHex(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return value;
}

const HEX6 = /^#?[0-9a-fA-F]{6}$/;

export class CreateFabricTypeDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ default: '#1a5276' })
  @IsOptional()
  @Transform(({ value }) => toCssHex(value))
  @Matches(HEX6)
  colorHex?: string;

  @ApiPropertyOptional({ default: 0.35 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  fillOpacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateFabricTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toCssHex(value))
  @Matches(HEX6)
  colorHex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  fillOpacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateNeighborhoodDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: NeighborhoodStatus })
  @IsOptional()
  @IsEnum(NeighborhoodStatus)
  status?: NeighborhoodStatus;

  @ApiPropertyOptional({ description: 'منطقه شهرداری ۱ تا ۸' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  municipalDistrict?: number;

  @ApiPropertyOptional({ description: 'جمعیت محله' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  population?: number;

  @ApiPropertyOptional({ description: 'تعداد خانوار ثبت‌شده محله' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  householdCount?: number;

  @ApiPropertyOptional({ description: 'میانگین درآمد ماهانه (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  avgIncome?: number;

  @ApiPropertyOptional({ description: 'سطح سواد (۰ تا ۱۰۰ درصد)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  literacyRate?: number;

  @ApiPropertyOptional({ description: 'مساحت (متر مربع)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSqm?: number;

  @ApiPropertyOptional({ description: 'GeoJSON geometry (Polygon or MultiPolygon) — optional; can be set later on map' })
  @IsOptional()
  @IsObject()
  geometry?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priorityRank?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateNeighborhoodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: NeighborhoodStatus })
  @IsOptional()
  @IsEnum(NeighborhoodStatus)
  status?: NeighborhoodStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  municipalDistrict?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  population?: number;

  @ApiPropertyOptional({ description: 'تعداد خانوار ثبت‌شده محله' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  householdCount?: number;

  @ApiPropertyOptional({ description: 'میانگین درآمد ماهانه (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  avgIncome?: number;

  @ApiPropertyOptional({ description: 'سطح سواد (۰ تا ۱۰۰ درصد)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  literacyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSqm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priorityRank?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateGeometryDto {
  @ApiProperty({ description: 'GeoJSON geometry object' })
  @IsObject()
  geometry!: Record<string, unknown>;
}

export class CreateFabricDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  neighborhoodId?: string;

  @ApiProperty()
  @IsUUID()
  fabricTypeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'GeoJSON geometry — optional; can be set later on map' })
  @IsOptional()
  @IsObject()
  geometry?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateFabricDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fabricTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateDwellingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  neighborhoodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dwellingCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullAddress?: string;

  @ApiPropertyOptional({ description: 'GeoJSON Point geometry — optional; can be set later on map' })
  @IsOptional()
  @IsObject()
  geometry?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buildingType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class IngestFileQueryDto {
  @ApiProperty({ enum: IngestTargetType })
  @IsEnum(IngestTargetType)
  targetType!: IngestTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fabricTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  neighborhoodId?: string;

  @ApiPropertyOptional({ description: 'Existing urban layer id (when targetType=layer)' })
  @IsOptional()
  @IsUUID()
  layerId?: string;

  @ApiPropertyOptional({ description: 'New layer code if layerId omitted' })
  @IsOptional()
  @IsString()
  layerCode?: string;

  @ApiPropertyOptional({ description: 'New layer name if layerId omitted' })
  @IsOptional()
  @IsString()
  layerName?: string;

  @ApiPropertyOptional({ enum: UrbanLayerCategory })
  @IsOptional()
  @IsEnum(UrbanLayerCategory)
  category?: UrbanLayerCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toCssHex(value))
  @Matches(HEX6)
  colorHex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultName?: string;
}

export class CreateUrbanLayerDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: UrbanLayerCategory })
  @IsOptional()
  @IsEnum(UrbanLayerCategory)
  category?: UrbanLayerCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toCssHex(value))
  @Matches(HEX6)
  colorHex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  fillOpacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toCssHex(value))
  @Matches(HEX6)
  strokeHex?: string;

  @ApiPropertyOptional({ default: 2.5, description: 'Outline width in pixels' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(8)
  strokeWidth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateUrbanLayerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: UrbanLayerCategory })
  @IsOptional()
  @IsEnum(UrbanLayerCategory)
  category?: UrbanLayerCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toCssHex(value))
  @Matches(HEX6)
  colorHex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  fillOpacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toCssHex(value))
  @Matches(HEX6)
  strokeHex?: string;

  @ApiPropertyOptional({ default: 2.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(8)
  strokeWidth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SpatialSearchQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ default: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radiusMeters?: number;
}

export class BboxQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  minLng!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  minLat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  maxLng!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  maxLat!: number;
}

export class GeoJsonLayersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  neighborhoodIds?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fabricTypeIds?: string;

  @ApiPropertyOptional({ description: 'comma-separated: neighborhoods,fabrics,dwellings,urban' })
  @IsOptional()
  @IsString()
  layers?: string;

  @ApiPropertyOptional({ description: 'comma-separated urban layer UUIDs to include' })
  @IsOptional()
  @IsString()
  urbanLayerIds?: string;

  /** Viewport: minLng,minLat,maxLng,maxLat — lazy/light map feed */
  @ApiPropertyOptional({ description: 'comma-separated bbox: minLng,minLat,maxLng,maxLat' })
  @IsOptional()
  @IsString()
  bbox?: string;

  @ApiPropertyOptional({ description: 'map zoom for simplify/limit scaling' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  zoom?: number;

  @ApiPropertyOptional({ description: 'max features to return (hard cap applied server-side)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: 'feature offset for pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;
}

export class CreateAreaProjectDto {
  @ApiProperty({ enum: ['neighborhood', 'fabric'] })
  @IsString()
  targetType!: 'neighborhood' | 'fabric';

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: ['executive', 'study'], default: 'executive' })
  @IsOptional()
  @IsString()
  projectKind?: 'executive' | 'study';

  @ApiPropertyOptional({ enum: ['consultant', 'contractor'] })
  @IsOptional()
  @IsString()
  partyRole?: 'consultant' | 'contractor';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ default: 'IRR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  progressPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budgetSpent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  householdsAffected?: number;
}

export class UpdateAreaProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectKind?: 'executive' | 'study';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partyRole?: 'consultant' | 'contractor';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  progressPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budgetSpent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  householdsAffected?: number;
}

export class CreateRegenerationProgramDto {
  @ApiProperty()
  @IsString() @MaxLength(100)
  code!: string;

  @ApiProperty()
  @IsString() @MaxLength(300)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  budgetTotal?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateRegenerationProgramDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  budgetTotal?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
