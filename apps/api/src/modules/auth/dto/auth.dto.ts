import {
  IsEmail, IsString, MinLength, IsOptional, MaxLength, IsBoolean, ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

function pickIdentifier({ value, obj }: { value?: string; obj: Record<string, unknown> }) {
  const raw = value ?? obj.email ?? obj.username;
  return typeof raw === 'string' ? raw.trim() : raw;
}

export class LoginDto {
  @ApiProperty({
    example: 'admin@city.local',
    description: 'ایمیل یا نام کاربری',
  })
  @Transform(pickIdentifier)
  @IsString({ message: 'ایمیل یا نام کاربری الزامی است' })
  @MinLength(2, { message: 'ایمیل یا نام کاربری نامعتبر است' })
  @MaxLength(320)
  identifier!: string;

  /** @deprecated alias — still accepted from older clients */
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'ایمیل نامعتبر است' })
  @ValidateIf((o) => !o.identifier && !!o.email)
  email?: string;

  @ApiProperty({ example: 'Admin@1234' })
  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد' })
  password!: string;

  @ApiPropertyOptional({ description: 'نشست مرورگر با کوکی HttpOnly؛ توکن در بدنه برنمی‌گردد' })
  @IsOptional()
  @IsBoolean()
  cookieSession?: boolean;
}

export class ResendLoginOtpDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  challengeId!: string;
}

export class VerifyLoginOtpDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cookieSession?: boolean;
}

export class RefreshTokenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class AuthTokensResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: string;
  tokenType!: string;
}

export class LoginOtpRequiredDto {
  requiresOtp!: true;
  challengeId!: string;
  maskedPhone!: string;
  expiresInSec!: number;
  resendAfterSec!: number;
  /** Only present in non-production (development) builds */
  devCode?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'سمت سازمانی' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'واحد / حوزه کاری' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  department?: string;

  @ApiPropertyOptional({ description: 'درباره کاربر' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ description: 'آواتار به صورت data URL (image/*)' })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'ایمیل یا نام کاربری' })
  @Transform(pickIdentifier)
  @IsString()
  @MinLength(2)
  @MaxLength(320)
  identifier!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class UserProfileDto {
  id!: string;
  email!: string;
  username?: string;
  firstName!: string;
  lastName!: string;
  phone?: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  organizationId?: string;
  roles!: string[];
  permissions!: string[];
}
