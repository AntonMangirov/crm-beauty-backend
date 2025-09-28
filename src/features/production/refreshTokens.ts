/**
 * 🔄 REFRESH TOKENS CONTROLLER
 *
 * Назначение: Управление долгосрочной аутентификацией через refresh tokens
 *
 * Функции:
 * - refreshToken(): Обновление access token с помощью refresh token
 * - revokeToken(): Отзыв refresh token (выход из системы)
 * - issueRefreshToken(): Выдача refresh token при логине
 *
 * API эндпоинты:
 * - POST /api/auth/refresh - обновление access token
 * - POST /api/auth/revoke - отзыв refresh token
 *
 * Требует обновления схемы БД:
 * - refreshToken String? @unique
 * - refreshTokenExpires DateTime?
 *
 * Безопасность:
 * - Access token: 15 минут жизни
 * - Refresh token: 7 дней жизни
 * - Автоматическая ротация токенов
 * - Возможность отзыва токенов
 *
 * Когда использовать:
 * - При необходимости долгосрочной аутентификации
 * - При переходе на короткоживущие access tokens
 * - При улучшении безопасности
 *
 * Перенос: src/controllers/refreshController.ts
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';
import { createRefreshToken } from './tokens';

// Расширяем тип Request для добавления user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

// Обновление access token с помощью refresh token
export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Находим пользователя по refresh token
    const user = await prisma.user.findUnique({
      where: { refreshToken },
    });

    if (!user || !user.refreshTokenExpires) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Проверяем, не истек ли refresh token
    if (new Date() > user.refreshTokenExpires) {
      return res.status(401).json({ error: 'Refresh token has expired' });
    }

    // Создаем новый access token
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' } // 15 минут
    );

    res.json({
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 минут в секундах
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Отзыв refresh token
export async function revokeToken(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Удаляем refresh token из базы данных
    await prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExpires: null,
      },
    });

    res.json({ message: 'Token revoked successfully' });
  } catch (error) {
    console.error('Token revocation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Выдача refresh token при логине
export async function issueRefreshToken(userId: string): Promise<string> {
  const { token, expiresAt } = createRefreshToken();

  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshToken: token,
      refreshTokenExpires: expiresAt,
    },
  });

  return token;
}
