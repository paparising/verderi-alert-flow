import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertEvent, Organization, User, Alert, ProcessedEvent } from '@vederi/shared';
import { EventPersistenceService } from './persistence.service';

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
      database: process.env.DB_NAME || 'vederi',
      entities: [Organization, User, Alert, AlertEvent, ProcessedEvent],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([AlertEvent, ProcessedEvent]),
  ],
  providers: [EventPersistenceService],
})
class PersistenceModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(PersistenceModule, {
    logger: ['log', 'error', 'warn'],
  });
  await app.init();
  console.log('[Persistence Microservice] Service started and listening to Kafka...');
}

bootstrap();
