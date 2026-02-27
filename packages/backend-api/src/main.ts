import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { parseLogLevels } from '@videri/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: parseLogLevels(process.env.LOG_LEVEL),
  });
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  
  const port = process.env.PORT || 3000;

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`[API Service] Application is running on: http://localhost:${port}`);
}
bootstrap();
