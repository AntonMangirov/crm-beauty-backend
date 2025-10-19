import { Request, Response, NextFunction } from 'express';
import {
  parseISOToUTC,
  validateTimeRange,
  isFutureTime,
  isValidBookingTime,
  isValidISOString,
  getCurrentUTC,
} from '../utils/timeUtils';

/**
 * Middleware для валидации времени в запросах
 */
export const validateTimeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Проверяем только если есть поля времени в body
  if (req.body && (req.body.startAt || req.body.endAt)) {
    const { startAt, endAt } = req.body;

    // Валидируем startAt
    if (startAt) {
      if (!isValidISOString(startAt)) {
        return res.status(400).json({
          error: 'Invalid time format',
          code: 'INVALID_TIME_FORMAT',
          message:
            'startAt must be a valid ISO string (e.g., "2024-01-01T10:00:00.000Z")',
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      try {
        const startDate = parseISOToUTC(startAt);

        if (!validateTimeRange(startDate)) {
          return res.status(400).json({
            error: 'Invalid time range',
            code: 'INVALID_TIME_RANGE',
            message: 'startAt must be within reasonable time bounds',
            timestamp: new Date().toISOString(),
            path: req.path,
          });
        }

        if (!isFutureTime(startDate)) {
          return res.status(400).json({
            error: 'Time in the past',
            code: 'TIME_IN_PAST',
            message: 'startAt must be in the future',
            timestamp: new Date().toISOString(),
            path: req.path,
          });
        }

        if (!isValidBookingTime(startDate)) {
          return res.status(400).json({
            error: 'Invalid booking time',
            code: 'INVALID_BOOKING_TIME',
            message: 'startAt must be between 2 hours and 30 days from now',
            timestamp: new Date().toISOString(),
            path: req.path,
          });
        }

        // Заменяем строку на Date объект для дальнейшей обработки
        req.body.startAt = startDate;
      } catch (err) {
        return res.status(400).json({
          error: 'Time parsing error',
          code: 'TIME_PARSING_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }

    // Валидируем endAt если есть
    if (endAt) {
      if (!isValidISOString(endAt)) {
        return res.status(400).json({
          error: 'Invalid time format',
          code: 'INVALID_TIME_FORMAT',
          message: 'endAt must be a valid ISO string',
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      try {
        const endDate = parseISOToUTC(endAt);

        if (!validateTimeRange(endDate)) {
          return res.status(400).json({
            error: 'Invalid time range',
            code: 'INVALID_TIME_RANGE',
            message: 'endAt must be within reasonable time bounds',
            timestamp: new Date().toISOString(),
            path: req.path,
          });
        }

        // Проверяем что endAt после startAt
        if (startAt && endDate <= req.body.startAt) {
          return res.status(400).json({
            error: 'Invalid time order',
            code: 'INVALID_TIME_ORDER',
            message: 'endAt must be after startAt',
            timestamp: new Date().toISOString(),
            path: req.path,
          });
        }

        // Заменяем строку на Date объект для дальнейшей обработки
        req.body.endAt = endDate;
      } catch (err) {
        return res.status(400).json({
          error: 'Time parsing error',
          code: 'TIME_PARSING_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }
  }

  next();
};

/**
 * Middleware для логирования временных операций
 */
export const timeLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = getCurrentUTC();

  // Логируем начало операции
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[TIME] ${req.method} ${req.path} started at ${startTime.toISOString()}`
    );
  }

  // Перехватываем ответ для логирования времени выполнения
  const originalSend = res.send;
  res.send = function (body) {
    const endTime = getCurrentUTC();
    const duration = endTime.getTime() - startTime.getTime();

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[TIME] ${req.method} ${req.path} completed in ${duration}ms`
      );
    }

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Middleware для добавления временных меток в ответы
 */
export const addTimeStampsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const originalJson = res.json;

  res.json = function (obj) {
    if (obj && typeof obj === 'object') {
      // Добавляем временные метки к ответам
      obj.serverTime = getCurrentUTC().toISOString();
      obj.timezone = 'UTC';
    }

    return originalJson.call(this, obj);
  };

  next();
};

/**
 * Middleware для проверки временных зон в заголовках
 */
export const timezoneMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const timezoneHeader = req.headers['x-timezone'] as string;

  if (timezoneHeader) {
    // Валидируем часовой пояс
    try {
      // Проверяем что часовой пояс поддерживается
      new Date().toLocaleString('en-US', { timeZone: timezoneHeader });
      req.timezone = timezoneHeader;
    } catch {
      return res.status(400).json({
        error: 'Invalid timezone',
        code: 'INVALID_TIMEZONE',
        message: `Unsupported timezone: ${timezoneHeader}`,
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  next();
};

// Расширяем типы Request для timezone
declare global {
  namespace Express {
    interface Request {
      timezone?: string;
    }
  }
}
