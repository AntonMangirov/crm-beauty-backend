import request from 'supertest';
import app from '../app';

describe('Basic API Tests', () => {
  describe('Server Health', () => {
    it('should start server and respond to health check', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'OK',
        message: 'CRM Beauty Backend is running',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle multiple health requests', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => request(app).get('/api/health'));

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
      });
    });
  });

  describe('API Routes Structure', () => {
    it('should have public routes configured', async () => {
      // Тестируем, что роуты настроены (даже если база данных недоступна)
      const response = await request(app).get('/api/public/test-slug');

      // Должен возвращать ошибку базы данных (500) или 404 (мастер не найден), но не 404 для несуществующего роута
      expect([404, 500]).toContain(response.status);
    });

    it('should handle booking route structure', async () => {
      const response = await request(app)
        .post('/api/public/test-slug/book')
        .send({});

      // Должен возвращать ошибку валидации, но не 404
      expect(response.status).not.toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      await request(app).get('/api/non-existent-route').expect(404);
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app)
        .post('/api/public/test-slug/book')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should handle empty request bodies', async () => {
      await request(app)
        .post('/api/public/test-slug/book')
        .send({})
        .expect(400);
    });
  });

  describe('CORS and Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle OPTIONS requests', async () => {
      const response = await request(app).options('/api/health');

      // OPTIONS запросы должны обрабатываться
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Request Validation', () => {
    it('should validate required fields in booking requests', async () => {
      const invalidRequests = [
        {}, // Пустой объект
        { name: 'Test' }, // Неполные данные
        { name: 'Test', phone: '123' }, // Неполные данные
        {
          name: 'Test',
          phone: '+1234567890',
          serviceId: 'test-service-id',
          startAt: 'invalid-date',
        }, // Неверная дата
      ];

      for (const requestData of invalidRequests) {
        const response = await request(app)
          .post('/api/public/test-slug/book')
          .send(requestData);

        expect([400, 500]).toContain(response.status);
      }
    });

    it('should handle special characters in URLs', async () => {
      const specialChars = [
        'test%20slug',
        'test+slug',
        'test/slug',
        'test?slug',
        'test#slug',
      ];

      for (const slug of specialChars) {
        const response = await request(app).get(`/api/public/${slug}`);

        // Должен обрабатываться без краша сервера
        expect([400, 404, 500]).toContain(response.status);
      }
    });
  });

  describe('Performance', () => {
    it('should respond quickly to health checks', async () => {
      const startTime = Date.now();

      await request(app).get('/api/health').expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Должен отвечать быстрее 1 секунды
      expect(responseTime).toBeLessThan(1000);
    });

    it('should handle concurrent health checks', async () => {
      const startTime = Date.now();
      const requestCount = 20;

      const requests = Array(requestCount)
        .fill(null)
        .map(() => request(app).get('/api/health'));

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Все запросы должны быть успешными
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Должен обработать все запросы быстро
      expect(totalTime).toBeLessThan(2000);
    });
  });
});
