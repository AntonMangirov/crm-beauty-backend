import Queue from 'bull';
import { NotificationService } from './notificationService';
import { logError, logInfo, logWarn } from '../utils/logger';

// Интерфейс для данных уведомления
export interface NotificationData {
  appointmentId: string;
  clientName?: string; // Опционально, имя клиента
  clientPhone?: string; // Опционально, так как может быть telegramUsername
  clientTelegramUsername?: string; // Опционально, альтернатива телефону
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

  try {
    const results = await NotificationService.sendAllNotifications(data);

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
    logError(
      `Ошибка отправки уведомления для записи ${data.appointmentId}`,
      error
    );
    throw error;
  }
});

// Обработчики событий очереди
notificationQueue.on('completed', job => {
  logInfo(`Задача ${job.id} выполнена успешно`);
});

notificationQueue.on('failed', (job, err) => {
  logError(`Задача ${job?.id} завершилась с ошибкой`, err);
});

notificationQueue.on('stalled', job => {
  logWarn(`Задача ${job?.id} зависла`);
});

export default notificationQueue;
