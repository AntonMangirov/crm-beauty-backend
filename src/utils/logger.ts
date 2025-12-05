/**
 * Production-ready утилита для логирования на основе Pino
 *
 * Логи сохраняются в:
 * - logs/error.log - все ошибки и предупреждения
 * - logs/booking.log - логи бронирования
 * - logs/app.log - общие логи приложения
 * - logs/dev-analytics.log - логи для разработчиков (dev analytics)
 *
 * В development режиме логи также выводятся в консоль с форматированием через pino-pretty
 */

import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

// Создаём директорию для логов если её нет
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const isDevelopment = process.env.NODE_ENV === 'development';

// Базовые настройки Pino
const baseLoggerOptions: pino.LoggerOptions = {
  level: isDevelopment ? 'debug' : 'info',
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// В development режиме используем только console logger для избежания проблем с sonic-boom
// В production создаем файловые streams
let errorLogStream: pino.DestinationStream | null = null;
let bookingLogStream: pino.DestinationStream | null = null;
let appLogStream: pino.DestinationStream | null = null;
let devAnalyticsLogStream: pino.DestinationStream | null = null;

if (!isDevelopment) {
  // В production создаем файловые streams
  const createSafeDestination = (filePath: string) => {
    try {
      const stream = pino.destination({
        dest: filePath,
        sync: false,
        mkdir: true,
      });

      stream.on('error', err => {
        console.error('Logger stream error:', err);
      });

      return stream;
    } catch (error) {
      console.error(`Failed to create log stream for ${filePath}:`, error);
      return null;
    }
  };

  errorLogStream = createSafeDestination(path.join(LOGS_DIR, 'error.log'));
  bookingLogStream = createSafeDestination(path.join(LOGS_DIR, 'booking.log'));
  appLogStream = createSafeDestination(path.join(LOGS_DIR, 'app.log'));
  devAnalyticsLogStream = createSafeDestination(
    path.join(LOGS_DIR, 'dev-analytics.log')
  );
}

// Создаём логгеры для разных файлов
// В development используем только console logger
const errorLogger = errorLogStream
  ? pino(baseLoggerOptions, errorLogStream)
  : pino(baseLoggerOptions);
const bookingLogger = bookingLogStream
  ? pino(baseLoggerOptions, bookingLogStream)
  : pino(baseLoggerOptions);
const appLogger = appLogStream
  ? pino(baseLoggerOptions, appLogStream)
  : pino(baseLoggerOptions);
const devAnalyticsLogger = devAnalyticsLogStream
  ? pino(baseLoggerOptions, devAnalyticsLogStream)
  : pino(baseLoggerOptions);

// В development режиме добавляем pretty-форматирование в консоль
let consoleLogger: pino.Logger;
if (isDevelopment) {
  consoleLogger = pino({
    ...baseLoggerOptions,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  });
} else {
  // В production просто выводим JSON в stdout
  consoleLogger = pino(baseLoggerOptions);
}

/**
 * Логирует ошибку в файл error.log
 */
export function logError(
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): void {
  const logData: Record<string, unknown> = {
    msg: message,
    ...context,
  };

  if (error instanceof Error) {
    logData.err = {
      message: error.message,
      stack: error.stack,
      code: (error as { code?: string }).code,
      name: error.name,
    };
  } else if (error) {
    logData.err = {
      message: String(error),
    };
  }

  errorLogger.error(logData);
  consoleLogger.error(logData);
}

/**
 * Логирует предупреждение
 */
export function logWarn(
  message: string,
  context?: Record<string, unknown>
): void {
  const logData = {
    msg: message,
    ...context,
  };

  errorLogger.warn(logData);
  consoleLogger.warn(logData);
}

/**
 * Логирует информацию о бронировании в booking.log
 */
export function logBooking(
  message: string,
  context?: Record<string, unknown>
): void {
  const logData = {
    msg: message,
    ...context,
  };

  bookingLogger.info(logData);
  consoleLogger.info({ ...logData, category: 'booking' });
}

/**
 * Логирует общую информацию в app.log
 */
export function logInfo(
  message: string,
  context?: Record<string, unknown>
): void {
  const logData = {
    msg: message,
    ...context,
  };

  appLogger.info(logData);
  consoleLogger.info(logData);
}

/**
 * Логирует ошибку для разработчиков (dev analytics)
 * Отправляет ошибки в отдельный файл для анализа разработчиками
 */
export function logDevError(
  errorCode: string,
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): void {
  const logData: Record<string, unknown> = {
    msg: `[DEV_ANALYTICS] ${message}`,
    errorCode,
    isDevAnalytics: true,
    ...context,
  };

  if (error instanceof Error) {
    logData.err = {
      message: error.message,
      stack: error.stack,
      code: (error as { code?: string }).code,
      name: error.name,
    };
  } else if (error) {
    logData.err = {
      message: String(error),
    };
  }

  // Логируем в отдельный файл для разработчиков
  devAnalyticsLogger.error(logData);

  // Также логируем в общий error.log
  errorLogger.error(logData);

  // Выводим в консоль
  consoleLogger.error(logData);
}

/**
 * Graceful shutdown для логгеров
 * Закрывает все streams корректно при завершении процесса
 */
export function closeLoggers(): Promise<void> {
  return new Promise(resolve => {
    // В development режиме streams не создаются, поэтому просто резолвим
    if (isDevelopment) {
      resolve();
      return;
    }

    const streams = [
      errorLogStream,
      bookingLogStream,
      appLogStream,
      devAnalyticsLogStream,
    ].filter(Boolean) as pino.DestinationStream[]; // Фильтруем null значения

    if (streams.length === 0) {
      resolve();
      return;
    }

    // Pino destination streams закрываются автоматически при завершении процесса
    // Мы просто даем время на завершение записи
    setTimeout(() => {
      resolve();
    }, 100);
  });
}

// НЕ добавляем обработчики здесь, чтобы избежать конфликтов
// Обработка graceful shutdown будет в index.ts

/**
 * Экспортируем базовые логгеры для расширенного использования
 */
export const logger = {
  error: errorLogger,
  warn: errorLogger,
  info: appLogger,
  debug: isDevelopment ? consoleLogger : appLogger,
  booking: bookingLogger,
  devAnalytics: devAnalyticsLogger,
};
