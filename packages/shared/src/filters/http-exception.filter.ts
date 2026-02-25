import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const { status, message } = this.buildResponse(exception);

    const payload = {
      statusCode: status,
      message,
      path: request?.url,
      method: request?.method,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof HttpException) {
      this.logger.warn(`${request?.method} ${request?.url} -> ${status}: ${message}`);
    } else {
      this.logger.error(`${request?.method} ${request?.url} -> ${status}: ${message}`, (exception as Error)?.stack);
    }

    response?.status?.(status).json(payload);
  }

  private buildResponse(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message = this.normalizeMessage(response, exception.message);
      return { status, message };
    }

    const fallback = 'Internal server error';
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: fallback };
  }

  private normalizeMessage(response: unknown, fallback: string): string {
    if (!response) return fallback;

    if (typeof response === 'string') return response;

    const message = (response as any).message ?? fallback;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return message;
  }
}
