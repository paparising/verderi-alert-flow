import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertService } from './alert.service';
import { AlertController } from './alert.controller';
import { AlertGateway } from './alert.gateway';
import { Alert, AlertEvent } from '@vederi/shared';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, AlertEvent]),
    KafkaModule,
  ],
  providers: [AlertService, AlertGateway],
  controllers: [AlertController],
  exports: [AlertService, AlertGateway],
})
export class AlertModule {}
