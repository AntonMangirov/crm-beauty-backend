import request from 'supertest';
import app from '../app';
import { prisma } from './setup';

describe('Double-Booking Protection', () => {
  let testMaster: any;
  let testService: any;

  beforeEach(async () => {
    // Создаем тестового мастера
    testMaster = await prisma.user.create({
      data: {
        email: 'double-booking-test@example.com',
        passwordHash: 'hashed-password',
        name: 'Double Booking Test Master',
        slug: 'double-booking-test-master',
        description: 'Master for double booking tests',
        address: 'Test Address',
        isActive: true,
        role: 'MASTER',
      },
    });

    // Создаем тестовую услугу
    testService = await prisma.service.create({
      data: {
        masterId: testMaster.id,
        name: 'Test Service',
        price: 100.0,
        durationMin: 60,
        description: 'Test service for double booking',
        isActive: true,
      },
    });
  });

  describe('Concurrent Booking Protection', () => {
    it('should prevent double booking with concurrent requests', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Завтра
      const bookingData = {
        name: 'Concurrent Test Client',
        phone: '+1234567890',
        serviceId: testService.id,
        startAt: baseTime.toISOString(),
        comment: 'Concurrent booking test',
      };

      // Создаем 5 одновременных запросов на одно и то же время
      const concurrentRequests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .post(`/api/public/${testMaster.slug}/book`)
            .send(bookingData)
        );

      const responses = await Promise.all(concurrentRequests);

      // Только один запрос должен быть успешным
      const successfulResponses = responses.filter(r => r.status === 201);
      const conflictResponses = responses.filter(r => r.status === 409);

      expect(successfulResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(4);

      // Проверяем, что успешный ответ содержит правильные данные
      const successfulResponse = successfulResponses[0];
      expect(successfulResponse.body).toMatchObject({
        id: expect.any(String),
        startAt: expect.any(String),
        endAt: expect.any(String),
        status: 'CONFIRMED',
      });

      // Проверяем, что в базе данных создана только одна запись
      const appointments = await prisma.appointment.findMany({
        where: {
          masterId: testMaster.id,
          startAt: baseTime,
        },
      });

      expect(appointments).toHaveLength(1);
    });

    it('should handle rapid sequential bookings correctly', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Первая запись
      const firstBooking = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'First Client',
          phone: '+1111111111',
          serviceId: testService.id,
          startAt: baseTime.toISOString(),
        })
        .expect(201);

      // Вторая запись на то же время (должна быть отклонена)
      const secondBooking = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'Second Client',
          phone: '+2222222222',
          serviceId: testService.id,
          startAt: baseTime.toISOString(),
        })
        .expect(409);

      expect(secondBooking.body).toHaveProperty(
        'error',
        'Time slot is not available'
      );

      // Проверяем, что в базе только одна запись
      const appointments = await prisma.appointment.findMany({
        where: {
          masterId: testMaster.id,
          startAt: baseTime,
        },
      });

      expect(appointments).toHaveLength(1);
      expect(appointments[0].id).toBe(firstBooking.body.id);
    });

    it('should allow bookings with different time slots', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const secondTime = new Date(baseTime.getTime() + 2 * 60 * 60 * 1000); // +2 часа

      // Первая запись
      const firstBooking = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'First Client',
          phone: '+1111111111',
          serviceId: testService.id,
          startAt: baseTime.toISOString(),
        })
        .expect(201);

      // Вторая запись на другое время (должна быть успешной)
      const secondBooking = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'Second Client',
          phone: '+2222222222',
          serviceId: testService.id,
          startAt: secondTime.toISOString(),
        })
        .expect(201);

      // Проверяем, что в базе две записи
      const appointments = await prisma.appointment.findMany({
        where: {
          masterId: testMaster.id,
        },
        orderBy: {
          startAt: 'asc',
        },
      });

      expect(appointments).toHaveLength(2);
      expect(appointments[0].id).toBe(firstBooking.body.id);
      expect(appointments[1].id).toBe(secondBooking.body.id);
    });

    it('should handle edge case overlapping times', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Создаем первую запись
      await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'First Client',
          phone: '+1111111111',
          serviceId: testService.id,
          startAt: baseTime.toISOString(),
        })
        .expect(201);

      // Тестируем различные случаи перекрытия
      const overlappingTimes = [
        // Точно такое же время
        baseTime.toISOString(),
        // Начинается на 30 минут раньше (перекрывается)
        new Date(baseTime.getTime() - 30 * 60 * 1000).toISOString(),
        // Начинается на 30 минут позже (перекрывается)
        new Date(baseTime.getTime() + 30 * 60 * 1000).toISOString(),
        // Начинается на 59 минут позже (перекрывается)
        new Date(baseTime.getTime() + 59 * 60 * 1000).toISOString(),
      ];

      for (const time of overlappingTimes) {
        const response = await request(app)
          .post(`/api/public/${testMaster.slug}/book`)
          .send({
            name: 'Overlapping Client',
            phone: '+3333333333',
            serviceId: testService.id,
            startAt: time,
          });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty(
          'error',
          'Time slot is not available'
        );
      }
    });

    it('should handle database transaction rollback on error', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Создаем первую запись
      await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'First Client',
          phone: '+1111111111',
          serviceId: testService.id,
          startAt: baseTime.toISOString(),
        })
        .expect(201);

      // Попытка создать перекрывающуюся запись
      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'Second Client',
          phone: '+2222222222',
          serviceId: testService.id,
          startAt: baseTime.toISOString(),
        })
        .expect(409);

      // Проверяем, что в базе данных осталась только одна запись
      const appointments = await prisma.appointment.findMany({
        where: {
          masterId: testMaster.id,
        },
      });

      expect(appointments).toHaveLength(1);
      expect(response.body).toHaveProperty(
        'error',
        'Time slot is not available'
      );
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high concurrent load without data corruption', async () => {
      const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const requestCount = 20;

      // Создаем множество одновременных запросов
      const concurrentRequests = Array(requestCount)
        .fill(null)
        .map((_, index) =>
          request(app)
            .post(`/api/public/${testMaster.slug}/book`)
            .send({
              name: `Client ${index}`,
              phone: `+123456789${index}`,
              serviceId: testService.id,
              startAt: baseTime.toISOString(),
            })
        );

      const responses = await Promise.all(concurrentRequests);

      // Только один запрос должен быть успешным
      const successfulResponses = responses.filter(r => r.status === 201);
      const conflictResponses = responses.filter(r => r.status === 409);

      expect(successfulResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(requestCount - 1);

      // Проверяем целостность данных
      const appointments = await prisma.appointment.findMany({
        where: {
          masterId: testMaster.id,
        },
      });

      expect(appointments).toHaveLength(1);
    });
  });
});
