import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/auth/sms/send (POST)', () => {
    it('应该发送验证码成功', () => {
      return request(app.getHttpServer())
        .post('/api/auth/sms/send')
        .send({
          phone: '13800138000',
          type: 'register',
        })
        .expect(201);
    });

    it('应该返回手机号格式错误', () => {
      return request(app.getHttpServer())
        .post('/api/auth/sms/send')
        .send({
          phone: '123',
          type: 'register',
        })
        .expect(400);
    });
  });

  describe('/api/auth/register (POST)', () => {
    it('应该返回验证码错误', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          phone: '13800138000',
          code: '123456',
          password: 'password123',
        })
        .expect(400);
    });
  });

  describe('/api/auth/login/password (POST)', () => {
    it('应该返回用户不存在', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login/password')
        .send({
          phone: '13800138000',
          password: 'password123',
        })
        .expect(401);
    });
  });
});

describe('Livestock (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/livestock/types (GET)', () => {
    it('应该返回活体类型列表', () => {
      return request(app.getHttpServer())
        .get('/api/livestock/types')
        .expect(200);
    });
  });

  describe('/api/livestock (GET)', () => {
    it('应该返回活体列表', () => {
      return request(app.getHttpServer())
        .get('/api/livestock')
        .expect(200);
    });

    it('应该支持分页参数', () => {
      return request(app.getHttpServer())
        .get('/api/livestock?page=1&pageSize=10')
        .expect(200);
    });
  });
});
