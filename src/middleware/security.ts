import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Конфигурация Helmet для безопасности заголовков
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' },
});

// Общий rate limiter для всех запросов
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов за 15 минут
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests from this IP',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes',
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  },
});

// Строгий rate limiter для аутентификации
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток входа за 15 минут
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // не считать успешные запросы
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes',
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  },
});

// Мягкий rate limiter для публичных API
export const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 200, // максимум 200 запросов за 15 минут
  message: {
    error: 'Too many requests to public API',
    code: 'PUBLIC_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests to public API',
      code: 'PUBLIC_RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes',
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  },
});

// Rate limiter для создания записей
export const bookingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // максимум 10 записей в час с одного IP
  message: {
    error: 'Too many booking attempts',
    code: 'BOOKING_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many booking attempts',
      code: 'BOOKING_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour',
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  },
});

// Middleware для валидации размера запроса
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: Request, res: Response, next: any) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: `${maxSize / 1024 / 1024}MB`,
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    next();
  };
};

// Middleware для очистки входных данных
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sanitizeInput = (req: Request, res: Response, next: any) => {
  // Функция для очистки строк
  const sanitizeString = (str: string): string => {
    return str
      .replace(/[<>]/g, '') // Удаляем потенциально опасные символы
      .trim()
      .slice(0, 1000); // Ограничиваем длину
  };

  // Очищаем body
  if (req.body && typeof req.body === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeString(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sanitized: any = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            sanitized[key] = sanitizeObject(obj[key]);
          }
        }
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }

  // Очищаем query параметры
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    }
  }

  next();
};

// Middleware для добавления дополнительных заголовков безопасности
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const securityHeaders = (req: Request, res: Response, next: any) => {
  // Запрещаем кэширование для API endpoints
  if (req.path.startsWith('/api/')) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    });
  }

  // Добавляем заголовок для предотвращения MIME type sniffing
  res.set('X-Content-Type-Options', 'nosniff');

  // Запрещаем iframe embedding
  res.set('X-Frame-Options', 'DENY');

  // Добавляем заголовок для предотвращения XSS
  res.set('X-XSS-Protection', '1; mode=block');

  next();
};
