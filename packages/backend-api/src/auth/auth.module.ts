import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-me-in-env'),
        signOptions: {
          expiresIn: config.get<StringValue>('JWT_EXPIRES_IN', '1h'),
          issuer: config.get<string>('JWT_ISSUER', 'vederi-alert-flow'),
          audience: config.get<string>('JWT_AUDIENCE', 'vederi-alert-flow-clients'),
        },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
