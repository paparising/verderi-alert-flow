import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  orgId: string;
  email?: string;
  roles?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'change-me-in-env'),
      issuer: configService.get<string>('JWT_ISSUER', 'videri-alert-flow'),
      audience: configService.get<string>('JWT_AUDIENCE', 'videri-alert-flow-clients'),
    });
  }

  validate(payload: JwtPayload) {
    if (!payload || !payload.sub || !payload.orgId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      orgId: payload.orgId,
      email: payload.email,
      roles: payload.roles ?? [],
    };
  }
}
