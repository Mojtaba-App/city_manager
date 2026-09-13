import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '@city-manager/shared';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'خطای داخلی سرور';
    let retryAfterSec: number | undefined;
    let contactAdmin: boolean | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'object' && exResponse !== null) {
        const obj = exResponse as Record<string, unknown>;
        const rawMsg = obj.message;
        message = Array.isArray(rawMsg)
          ? rawMsg.map(String).join(', ')
          : typeof rawMsg === 'string'
            ? rawMsg
            : exception.message;
        code = typeof obj.code === 'string'
          ? obj.code
          : typeof obj.error === 'string'
            ? obj.error
            : 'HTTP_ERROR';
        if (typeof obj.retryAfterSec === 'number' && Number.isFinite(obj.retryAfterSec)) {
          retryAfterSec = Math.max(0, Math.floor(obj.retryAfterSec));
        }
        if (typeof obj.contactAdmin === 'boolean') contactAdmin = obj.contactAdmin;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    const text = Array.isArray(message) ? message.join(', ') : message;
    const tooMany =
      status === HttpStatus.TOO_MANY_REQUESTS || /too many requests/i.test(text);
    const body: ApiResponse<null> = {
      success: false,
      error: {
        code: tooMany ? 'TOO_MANY_REQUESTS' : code,
        message: tooMany
          ? 'تعداد درخواست‌ها زیاد است. چند ثانیه صبر کنید و دوباره امتحان کنید.'
          : text,
        ...(retryAfterSec != null ? { retryAfterSec } : {}),
        ...(contactAdmin != null ? { contactAdmin } : {}),
      },
    };

    response.status(status).json(body);
  }
}
