/**
 * 🔒 RATE LIMITING MIDDLEWARE
 *
 * Назначение: Защита от брутфорс атак и злоупотреблений API
 *
 * Функции:
 * - authRateLimit: 5 попыток логина за 15 минут
 * - registerRateLimit: 3 регистрации в час
 * - passwordResetRateLimit: 3 попытки сброса пароля в час
 * - apiRateLimit: 100 запросов к API за 15 минут
 *
 * Когда использовать:
 * - При тестировании под нагрузкой
 * - Перед деплоем в продакшен
 * - При подозрении на атаки
 *
 * Перенос: src/middleware/rateLimit.ts
 */

import rateLimit from 'express-rate-limit';

// Rate limiting для аутентификации
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток за 15 минут
  message: {
    error: 'Too many login attempts, please try again later',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // не считаем успешные запросы
});

// Rate limiting для регистрации
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // максимум 3 регистрации в час
  message: {
    error: 'Too many registration attempts, please try again later',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting для сброса пароля
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // максимум 3 попытки сброса в час
  message: {
    error: 'Too many password reset attempts, please try again later',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting для API (общий)
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов за 15 минут
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
