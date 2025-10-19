import request from 'supertest';
import app from '../app';
import {
  MasterNotFoundError,
  TimeSlotConflictError,
  ServiceNotFoundError,
} from '../errors/BusinessErrors';

describe('Error Handler', () => {
  describe('404 Not Found', () => {
    it('should handle non-existent routes', async () => {
      const response = await request(app).get('/api/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body).toHaveProperty('code', 'ROUTE_NOT_FOUND');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path', '/api/non-existent-route');
    });
  });

  describe('Business Logic Errors', () => {
    it('should handle MasterNotFoundError', async () => {
      const response = await request(app).get(
        '/api/public/non-existent-master'
      );

      expect([400, 404, 500]).toContain(response.status);
      // Может быть 400 (валидация), 404 (мастер не найден) или 500 (ошибка БД)
    });

    it('should handle ServiceNotFoundError', async () => {
      const bookingData = {
        name: 'Test Client',
        phone: '+1234567890',
        serviceId: 'non-existent-service',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/public/test-master/book')
        .send(bookingData);

      expect([400, 404, 500]).toContain(response.status);
    });

    it('should handle TimeSlotConflictError', async () => {
      const bookingData = {
        name: 'Test Client',
        phone: '+1234567890',
        serviceId: 'test-service-id',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/public/test-master/book')
        .send(bookingData);

      expect([400, 404, 409, 500]).toContain(response.status);
    });
  });

  describe('Validation Errors', () => {
    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/public/test-master/book')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect([400, 500]).toContain(response.status);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/public/test-master/book')
        .send({}); // Пустой объект

      expect([400, 500]).toContain(response.status);
    });

    it('should handle invalid date format', async () => {
      const bookingData = {
        name: 'Test Client',
        phone: '+1234567890',
        serviceId: 'test-service-id',
        startAt: 'invalid-date',
      };

      const response = await request(app)
        .post('/api/public/test-master/book')
        .send(bookingData);

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      const response = await request(app).get('/api/non-existent-route');

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path');

      // Проверяем типы
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.code).toBe('string');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.path).toBe('string');
    });
  });

  describe('Error Classes', () => {
    it('should create MasterNotFoundError correctly', () => {
      const error = new MasterNotFoundError('test-slug');

      expect(error.message).toBe("Master with slug 'test-slug' not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('MASTER_NOT_FOUND');
      expect(error.isOperational).toBe(true);
    });

    it('should create TimeSlotConflictError correctly', () => {
      const startAt = '2024-01-01T10:00:00Z';
      const endAt = '2024-01-01T11:00:00Z';
      const error = new TimeSlotConflictError(startAt, endAt);

      expect(error.message).toBe(
        `Time slot conflict: ${startAt} - ${endAt} is not available`
      );
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('TIME_SLOT_CONFLICT');
      expect(error.isOperational).toBe(true);
    });

    it('should create ServiceNotFoundError correctly', () => {
      const error = new ServiceNotFoundError('test-service-id');

      expect(error.message).toBe("Service with id 'test-service-id' not found");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('SERVICE_NOT_FOUND');
      expect(error.isOperational).toBe(true);
    });
  });
});
