import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventNotificationService } from './notification.service';
import { AlertGateway } from './alert.gateway';
import { WsAuthService } from './auth/ws-auth.service';
import { parseLogLevels } from './logging/logging.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.register({}),
  ],
  providers: [EventNotificationService, AlertGateway, WsAuthService],
})
class NotificationModule {}

async function bootstrap() {
  const app = await NestFactory.create(NotificationModule, {
    logger: parseLogLevels(process.env.LOG_LEVEL),
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
  });

  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  const logger = new Logger('NotificationBootstrap');
  logger.log(`WebSocket server listening on port ${port}`);
  logger.log('Service started and listening to Kafka...');
}

bootstrap();
