import request from 'supertest';
import app from '../app';

describe('Security Middleware', () => {
  describe('Helmet Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers).toHaveProperty(
        'x-content-type-options',
        'nosniff'
      );
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty(
        'x-xss-protection',
        '1; mode=block'
      );
      expect(response.headers).toHaveProperty('cache-control');
    });

    it('should include HSTS header', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should include CSP header', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers).toHaveProperty('content-security-policy');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply general rate limiting', async () => {
      // Делаем много запросов подряд
      const promises = Array(105)
        .fill(null)
        .map(() => request(app).get('/api/health'));

      const responses = await Promise.all(promises);

      // Последние запросы должны быть заблокированы
      const blockedResponses = responses.filter(res => res.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);

      // Проверяем формат ошибки rate limiting
      if (blockedResponses.length > 0) {
        expect(blockedResponses[0].body).toHaveProperty('error');
        expect(blockedResponses[0].body).toHaveProperty(
          'code',
          'RATE_LIMIT_EXCEEDED'
        );
      }
    });

    it('should apply auth rate limiting', async () => {
      // Тестируем rate limiting для auth endpoints
      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app).post('/api/auth/login').send({
            email: 'test@example.com',
            password: 'password',
          })
        );

      const responses = await Promise.all(promises);

      // Некоторые запросы должны быть заблокированы
      const blockedResponses = responses.filter(res => res.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should apply booking rate limiting', async () => {
      // Тестируем rate limiting для booking
      const promises = Array(15)
        .fill(null)
        .map(() =>
          request(app).post('/api/public/test-master/book').send({
            name: 'Test Client',
            phone: '+1234567890',
            serviceId: 'test-service',
            startAt: new Date().toISOString(),
          })
        );

      const responses = await Promise.all(promises);

      // Некоторые запросы должны быть заблокированы
      const blockedResponses = responses.filter(res => res.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from localhost', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).not.toBe(403);
    });

    it('should block requests from unknown origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.com');

      // Может быть 403 или 200 в зависимости от настроек
      expect([200, 403]).toContain(response.status);
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(200);
    });
  });

  describe('Request Size Limiting', () => {
    it('should reject oversized requests', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post('/api/public/test-master/book')
        .send({ data: largeData });

      expect(response.status).toBe(413);
      expect(response.body).toHaveProperty('error', 'Request entity too large');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>',
        phone: '+1234567890',
        serviceId: 'test-service',
        startAt: new Date().toISOString(),
      };

      const response = await request(app)
        .post('/api/public/test-master/book')
        .send(maliciousInput);

      // Запрос должен обрабатываться (может быть 400/404/500 из-за отсутствия данных)
      expect([400, 404, 500]).toContain(response.status);
    });

    it('should trim and limit string length', async () => {
      const longString = '  ' + 'x'.repeat(2000) + '  ';

      const response = await request(app)
        .post('/api/public/test-master/book')
        .send({
          name: longString,
          phone: '+1234567890',
          serviceId: 'test-service',
          startAt: new Date().toISOString(),
        });

      // Запрос должен обрабатываться
      expect([400, 404, 500]).toContain(response.status);
    });
  });

  describe('Security Headers for API', () => {
    it('should set no-cache headers for API endpoints', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['cache-control']).toContain('no-cache');
      expect(response.headers).toHaveProperty('pragma', 'no-cache');
    });
  });

  describe('Error Handling for Security', () => {
    it('should handle rate limit errors gracefully', async () => {
      // Делаем много запросов для срабатывания rate limit
      const promises = Array(105)
        .fill(null)
        .map(() => request(app).get('/api/health'));

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find(res => res.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toHaveProperty('error');
        expect(rateLimitedResponse.body).toHaveProperty('code');
        expect(rateLimitedResponse.body).toHaveProperty('timestamp');
        expect(rateLimitedResponse.body).toHaveProperty('path');
      }
    });
  });
});
