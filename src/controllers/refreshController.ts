import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';
import { createRefreshToken } from '../features/production/tokens';
import { logError } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

// Константы для cookie
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS только в продакшене
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_MAX_AGE,
  path: '/',
};

/**
 * Обновление access token с помощью refresh token из cookie
 * POST /api/auth/refresh
 */
export async function refreshToken(req: Request, res: Response) {
  try {
    // Получаем refresh token из cookie
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    // Находим пользователя по refresh token
    const user = await prisma.user.findUnique({
      where: { refreshToken },
    });

    if (!user || !user.refreshTokenExpires) {
      // Очищаем cookie если токен невалидный
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Проверяем, не истек ли refresh token
    if (new Date() > user.refreshTokenExpires) {
      // Очищаем cookie и удаляем токен из БД
      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: null,
          refreshTokenExpires: null,
        },
      });
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
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
    logError('Ошибка обновления токена', error);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Logout - отзыв refresh token и очистка cookie
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response) {
  try {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

    if (refreshToken) {
      // Находим пользователя и удаляем refresh token из БД
      const user = await prisma.user.findUnique({
        where: { refreshToken },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            refreshToken: null,
            refreshTokenExpires: null,
          },
        });
      }
    }

    // Очищаем cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logError('Ошибка выхода', error);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Выдача refresh token при логине
 * Сохраняет токен в БД и возвращает его для установки в cookie
 */
export async function issueRefreshToken(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const { token, expiresAt } = createRefreshToken();

  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshToken: token,
      refreshTokenExpires: expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Получить опции для установки refresh token cookie
 */
export function getRefreshTokenCookieOptions() {
  return COOKIE_OPTIONS;
}
