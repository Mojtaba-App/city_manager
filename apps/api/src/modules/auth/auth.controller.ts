import { Controller, Post, Get, Patch, Body, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AUTH_COOKIE_REFRESH, parseCookieHeader } from '@city-manager/shared';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, UpdateProfileDto, VerifyLoginOtpDto, ResendLoginOtpDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, AuthTokensResponseDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload, ApiResponse } from '@city-manager/shared';
import { applyAuthCookies, applyAccessCookie, clearAuthCookies } from './session-cookies';

function isOtpRequired(data: unknown): data is { requiresOtp: true } {
  return Boolean(data && typeof data === 'object' && (data as { requiresOtp?: boolean }).requiresOtp === true);
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ورود به سیستم (ایمیل یا نام کاربری)' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
    if (isOtpRequired(data)) {
      return { success: true, data };
    }
    return this.finishLogin(res, data as AuthTokensResponseDto, dto.cookieSession);
  }

  @Public()
  @Post('login/verify-otp')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تأیید کد پیامکی ورود' })
  async verifyLoginOtp(
    @Body() dto: VerifyLoginOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.authService.verifyLoginOtp(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
    return this.finishLogin(res, data, dto.cookieSession);
  }

  @Public()
  @Post('login/resend-otp')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ارسال مجدد کد تأیید ورود' })
  async resendLoginOtp(
    @Body() dto: ResendLoginOtpDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.authService.resendLoginOtp(dto);
    return { success: true, data };
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تمدید توکن' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<unknown>> {
    const cookies = parseCookieHeader(req.headers.cookie);
    const refreshToken = dto.refreshToken || cookies[AUTH_COOKIE_REFRESH];
    const data = await this.authService.refresh(refreshToken ?? '');
    applyAuthCookies(res, this.config, data);
    if (!dto.refreshToken && cookies[AUTH_COOKIE_REFRESH]) {
      return {
        success: true,
        data: { expiresIn: data.expiresIn, tokenType: data.tokenType, session: 'cookie' },
      };
    }
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'خروج از سیستم' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    const cookies = parseCookieHeader(req.headers.cookie);
    const refreshToken = dto.refreshToken || cookies[AUTH_COOKIE_REFRESH];
    if (refreshToken) {
      await this.authService.logout(refreshToken, user.sub);
    }
    clearAuthCookies(res, this.config);
    return { success: true };
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'بازیابی رمز عبور با پیامک به شماره همراه' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ApiResponse<{ message: string; devPassword?: string }>> {
    const data = await this.authService.forgotPassword(dto);
    return {
      success: true,
      data: {
        message: data.message,
        ...(data.devPassword ? { devPassword: data.devPassword } : {}),
      },
    };
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تنظیم رمز جدید با توکن بازیابی' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<ApiResponse<null>> {
    await this.authService.resetPassword(dto);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تغییر رمز عبور کاربر جاری' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponse<null>> {
    await this.authService.changePassword(user.sub, dto);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'پروفایل کاربر جاری' })
  async me(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.authService.getProfile(user.sub);
    const accessToken = await this.authService.issueAccessToken(user.sub);
    applyAccessCookie(res, this.config, accessToken);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ویرایش پروفایل کاربر جاری' })
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.authService.updateProfile(user.sub, dto);
    return { success: true, data };
  }

  private finishLogin(
    res: Response,
    data: AuthTokensResponseDto,
    cookieSession?: boolean,
  ): ApiResponse<unknown> {
    applyAuthCookies(res, this.config, data);
    if (cookieSession) {
      return {
        success: true,
        data: {
          expiresIn: data.expiresIn,
          tokenType: data.tokenType,
          session: 'cookie',
        },
      };
    }
    return { success: true, data };
  }
}
