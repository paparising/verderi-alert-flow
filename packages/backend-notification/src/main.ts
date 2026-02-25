import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventNotificationService } from './notification.service';
import { AlertGateway } from './alert.gateway';
import { parseLogLevels } from '@vederi/shared';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [EventNotificationService, AlertGateway],
})
class NotificationModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(NotificationModule, {
    logger: parseLogLevels(process.env.LOG_LEVEL),
  });
  await app.init();
  const logger = new Logger('NotificationBootstrap');
  logger.log('Service started and listening to Kafka...');
}

bootstrap();
