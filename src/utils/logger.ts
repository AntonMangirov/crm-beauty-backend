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

// Создаём streams для разных файлов
const errorLogStream = pino.destination({
  dest: path.join(LOGS_DIR, 'error.log'),
  sync: false, // Асинхронная запись для производительности
});

const bookingLogStream = pino.destination({
  dest: path.join(LOGS_DIR, 'booking.log'),
  sync: false,
});

const appLogStream = pino.destination({
  dest: path.join(LOGS_DIR, 'app.log'),
  sync: false,
});

const devAnalyticsLogStream = pino.destination({
  dest: path.join(LOGS_DIR, 'dev-analytics.log'),
  sync: false,
});

// Создаём логгеры для разных файлов
const errorLogger = pino(baseLoggerOptions, errorLogStream);
const bookingLogger = pino(baseLoggerOptions, bookingLogStream);
const appLogger = pino(baseLoggerOptions, appLogStream);
const devAnalyticsLogger = pino(baseLoggerOptions, devAnalyticsLogStream);

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
