import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventNotificationService } from './notification.service';
import { AlertGateway } from './alert.gateway';

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
    logger: ['log', 'error', 'warn'],
  });
  await app.init();
  console.log('[Notification Microservice] Service started and listening to Kafka...');
}

bootstrap();
