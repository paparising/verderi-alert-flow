import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

/**
 * E2E tests for App endpoints.
 * These tests use a minimal module to avoid requiring external dependencies (Kafka, DB).
 * For full integration tests, use docker-compose to start all dependencies first.
 */
describe('App Integration Tests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('GET /health should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('service', 'backend-api');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('Root', () => {
    it('GET / should return hello', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Vederi Alert Flow API Service');
    });
  });
});
