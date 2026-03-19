import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertEvent, Organization, User, Alert, ProcessedEvent } from '@videri/shared';
import { EventPersistenceService } from './persistence.service';
import { parseLogLevels } from '@videri/shared';

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
      synchronize: process.env.DB_SYNCHRONIZE ? process.env.DB_SYNCHRONIZE === 'true' : true,
    }),
    TypeOrmModule.forFeature([AlertEvent, ProcessedEvent]),
  ],
  providers: [EventPersistenceService],
})
class PersistenceModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(PersistenceModule, {
    logger: parseLogLevels(process.env.LOG_LEVEL),
  });
  await app.init();
  const logger = new Logger('PersistenceBootstrap');
  logger.log('Service started and listening to Kafka...');
}

bootstrap();
