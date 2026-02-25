import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headerUser = (request.headers['x-superuser'] as string | undefined)?.trim();
    const headerKey = (request.headers['x-api-key'] as string | undefined)?.trim();

    const expectedUser = this.config.get<string>('SUPERADMIN_USER');
    const expectedKey = this.config.get<string>('SUPERADMIN_API_KEY');

    if (!expectedUser || !expectedKey) {
      throw new ForbiddenException('Superadmin credentials not configured');
    }

    if (headerUser !== expectedUser || headerKey !== expectedKey) {
      throw new ForbiddenException('Invalid superadmin credentials');
    }

    return true;
  }
}
