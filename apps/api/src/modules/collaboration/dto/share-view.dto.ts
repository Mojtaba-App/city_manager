import {
  IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShareViewDto {
  @ApiProperty({ enum: ['report', 'map', 'hybrid'] })
  @IsString()
  @IsIn(['report', 'map', 'hybrid'])
  kind!: string;

  @ApiProperty()
  @IsString() @MinLength(2) @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  recipientLabel?: string;

  @ApiPropertyOptional({ description: 'Days until expiry (1–90). Default 7.' })
  @IsOptional() @IsInt() @Min(1) @Max(90)
  expiresInDays?: number;

  @ApiProperty({ description: 'Frozen read-only snapshot payload' })
  @IsObject()
  snapshot!: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  reportSections?: string[];
}
