import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertService } from './alert.service';
import { AlertController } from './alert.controller';
import { AlertGateway } from './alert.gateway';
import { Alert } from './entities/alert.entity';
import { AlertEvent } from './entities/alert-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, AlertEvent])],
  providers: [AlertService, AlertGateway],
  controllers: [AlertController],
  exports: [AlertService],
})
export class AlertModule {}
