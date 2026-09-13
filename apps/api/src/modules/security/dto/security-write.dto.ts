import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAbacPolicyDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['allow', 'deny'] })
  @IsOptional() @IsIn(['allow', 'deny'])
  effect?: 'allow' | 'deny';

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  resourceType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  actions?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  condition?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class WebhookPayloadDto {
  // Dynamic webhook payloads — allow any JSON object while still going through ValidationPipe.
  [key: string]: unknown;
}
