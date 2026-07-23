import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Response } from 'express';

/**
 * Catch-all safety net. HttpExceptions pass through with their EXACT existing
 * status + body (zero behavior change for every current 4xx/known error).
 * Anything else — a genuine unexpected server error — returns a generic 500
 * carrying a correlationId, and the full error + stack is logged server-side
 * under that same id. Users get a support reference; stack traces, secrets
 * and database details never leave the process.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      response.status(exception.getStatus()).json(typeof body === 'string' ? { statusCode: exception.getStatus(), message: body } : body);
      return;
    }

    const correlationId = `err_${randomBytes(6).toString('hex')}`;
    const err = exception as Error;
    this.logger.error(`[${correlationId}] ${err?.message ?? String(exception)}`, err?.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Internal server error',
      correlationId,
    });
  }
}
