import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';
import { AlertModule } from './alert/alert.module';
import { RedisModule } from './redis/redis.module';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimitHeadersInterceptor, CircuitBreakerService, RetryInterceptor } from './interceptors';
import { Organization, User, Alert, AlertEvent, ProcessedEvent } from '@videri/shared';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './guards';
import { HttpExceptionFilter } from '@videri/shared';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'password',
      database: process.env.DB_NAME || 'videri',
      entities: [Organization, User, Alert, AlertEvent, ProcessedEvent],
      synchronize: true,
    }),
    RedisModule,
    OrganizationModule,
    UserModule,
    AlertModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CircuitBreakerService,
    {
      // Auth guard runs before rate limiting so orgId is available from JWT
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      // Retry interceptor with circuit breaker - applied for all requests
      provide: APP_INTERCEPTOR,
      useClass: RetryInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitHeadersInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
