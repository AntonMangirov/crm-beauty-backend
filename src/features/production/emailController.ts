/**
 * 📧 EMAIL CONTROLLER
 *
 * Назначение: Управление email верификацией и сбросом пароля
 *
 * Функции:
 * - sendEmailVerification(): Отправка письма подтверждения email
 * - verifyEmail(): Подтверждение email по токену
 * - requestPasswordReset(): Запрос сброса пароля
 * - resetPassword(): Сброс пароля по токену
 *
 * API эндпоинты:
 * - POST /api/auth/send-verification - отправка письма
 * - GET /api/auth/verify-email/:token - подтверждение email
 * - POST /api/auth/forgot-password - запрос сброса
 * - POST /api/auth/reset-password/:token - сброс пароля
 *
 * Требует обновления схемы БД:
 * - emailVerifyToken String? @unique
 * - passwordResetToken String? @unique
 * - passwordResetExpires DateTime?
 *
 * Когда использовать:
 * - При необходимости подтверждения email
 * - При реализации сброса пароля
 * - При интеграции с email сервисом
 *
 * Перенос: src/controllers/emailController.ts
 */

import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { generateEmailVerifyToken, createPasswordResetToken } from './tokens';
import { logError } from '../utils/logger';

// Расширяем тип Request для добавления user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

// Отправка письма подтверждения email
export async function sendEmailVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Генерируем токен подтверждения
    const emailVerifyToken = generateEmailVerifyToken();

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken },
    });

    // TODO: Здесь должна быть отправка реального email
    // Пока возвращаем токен для тестирования
    res.json({
      message: 'Verification email sent',
      token: emailVerifyToken,
    });
  } catch (error) {
    logError('Ошибка отправки верификации email', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Подтверждение email
export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.params;

    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
      },
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logError('Ошибка подтверждения email', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Запрос сброса пароля
export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Не раскрываем, существует ли пользователь
      return res.json({ message: 'If email exists, reset instructions sent' });
    }

    // Создаем токен сброса пароля
    const { token, expiresAt } = createPasswordResetToken();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      },
    });

    // TODO: Здесь должна быть отправка реального email
    // Пока возвращаем токен для тестирования
    res.json({
      message: 'If email exists, reset instructions sent',
      token,
    });
  } catch (error) {
    logError('Ошибка запроса сброса пароля', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Сброс пароля
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user || !user.passwordResetExpires) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Проверяем, не истек ли токен
    if (new Date() > user.passwordResetExpires) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Хешируем новый пароль
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logError('Ошибка сброса пароля', error);
    res.status(500).json({ error: 'Server error' });
  }
}
