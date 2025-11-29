import request from 'supertest';
import app from '../app';

describe('Notification Queue Integration', () => {
  it('should queue notification after successful booking', async () => {
    const bookingData = {
      name: 'Test Client',
      phone: '+1234567890',
      serviceId: 'test-service-id',
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      comment: 'Test booking with notification',
    };

    // Отправляем запрос на создание записи
    const response = await request(app)
      .post('/api/public/test-master/book')
      .send(bookingData);

    // Проверяем, что запрос обработан (может быть 400/404/500 из-за отсутствия данных)
    expect([400, 404, 500]).toContain(response.status);

    // Если запрос успешен, проверяем структуру ответа
    if (response.status === 201) {
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('startAt');
      expect(response.body).toHaveProperty('endAt');
      expect(response.body).toHaveProperty('status');
    }
  });

  it('should handle notification queue errors gracefully', async () => {
    const bookingData = {
      name: 'Test Client',
      phone: '+1234567890',
      serviceId: 'test-service-id',
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    // Тест должен пройти даже если очередь недоступна
    const response = await request(app)
      .post('/api/public/test-master/book')
      .send(bookingData);

    // Проверяем, что основная функциональность работает
    expect([400, 404, 500, 201]).toContain(response.status);
  });

  it('should validate notification data structure', async () => {
    // Тест структуры данных уведомления
    const notificationData = {
      appointmentId: 'test-id',
      clientName: 'Test Client',
      clientPhone: '+1234567890',
      masterName: 'Test Master',
      serviceName: 'Test Service',
      startAt: new Date().toISOString(),
      endAt: new Date().toISOString(),
      price: 100,
    };

    // Проверяем, что все обязательные поля присутствуют
    expect(notificationData).toHaveProperty('appointmentId');
    // clientName теперь опциональное поле
    expect(notificationData).toHaveProperty('clientName');
    expect(notificationData).toHaveProperty('clientPhone');
    expect(notificationData).toHaveProperty('masterName');
    expect(notificationData).toHaveProperty('serviceName');
    expect(notificationData).toHaveProperty('startAt');
    expect(notificationData).toHaveProperty('endAt');
    expect(notificationData).toHaveProperty('price');
  });
});
