import {
  IsString, IsOptional, IsEmail, IsBoolean, IsArray, IsUUID, MinLength, MaxLength, IsObject, IsIn,
  registerDecorator, ValidationOptions, ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { validateIranMobile, validateUserPassword } from '@city-manager/shared';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndef({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function IsUserPassword(required: boolean, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isUserPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return validateUserPassword(value, required) === undefined;
        },
        defaultMessage(args: ValidationArguments) {
          return validateUserPassword(args.value, required) ?? 'رمز عبور نامعتبر است';
        },
      },
    });
  };
}

function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isPhoneNumber',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return validateIranMobile(value, false) === undefined;
        },
        defaultMessage(args: ValidationArguments) {
          return validateIranMobile(args.value, false) ?? 'شماره موبایل نامعتبر است';
        },
      },
    });
  };
}

export class CreateUserDto {
  @ApiProperty()
  @Transform(trimString)
  @IsEmail({}, { message: 'ایمیل نامعتبر است' })
  email!: string;

  @ApiPropertyOptional({ description: 'نام کاربری برای ورود (لاتین)' })
  @Transform(emptyToUndef)
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'نام کاربری باید حداقل ۳ کاراکتر باشد' })
  @MaxLength(50)
  username?: string;

  @ApiProperty()
  @IsString({ message: 'رمز عبور الزامی است' })
  @IsUserPassword(true)
  password!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString() @MinLength(1, { message: 'نام الزامی است' }) @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString() @MinLength(1, { message: 'نام خانوادگی الزامی است' }) @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndef)
  @IsOptional() @IsString() @MaxLength(32) @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  roleIds?: string[];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional() @IsString() @MinLength(1, { message: 'نام الزامی است' }) @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional() @IsString() @MinLength(1, { message: 'نام خانوادگی الزامی است' }) @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'نام کاربری برای ورود (لاتین)' })
  @Transform(emptyToUndef)
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'نام کاربری باید حداقل ۳ کاراکتر باشد' })
  @MaxLength(50)
  username?: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndef)
  @IsOptional() @IsString() @MaxLength(32) @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'دلیل غیرفعال‌سازی — هنگام isActive=false الزامی' })
  @Transform(emptyToUndef)
  @IsOptional() @IsString() @MaxLength(500)
  inactiveReason?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  roleIds?: string[];

  @ApiPropertyOptional()
  @Transform(emptyToUndef)
  @IsOptional() @IsUserPassword(false)
  password?: string;

  @ApiPropertyOptional({ description: 'اجبار تغییر رمز در ورود بعدی' })
  @IsOptional() @IsBoolean()
  mustChangePassword?: boolean;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  permissions?: string[];
}

export class CreateRoleDto {
  @ApiProperty({ example: 'district_facilitator' })
  @IsString() @MinLength(2) @MaxLength(50)
  code!: string;

  @ApiProperty()
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  permissions?: string[];
}

export class UpsertSettingDto {
  @ApiProperty()
  @IsString() @MaxLength(100)
  key!: string;

  @ApiProperty()
  @IsObject()
  value!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;
}

export class TestMessagingDto {
  @ApiProperty({ enum: ['sms', 'email'] })
  @IsIn(['sms', 'email'])
  channel!: 'sms' | 'email';
}

export class CreateReportScheduleDto {
  @ApiProperty()
  @IsString() @MaxLength(100)
  reportCode!: string;

  @ApiProperty()
  @IsString() @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  frequency?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsEmail({}, { each: true })
  recipients?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isEnabled?: boolean;
}

export class DeleteUserDto {
  @ApiProperty({ description: 'دلیل حذف حساب کاربر' })
  @Transform(trimString)
  @IsString() @MinLength(3, { message: 'ذکر دلیل الزامی است (حداقل ۳ کاراکتر)' }) @MaxLength(500)
  inactiveReason!: string;
}
