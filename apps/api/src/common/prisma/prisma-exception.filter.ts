import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Maps Prisma's "not found" exceptions to a proper HTTP 404 instead of an
 * uncaught 500. Found via live verification: cross-tenant findUnique/update/
 * delete/upsert attempts are correctly BLOCKED by the tenant-scoping Prisma
 * extension (a real security property, confirmed working), but the resulting
 * `Prisma.NotFoundError` (thrown internally by findUniqueOrThrow when the
 * extension returns null) and the extension's own P2025
 * `PrismaClientKnownRequestError` (thrown by the update/delete/upsert
 * ownership pre-check) were both uncaught by NestJS, surfacing as generic 500s
 * — correct security behavior with incorrect, unprofessional HTTP semantics.
 */
@Catch(Prisma.NotFoundError, Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.NotFoundError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const isNotFound = exception instanceof Prisma.NotFoundError || (exception as Prisma.PrismaClientKnownRequestError).code === 'P2025';
    if (isNotFound) {
      response.status(HttpStatus.NOT_FOUND).json({ statusCode: 404, message: 'Resource not found', error: 'Not Found' });
      return;
    }
    // Any other Prisma error reaching here is unexpected — log it server-side
    // (never in the response body) so a real defect doesn't disappear as a
    // silent, unexplained 500.
    this.logger.error(exception.message, exception.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
  }
}
