/**
 * Утилита для логирования ошибок в файл
 *
 * Логи сохраняются в:
 * - logs/error.log - все ошибки
 * - logs/booking.log - логи бронирования
 * - logs/app.log - общие логи приложения
 */

import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

// Создаём директорию для логов если её нет
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Форматирует запись лога в строку
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.message,
  ];

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(`Context: ${JSON.stringify(entry.context)}`);
  }

  if (entry.error) {
    parts.push(`Error: ${entry.error.message}`);
    if (entry.error.code) {
      parts.push(`Code: ${entry.error.code}`);
    }
    if (entry.error.stack) {
      parts.push(`Stack: ${entry.error.stack}`);
    }
  }

  return parts.join(' ') + '\n';
}

/**
 * Записывает лог в файл
 */
function writeLog(filename: string, entry: LogEntry): void {
  try {
    const filePath = path.join(LOGS_DIR, filename);
    const logLine = formatLogEntry(entry);

    // Добавляем в конец файла (append)
    fs.appendFileSync(filePath, logLine, 'utf8');
  } catch (error) {
    // Если не удалось записать в файл, выводим в консоль
    console.error('[LOGGER] Failed to write to log file:', error);
    console.error(formatLogEntry(entry));
  }
}

/**
 * Логирует ошибку в файл error.log
 */
export function logError(
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    context,
  };

  if (error instanceof Error) {
    entry.error = {
      message: error.message,
      stack: error.stack,
      code: (error as { code?: string }).code,
    };
  } else if (error) {
    entry.error = {
      message: String(error),
    };
  }

  writeLog('error.log', entry);

  // Также выводим в консоль для разработки
  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR] ${message}`, error, context);
  }
}

/**
 * Логирует предупреждение
 */
export function logWarn(
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    message,
    context,
  };

  writeLog('error.log', entry);

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[WARN] ${message}`, context);
  }
}

/**
 * Логирует информацию о бронировании в booking.log
 */
export function logBooking(
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    context,
  };

  writeLog('booking.log', entry);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[BOOKING] ${message}`, context);
  }
}

/**
 * Логирует общую информацию в app.log
 */
export function logInfo(
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    context,
  };

  writeLog('app.log', entry);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] ${message}`, context);
  }
}
