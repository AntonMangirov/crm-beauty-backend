import request from 'supertest';
import app from '../app';
import { prisma } from './setup';
import jwt from 'jsonwebtoken';

interface TestUser {
  id: string;
  email: string;
}

describe('Protected Endpoints Security Tests', () => {
  let testUser: TestUser;
  let validToken: string;
  let expiredToken: string;
  let invalidToken: string;

  beforeAll(async () => {
    // Удаляем пользователя, если он существует (от предыдущих запусков)
    await prisma.user.deleteMany({
      where: {
        email: 'test-protected@example.com',
      },
    });

    // Создаем тестового пользователя
    testUser = await prisma.user.create({
      data: {
        email: 'test-protected@example.com',
        passwordHash: 'hashed-password',
        name: 'Test Protected User',
        slug: `test-protected-user-${Date.now()}`, // Уникальный slug
        isActive: true,
        role: 'MASTER',
      },
    });

    // Создаем валидный токен (15 минут)
    validToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );

    // Создаем истёкший токен (уже истёк)
    expiredToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET as string,
      { expiresIn: '-1h' } // Истёк час назад
    );

    // Создаем невалидный токен
    invalidToken = 'invalid.token.here';
  });

  afterAll(async () => {
    // Очищаем тестовые данные
    await prisma.user.deleteMany({
      where: {
        email: 'test-protected@example.com',
      },
    });
  });

  describe('Auth Endpoints', () => {
    describe('GET /api/auth/me', () => {
      it('should return 401 without token', async () => {
        const response = await request(app).get('/api/auth/me');

        // Проверяем статус и логируем ответ для отладки
        if (response.status !== 401) {
          console.log('Unexpected status:', response.status);
          console.log('Response body:', JSON.stringify(response.body, null, 2));
        }

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Authorization');
      });

      it('should return 401 with invalid token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 401 with expired token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 200 with valid token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', testUser.id);
        expect(response.body).toHaveProperty('email', testUser.email);
      });
    });
  });

  describe('Me Endpoints (/api/me/*)', () => {
    const meEndpoints = [
      { method: 'get', path: '/' },
      { method: 'get', path: '/appointments' },
      { method: 'get', path: '/clients' },
      { method: 'get', path: '/services' },
      { method: 'get', path: '/analytics' },
      { method: 'patch', path: '/profile' },
    ];

    meEndpoints.forEach(({ method, path }) => {
      it(`should protect ${method.toUpperCase()} /api/me${path} without token`, async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = request(app) as any;
        const response = await req[method](`/api/me${path}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      });

      it(`should protect ${method.toUpperCase()} /api/me${path} with invalid token`, async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = request(app) as any;

        const response = await req[method](`/api/me${path}`).set(
          'Authorization',
          `Bearer ${invalidToken}`
        );

        expect(response.status).toBe(401);
      });

      it(`should allow ${method.toUpperCase()} /api/me${path} with valid token`, async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = request(app) as any;

        const response = await req[method](`/api/me${path}`).set(
          'Authorization',
          `Bearer ${validToken}`
        );

        // Может быть 200 (успех) или 400/404 (валидация/данные не найдены)
        // Главное - не 401 (не авторизован)
        expect(response.status).not.toBe(401);
      });
    });
  });

  describe('Services Endpoints (/api/services/*)', () => {
    const servicesEndpoints = [
      { method: 'get', path: '/' },
      { method: 'post', path: '/' },
    ];

    servicesEndpoints.forEach(({ method, path }) => {
      it(`should protect ${method.toUpperCase()} /api/services${path} without token`, async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = request(app) as any;
        const response = await req[method](`/api/services${path}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      });

      it(`should protect ${method.toUpperCase()} /api/services${path} with invalid token`, async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = request(app) as any;

        const response = await req[method](`/api/services${path}`).set(
          'Authorization',
          `Bearer ${invalidToken}`
        );

        expect(response.status).toBe(401);
      });

      it(`should allow ${method.toUpperCase()} /api/services${path} with valid token`, async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = request(app) as any;

        const response = await req[method](`/api/services${path}`).set(
          'Authorization',
          `Bearer ${validToken}`
        );

        // Может быть 200/201 (успех) или 400 (валидация)
        // Главное - не 401 (не авторизован)
        expect(response.status).not.toBe(401);
      });
    });
  });

  describe('Users Endpoint (/api/users)', () => {
    it('should protect GET /api/users without token', async () => {
      const response = await request(app).get('/api/users').expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should protect GET /api/users with invalid token', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should allow GET /api/users with valid token', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Token Format Validation', () => {
    it('should reject requests without Authorization header', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body.error).toContain('Authorization header missing');
    });

    it('should reject requests with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.error).toContain('Authorization header missing');
    });

    it('should reject requests without Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', validToken)
        .expect(401);

      expect(response.body.error).toContain('Authorization header missing');
    });

    it('should accept requests with Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('Public Endpoints (should NOT require auth)', () => {
    it('should allow GET /api/public/:slug without token', async () => {
      // Удаляем пользователя, если он существует
      await prisma.user.deleteMany({
        where: {
          email: 'public-test@example.com',
        },
      });

      // Создаём мастера для публичного профиля
      const publicMaster = await prisma.user.create({
        data: {
          email: 'public-test@example.com',
          passwordHash: 'hash',
          name: 'Public Master',
          slug: `public-test-master-${Date.now()}`, // Уникальный slug
          isActive: true,
          role: 'MASTER',
        },
      });

      const response = await request(app).get(
        `/api/public/${publicMaster.slug}`
      );

      // Может быть 200 (успех) или 404/500 (данные не найдены/ошибка БД)
      // Главное - не 401 (не требует авторизации)
      expect(response.status).not.toBe(401);

      // Очищаем
      await prisma.user.delete({ where: { id: publicMaster.id } });
    });

    it('should allow GET /api/health without token', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
    });
  });
});
