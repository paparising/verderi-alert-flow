import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AlertService } from './alert.service';
import { AlertController } from './alert.controller';
import { Alert, AlertEvent } from '@vederi/shared';
import { KafkaModule } from '../kafka/kafka.module';
import { AlertRetryInterceptor, CircuitBreakerService } from '../interceptors';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, AlertEvent]),
    KafkaModule,
  ],
  providers: [
    AlertService,
    CircuitBreakerService,
    {
      // Enhanced retry strategy specifically for alert operations
      provide: APP_INTERCEPTOR,
      useClass: AlertRetryInterceptor,
    },
  ],
  controllers: [AlertController],
  exports: [AlertService],
})
export class AlertModule {}
