/**
 * 🎫 TOKEN UTILITIES
 *
 * Назначение: Генерация и управление различными типами токенов
 *
 * Функции:
 * - generateEmailVerifyToken(): Токен для подтверждения email
 * - generatePasswordResetToken(): Токен для сброса пароля
 * - generateRefreshToken(): Refresh token для долгосрочной аутентификации
 * - createPasswordResetToken(): Токен сброса с истечением через 1 час
 * - createRefreshToken(): Refresh token с истечением через 7 дней
 * - getAccessTokenExpiration(): Получение времени истечения access token (15 минут)
 * - isTokenExpired(): Проверка истечения токена
 *
 * Когда использовать:
 * - При добавлении email верификации
 * - При реализации сброса пароля
 * - При переходе на refresh tokens
 *
 * Перенос: src/utils/tokens.ts
 */

import crypto from 'crypto';

// Генерация случайного токена для подтверждения email
export function generateEmailVerifyToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Генерация токена для сброса пароля
export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Генерация refresh token
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

// Проверка срока действия токена сброса пароля
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

// Создание токена сброса пароля с истечением через 1 час
export function createPasswordResetToken(): { token: string; expiresAt: Date } {
  const token = generatePasswordResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // истекает через 1 час

  return { token, expiresAt };
}

// Создание refresh token с истечением через 7 дней
export function createRefreshToken(): { token: string; expiresAt: Date } {
  const token = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // истекает через 7 дней

  return { token, expiresAt };
}

// Создание access token с истечением через 15 минут
// Примечание: Access token создаётся через jwt.sign() в контроллерах
// Эта функция возвращает только информацию о сроке действия
export function getAccessTokenExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // истекает через 15 минут
  return expiresAt;
}
