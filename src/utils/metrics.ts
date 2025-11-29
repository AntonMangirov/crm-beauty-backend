/**
 * Утилита для отслеживания метрик использования функций
 * Метрики логируются в logs/metrics.log для анализа использования фич
 */

import * as fs from 'fs';
import * as path from 'path';
import { logInfo } from './logger';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const METRICS_FILE = path.join(LOGS_DIR, 'metrics.log');

// Создаём директорию для логов если её нет
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

interface MetricEntry {
  timestamp: string;
  metric: string;
  userId?: string;
  masterId?: string;
  context?: Record<string, unknown>;
}

/**
 * Форматирует запись метрики в строку
 */
function formatMetricEntry(entry: MetricEntry): string {
  const parts = [`[${entry.timestamp}]`, `METRIC: ${entry.metric}`];

  if (entry.userId) {
    parts.push(`userId: ${entry.userId}`);
  }

  if (entry.masterId) {
    parts.push(`masterId: ${entry.masterId}`);
  }

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(`Context: ${JSON.stringify(entry.context)}`);
  }

  return parts.join(' | ') + '\n';
}

/**
 * Записывает метрику в файл metrics.log
 */
function writeMetric(entry: MetricEntry): void {
  try {
    const logLine = formatMetricEntry(entry);
    fs.appendFileSync(METRICS_FILE, logLine, 'utf8');
  } catch (error) {
    console.error('[METRICS] Failed to write metric:', error);
  }
}

/**
 * Логирует метрику использования функции
 */
export function trackMetric(
  metric: string,
  context?: {
    userId?: string;
    masterId?: string;
    [key: string]: unknown;
  }
): void {
  const entry: MetricEntry = {
    timestamp: new Date().toISOString(),
    metric,
    userId: context?.userId,
    masterId: context?.masterId,
    context: context ? { ...context } : undefined,
  };

  writeMetric(entry);

  // Также логируем в общий лог для разработки
  if (process.env.NODE_ENV === 'development') {
    logInfo(`[METRIC] ${metric}`, context);
  }
}

/**
 * Отслеживает создание ручной записи через QuickBookingModal
 */
export function trackManualBooking(context: {
  masterId: string;
  userId?: string;
  serviceId: string;
  appointmentId: string;
  hasCustomPrice?: boolean;
  hasCustomDuration?: boolean;
}): void {
  trackMetric('createManualBooking', {
    masterId: context.masterId,
    userId: context.userId,
    serviceId: context.serviceId,
    appointmentId: context.appointmentId,
    hasCustomPrice: context.hasCustomPrice || false,
    hasCustomDuration: context.hasCustomDuration || false,
  });
}
