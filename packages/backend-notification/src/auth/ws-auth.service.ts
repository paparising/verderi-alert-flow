import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

export interface WsJwtPayload {
  sub: string;
  orgId: string;
  email?: string;
  roles?: string[];
}

export interface WsUser {
  userId: string;
  orgId: string;
  email?: string;
  roles: string[];
}

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async authenticateClient(client: Socket): Promise<WsUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException('Missing auth token');
    }

    const payload = await this.jwt.verifyAsync<WsJwtPayload>(token, {
      secret: this.config.get<string>('JWT_SECRET', 'change-me-in-env'),
      issuer: this.config.get<string>('JWT_ISSUER', 'videri-alert-flow'),
      audience: this.config.get<string>('JWT_AUDIENCE', 'videri-alert-flow-clients'),
    });

    if (!payload?.sub || !payload?.orgId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      orgId: payload.orgId,
      email: payload.email,
      roles: payload.roles ?? [],
    };
  }

  private extractToken(client: Socket): string | undefined {
    const fromAuth = client.handshake?.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.trim().length > 0) {
      return fromAuth.startsWith('Bearer ') ? fromAuth.slice(7) : fromAuth;
    }

    const authHeader = client.handshake?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return undefined;
  }
}
