import request from 'supertest';
import app from '../app';
import prisma from '../prismaClient';
import {
  parseISOToUTC,
  formatUTCToISO,
  validateTimeRange,
  isFutureTime,
  isValidBookingTime,
  isValidISOString,
  addMinutesToUTC,
} from '../utils/timeUtils';

let testMaster: any;
let testService: any;

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  testMaster = await prisma.user.create({
    data: {
      email: 'utc-test@example.com',
      password: 'password123',
      name: 'UTC Test Master',
      slug: 'utc-test-master',
      role: 'MASTER',
      isActive: true,
    },
  });

  testService = await prisma.service.create({
    data: {
      masterId: testMaster.id,
      name: 'UTC Test Service',
      price: 100.0,
      durationMin: 60,
      isActive: true,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('UTC Time Policy', () => {
  describe('Time Utils Functions', () => {
    it('should parse ISO string to UTC Date', () => {
      const isoString = '2024-01-01T10:00:00.000Z';
      const date = parseISOToUTC(isoString);

      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe(isoString);
    });

    it('should format UTC Date to ISO string', () => {
      const date = new Date('2024-01-01T10:00:00.000Z');
      const isoString = formatUTCToISO(date);

      expect(isoString).toBe('2024-01-01T10:00:00.000Z');
    });

    it('should validate time range', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      expect(validateTimeRange(now)).toBe(true);
      expect(validateTimeRange(future)).toBe(true);
      expect(validateTimeRange(past)).toBe(true);
    });

    it('should check if time is in future', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const past = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      expect(isFutureTime(future)).toBe(true);
      expect(isFutureTime(past)).toBe(false);
    });

    it('should validate booking time', () => {
      const now = new Date();
      const validFuture = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
      const tooSoon = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
      const tooFar = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000); // 31 days from now

      expect(isValidBookingTime(validFuture)).toBe(true);
      expect(isValidBookingTime(tooSoon)).toBe(false);
      expect(isValidBookingTime(tooFar)).toBe(false);
    });

    it('should validate ISO string format', () => {
      expect(isValidISOString('2024-01-01T10:00:00.000Z')).toBe(true);
      expect(isValidISOString('2024-01-01T10:00:00Z')).toBe(true);
      expect(isValidISOString('2024-01-01T10:00:00')).toBe(false);
      expect(isValidISOString('invalid')).toBe(false);
    });

    it('should add minutes to UTC time', () => {
      const start = new Date('2024-01-01T10:00:00.000Z');
      const result = addMinutesToUTC(start, 30);

      expect(result.toISOString()).toBe('2024-01-01T10:30:00.000Z');
    });
  });

  describe('API Time Handling', () => {
    it('should accept valid ISO time string for booking', async () => {
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 3);

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: futureTime.toISOString(),
          comment: 'UTC test booking',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('startAt');
      expect(response.body).toHaveProperty('endAt');
      expect(response.body).toHaveProperty('status');

      // Проверяем что время сохранено в UTC
      const appointment = await prisma.appointment.findUnique({
        where: { id: response.body.id },
      });

      expect(appointment).toBeDefined();
      expect(appointment?.startAt.toISOString()).toBe(futureTime.toISOString());
    });

    it('should reject invalid time format', async () => {
      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: 'invalid-time-format',
          comment: 'Invalid time test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });

    it('should reject time in the past', async () => {
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 1);

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: pastTime.toISOString(),
          comment: 'Past time test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });

    it('should reject time too far in future', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 31);

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: farFuture.toISOString(),
          comment: 'Far future test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });

    it('should handle timezone headers', async () => {
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 3);

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .set('X-Timezone', 'Europe/Moscow')
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: futureTime.toISOString(),
          comment: 'Timezone test',
        });

      expect(response.status).toBe(201);
    });

    it('should reject invalid timezone', async () => {
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 3);

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .set('X-Timezone', 'Invalid/Timezone')
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: futureTime.toISOString(),
          comment: 'Invalid timezone test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_TIMEZONE');
    });
  });

  describe('Database UTC Storage', () => {
    it('should store time in UTC in database', async () => {
      const futureTime = new Date('2024-01-01T10:00:00.000Z');

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: futureTime.toISOString(),
          comment: 'UTC storage test',
        });

      expect(response.status).toBe(201);

      const appointment = await prisma.appointment.findUnique({
        where: { id: response.body.id },
      });

      expect(appointment).toBeDefined();
      expect(appointment?.startAt.toISOString()).toBe(
        '2024-01-01T10:00:00.000Z'
      );
      expect(appointment?.endAt.toISOString()).toBe('2024-01-01T11:00:00.000Z');
    });

    it('should return time in ISO format', async () => {
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 3);

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: futureTime.toISOString(),
          comment: 'ISO format test',
        });

      expect(response.status).toBe(201);
      expect(response.body.startAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(response.body.endAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('Time Middleware', () => {
    it('should add server time to responses', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('serverTime');
      expect(response.body).toHaveProperty('timezone', 'UTC');
      expect(response.body.serverTime).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should log time operations in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Time Validation Edge Cases', () => {
    it('should handle leap year dates', async () => {
      const leapYearDate = new Date('2024-02-29T10:00:00.000Z');

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: leapYearDate.toISOString(),
          comment: 'Leap year test',
        });

      expect(response.status).toBe(201);
    });

    it('should handle timezone conversion correctly', async () => {
      // Тест с временем в разных часовых поясах
      const moscowTime = new Date('2024-01-01T13:00:00.000Z'); // 13:00 UTC = 16:00 Moscow

      const response = await request(app)
        .post(`/api/public/${testMaster.slug}/book`)
        .send({
          name: 'UTC Test Client',
          phone: '+1234567890',
          serviceId: testService.id,
          startAt: moscowTime.toISOString(),
          comment: 'Timezone conversion test',
        });

      expect(response.status).toBe(201);

      const appointment = await prisma.appointment.findUnique({
        where: { id: response.body.id },
      });

      expect(appointment?.startAt.toISOString()).toBe(
        '2024-01-01T13:00:00.000Z'
      );
    });
  });
});
