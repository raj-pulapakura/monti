import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError, type ApiErrorCode } from '../errors/app-error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      response.status(exception.statusCode).json({
        ok: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const details =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? exceptionResponse
          : undefined;
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exception.message;

      response.status(status).json({
        ok: false,
        error: {
          code: mapHttpStatusToErrorCode(status),
          message,
          details,
        },
      });
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const fallbackMessage =
      exception instanceof Error && !isProduction
        ? `Unexpected error: ${exception.message}`
        : 'An unexpected error occurred.';

    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Unhandled non-Error exception thrown', JSON.stringify(exception));
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: fallbackMessage,
      },
    });
  }
}

function mapHttpStatusToErrorCode(status: number): ApiErrorCode {
  if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
    return 'AUTHENTICATION_ERROR';
  }

  if (status >= 400 && status < 500) {
    return 'VALIDATION_ERROR';
  }

  return 'INTERNAL_ERROR';
}
