import Queue from 'bull';
import { NotificationService } from './notificationService';

// Интерфейс для данных уведомления
export interface NotificationData {
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  masterName: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  price: number;
}

// Создаем очередь уведомлений
export const notificationQueue = new Queue('notification', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    removeOnComplete: 10, // Оставляем последние 10 завершенных задач
    removeOnFail: 5, // Оставляем последние 5 неудачных задач
    attempts: 3, // Максимум 3 попытки
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Обработчик очереди
notificationQueue.process('send-booking-notification', async job => {
  const data: NotificationData = job.data;

  console.log(`Processing notification for appointment ${data.appointmentId}`);

  try {
    // Отправляем все типы уведомлений
    const results = await NotificationService.sendAllNotifications(data);

    console.log('Notification results:', results);

    // Проверяем, что хотя бы одно уведомление отправилось
    const hasSuccess = results.sms || results.email || results.push;

    if (!hasSuccess) {
      throw new Error('All notification types failed');
    }

    return {
      success: true,
      sentAt: new Date().toISOString(),
      results,
    };
  } catch (error) {
    console.error(
      `Failed to send notification for appointment ${data.appointmentId}:`,
      error
    );
    throw error;
  }
});

// Обработчики событий очереди
notificationQueue.on('completed', job => {
  console.log(`Job ${job.id} completed successfully`);
});

notificationQueue.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

notificationQueue.on('stalled', job => {
  console.warn(`Job ${job?.id} stalled`);
});

export default notificationQueue;
