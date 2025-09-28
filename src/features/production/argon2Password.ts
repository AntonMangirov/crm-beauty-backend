/**
 * 🔐 ARGON2 PASSWORD HASHING
 *
 * Назначение: Безопасное хеширование паролей для продакшена
 *
 * Функции:
 * - hashPassword(): Хеширование пароля (Argon2 для продакшена, bcrypt для разработки)
 * - verifyPassword(): Проверка пароля
 * - isBcryptHash(): Определение типа хеша
 * - migratePasswordHash(): Миграция с bcrypt на Argon2
 *
 * Преимущества Argon2:
 * - Более безопасный алгоритм
 * - Защита от атак по времени
 * - Рекомендован OWASP
 * - Устойчив к GPU атакам
 *
 * Настройки Argon2:
 * - memoryCost: 64 MB (2^16)
 * - timeCost: 3 итерации
 * - parallelism: 1 поток
 *
 * Когда использовать:
 * - Перед деплоем в продакшен
 * - При обновлении системы безопасности
 * - При миграции с bcrypt
 *
 * Перенос: src/utils/argon2Password.ts
 * Зависимости: npm install argon2
 */

import bcrypt from 'bcrypt';
import argon2 from 'argon2';

// Определяем, какую библиотеку использовать в зависимости от окружения
const useArgon2 = process.env.NODE_ENV === 'production';

export async function hashPassword(password: string): Promise<string> {
  if (useArgon2) {
    // Argon2 для продакшена - более безопасный
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  } else {
    // bcrypt для разработки - быстрее
    return await bcrypt.hash(password, 10);
  }
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (useArgon2) {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      console.error('Argon2 verification error:', error);
      return false;
    }
  } else {
    return await bcrypt.compare(password, hash);
  }
}

// Проверяем, является ли хеш bcrypt или argon2
export function isBcryptHash(hash: string): boolean {
  return (
    hash.startsWith('$2b$') ||
    hash.startsWith('$2a$') ||
    hash.startsWith('$2y$')
  );
}

// Миграция с bcrypt на argon2 (для продакшена)
export async function migratePasswordHash(
  password: string,
  oldHash: string
): Promise<string> {
  if (useArgon2 && isBcryptHash(oldHash)) {
    // Если это bcrypt хеш, проверяем пароль и создаем новый argon2 хеш
    const isValid = await bcrypt.compare(password, oldHash);
    if (isValid) {
      return await hashPassword(password);
    }
  }
  return oldHash;
}
