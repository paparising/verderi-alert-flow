import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/organizations (POST) & /organizations (GET)', async () => {
    const orgData = { name: 'Acme', address: '123 Road', contact: 'info@acme.com' };
    const createResp = await request(app.getHttpServer())
      .post('/organizations')
      .send(orgData)
      .expect(201);

    expect(createResp.body).toMatchObject(orgData);

    const listResp = await request(app.getHttpServer())
      .get('/organizations')
      .expect(200);

    expect(Array.isArray(listResp.body)).toBe(true);
    expect(listResp.body[0]).toHaveProperty('name', 'Acme');
  });

  it('/users (POST) & /users (GET)', async () => {
    // create an organization first
    const orgData = { name: 'Org2', address: '456 Ave', contact: 'contact@org2.com' };
    const orgResp = await request(app.getHttpServer())
      .post('/organizations')
      .send(orgData)
      .expect(201);
    const orgId = orgResp.body.id;

    const userData = {
      name: 'John Doe',
      address: '789 Blvd',
      email: 'john@example.com',
      phone: '555-1234',
      organizationId: orgId,
    };
    const userResp = await request(app.getHttpServer())
      .post('/users')
      .send(userData)
      .expect(201);

    expect(userResp.body).toMatchObject({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-1234',
    });
    expect(userResp.body.organization.id).toEqual(orgId);

    const listUserResp = await request(app.getHttpServer())
      .get('/users')
      .expect(200);
    expect(Array.isArray(listUserResp.body)).toBe(true);
    expect(listUserResp.body[0]).toHaveProperty('email', 'john@example.com');
  });
});
