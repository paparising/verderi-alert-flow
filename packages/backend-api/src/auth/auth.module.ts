import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-me-in-env'),
        signOptions: {
          expiresIn: config.get<StringValue>('JWT_EXPIRES_IN', '1h'),
          issuer: config.get<string>('JWT_ISSUER', 'videri-alert-flow'),
          audience: config.get<string>('JWT_AUDIENCE', 'videri-alert-flow-clients'),
        },
      }),
    }),
  ],
  providers: [JwtStrategy, AuthService],
  controllers: [AuthController],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
