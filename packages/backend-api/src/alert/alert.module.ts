import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AlertService } from './alert.service';
import { AlertEventProcessorService } from './alert-event-processor.service';
import { AlertController } from './alert.controller';
import { Alert, AlertEvent, ProcessedEvent } from '@videri/shared';
import { KafkaModule } from '../kafka/kafka.module';
import { AlertRetryInterceptor, CircuitBreakerService } from '../interceptors';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, AlertEvent, ProcessedEvent]),
    KafkaModule,
  ],
  providers: [
    AlertService,
    AlertEventProcessorService,
    CircuitBreakerService,
    {
      // Enhanced retry strategy specifically for alert operations
      provide: APP_INTERCEPTOR,
      useClass: AlertRetryInterceptor,
    },
  ],
  controllers: [AlertController],
  exports: [AlertService, AlertEventProcessorService],
})
export class AlertModule {}
