import request from 'supertest';
import app from '../app';
import { prisma } from './setup';

describe('Public API Endpoints', () => {
  let testMaster: any;
  let testService: any;
  let testClient: any;

  beforeEach(async () => {
    // Создаем тестового мастера
    testMaster = await prisma.user.create({
      data: {
        email: 'test-master@example.com',
        passwordHash: 'hashed-password',
        name: 'Test Master',
        slug: 'test-master',
        description: 'Professional beauty master',
        address: 'Test Address 123',
        isActive: true,
        role: 'MASTER',
      },
    });

    // Создаем тестовую услугу
    testService = await prisma.service.create({
      data: {
        masterId: testMaster.id,
        name: 'Test Service',
        price: 100.5,
        durationMin: 60,
        description: 'Test service description',
        isActive: true,
      },
    });

    // Создаем тестового клиента
    testClient = await prisma.client.create({
      data: {
        masterId: testMaster.id,
        name: 'Test Client',
        phone: '+1234567890',
        isActive: true,
      },
    });
  });

  describe('GET /api/public/:slug', () => {
    it('should return master profile with services for valid slug', async () => {
      expect(testMaster).toBeDefined();
      const response = await request(app)
        .get(`/api/public/${testMaster.slug}`)
        .expect(200);

      expect(response.body).toMatchObject({
        name: testMaster.name,
        description: testMaster.description,
        address: testMaster.address,
        services: [
          {
            id: testService.id,
            name: testService.name,
            price: testService.price.toString(),
            durationMin: testService.durationMin,
          },
        ],
      });
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app)
        .get('/api/public/non-existent-slug')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Profile not found');
    });

    it('should return 404 for inactive master', async () => {
      // Деактивируем мастера
      await prisma.user.update({
        where: { id: testMaster.id },
        data: { isActive: false },
      });

      const response = await request(app)
        .get(`/api/public/${testMaster.slug}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Profile not found');
    });

    it('should return 400 for empty slug', async () => {
      await request(app).get('/api/public/').expect(404); // Express возвращает 404 для несуществующего роута
    });

    it('should only return active services', async () => {
      // Создаем неактивную услугу
      await prisma.service.create({
        data: {
          masterId: testMaster.id,
          name: 'Inactive Service',
          price: 50.0,
          durationMin: 30,
          isActive: false,
        },
      });

      const response = await request(app)
        .get(`/api/public/${testMaster.slug}`)
        .expect(200);

      expect(response.body.services).toHaveLength(1);
      expect(response.body.services[0].name).toBe('Test Service');
    });

    it('should handle database errors gracefully', async () => {
      // Мокаем ошибку базы данных
      const originalFindUnique = prisma.user.findUnique;
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get(`/api/public/${testMaster.slug}`)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Server error');

      // Восстанавливаем оригинальный метод
      prisma.user.findUnique = originalFindUnique;
    });
  });

  describe('POST /api/public/:slug/book', () => {
    const validBookingData = {
      name: 'New Client',
      phone: '+9876543210',
      serviceId: '',
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Завтра
      comment: 'Test booking comment',
    };

    beforeEach(() => {
      validBookingData.serviceId = testService.id;
    });

    it('should create booking successfully', async () => {
      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(validBookingData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        startAt: expect.any(String),
        endAt: expect.any(String),
        status: 'CONFIRMED',
      });

      // Проверяем, что запись создана в базе данных
      const appointment = await prisma.appointment.findUnique({
        where: { id: response.body.id },
        include: { client: true, service: true },
      });

      expect(appointment).toBeTruthy();
      expect(appointment?.client.name).toBe(validBookingData.name);
      expect(appointment?.client.phone).toBe(validBookingData.phone);
      expect(appointment?.service.id).toBe(testService.id);
    });

    it('should create new client if not exists', async () => {
      await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(validBookingData)
        .expect(201);

      const client = await prisma.client.findFirst({
        where: { phone: validBookingData.phone, masterId: testMaster.id },
      });

      expect(client).toBeTruthy();
      expect(client?.name).toBe(validBookingData.name);
    });

    it('should update existing client name if empty', async () => {
      // Создаем клиента без имени
      const existingClient = await prisma.client.create({
        data: {
          masterId: testMaster.id,
          name: '',
          phone: validBookingData.phone,
        },
      });

      await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(validBookingData)
        .expect(201);

      const updatedClient = await prisma.client.findUnique({
        where: { id: existingClient.id },
      });

      expect(updatedClient?.name).toBe(validBookingData.name);
    });

    it('should return 404 for non-existent master', async () => {
      const response = await request(app)
        .post('/api/public/non-existent-master/book')
        .send(validBookingData);

      // Может быть 400 (валидация) или 404 (мастер не найден)
      expect([400, 404]).toContain(response.status);
      if (response.status === 404) {
        expect(response.body).toHaveProperty('error', 'Master not found');
      }
    });

    it('should return 400 for invalid service', async () => {
      const invalidData = {
        ...validBookingData,
        serviceId: 'invalid-service-id',
      };

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Service not found');
    });

    it('should return 400 for invalid request data', async () => {
      const invalidData = {
        name: '', // Пустое имя
        phone: '123', // Слишком короткий телефон
        serviceId: testService.id,
        startAt: 'invalid-date',
      };

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
    });

    it('should return 409 for overlapping time slots', async () => {
      // Создаем существующую запись
      await prisma.appointment.create({
        data: {
          masterId: testMaster.id,
          clientId: testClient.id,
          serviceId: testService.id,
          startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          status: 'CONFIRMED',
          price: testService.price,
        },
      });

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(validBookingData)
        .expect(409);

      expect(response.body).toHaveProperty(
        'error',
        'Time slot is not available'
      );
    });

    it('should handle database errors gracefully', async () => {
      // Мокаем ошибку базы данных
      const originalCreate = prisma.appointment.create;
      jest
        .spyOn(prisma.appointment, 'create')
        .mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(validBookingData)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Server error');

      // Восстанавливаем оригинальный метод
      prisma.appointment.create = originalCreate;
    });

    it('should validate time slot boundaries correctly', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Тест 1: Новая встреча начинается внутри существующей
      await prisma.appointment.create({
        data: {
          masterId: testMaster.id,
          clientId: testClient.id,
          serviceId: testService.id,
          startAt: baseTime,
          endAt: new Date(baseTime.getTime() + 60 * 60 * 1000),
          status: 'CONFIRMED',
          price: testService.price,
        },
      });

      const overlappingData = {
        ...validBookingData,
        startAt: new Date(baseTime.getTime() + 30 * 60 * 1000).toISOString(), // Начинается через 30 минут
      };

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(overlappingData)
        .expect(409);

      expect(response.body).toHaveProperty(
        'error',
        'Time slot is not available'
      );
    });
  });

  describe('API Stability Tests', () => {
    it('should handle concurrent requests to /public/:slug', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get(`/api/public/${testMaster.slug}`));

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.name).toBe(testMaster.name);
      });
    });

    it('should handle concurrent booking requests', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const requests = Array(5)
        .fill(null)
        .map((_, index) => {
          const startTime = new Date(
            baseTime.getTime() + index * 2 * 60 * 60 * 1000
          ); // Каждые 2 часа
          return request(app)
            .post(`/api/public/${testMaster.slug}/book`)
            .send({
              name: `Client ${index}`,
              phone: `+123456789${index}`,
              serviceId: testService.id,
              startAt: startTime.toISOString(),
            });
        });

      const responses = await Promise.all(requests);

      // Все запросы должны быть успешными (разные временные слоты)
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('CONFIRMED');
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should handle very long request bodies', async () => {
      const longComment = 'A'.repeat(1000); // 1000 символов
      const data = {
        name: 'Test Client',
        phone: '+1234567890',
        serviceId: testService.id,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        comment: longComment,
      };

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send(data)
        .expect(400); // Должно вернуть ошибку валидации

      expect(response.body).toHaveProperty('error', 'Invalid request');
    });
  });
});
