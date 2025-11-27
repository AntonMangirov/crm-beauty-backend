import { Request, Response } from 'express';
import prisma from '../prismaClient';
import jwt from 'jsonwebtoken';
import { slugifyName } from '../utils/slug';
import {
  RegisterRequestSchema,
  RegisterResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  PasswordResetRequestSchema,
  PasswordResetRequestResponseSchema,
  PasswordResetVerifySchema,
  PasswordResetVerifyResponseSchema,
  PasswordResetSchema,
  PasswordResetResponseSchema,
} from '../schemas/auth';
import { hashPassword, verifyPassword } from '../utils/password';
import { logError } from '../utils/logger';
import { verifyCaptcha } from '../utils/recaptcha';
import {
  issueRefreshToken,
  getRefreshTokenCookieOptions,
} from './refreshController';
import {
  generateResetCode,
  generateResetToken,
  sendResetCode,
} from '../utils/passwordReset';
import { PasswordResetType } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, phone, recaptchaToken } =
      RegisterRequestSchema.parse(req.body);
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: 'email, password and name are required' });
    }

    // Проверка reCAPTCHA
    if (recaptchaToken) {
      const isCaptchaValid = await verifyCaptcha(recaptchaToken);
      if (!isCaptchaValid) {
        return res.status(400).json({
          error: 'reCAPTCHA verification failed',
          message:
            'Проверка на бота не пройдена. Пожалуйста, попробуйте снова.',
        });
      }
    } else {
      // В production капча обязательна
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          error: 'reCAPTCHA token required',
          message: 'Токен reCAPTCHA обязателен',
        });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const passwordHash = await hashPassword(password);

    const baseSlug = slugifyName(name);
    let slug = '';
    let attempts = 0;
    while (attempts < 20) {
      const suffix = String(Math.floor(100 + Math.random() * 900));
      const candidate = `${baseSlug}-${suffix}`;
      const exists = await prisma.user.findUnique({
        where: { slug: candidate },
      });
      if (!exists) {
        slug = candidate;
        break;
      }
      attempts += 1;
    }

    if (!slug) {
      slug = `${baseSlug}-${Date.now().toString().slice(-3)}`;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        slug,
      },
    });

    const response = RegisterResponseSchema.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      slug: user.slug,
      phone: user.phone,
    });
    return res.status(201).json(response);
  } catch (err) {
    logError('Ошибка регистрации', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = LoginRequestSchema.parse(req.body);
    if (!email || !password)
      return res.status(400).json({ error: 'email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Создаем access token (15 минут)
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );

    // Создаем и сохраняем refresh token
    const { token: refreshToken } = await issueRefreshToken(user.id);

    // Устанавливаем refresh token в HttpOnly cookie
    res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

    const response = LoginResponseSchema.parse({ token: accessToken });
    return res.json(response);
  } catch (err) {
    logError('Ошибка входа', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        slug: true,
        description: true,
        photoUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    logError('Ошибка получения профиля', err);
    return res.status(500).json({
      error: 'Server error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Запрос восстановления пароля
 * Отправляет код восстановления на email или телефон
 */
export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const { email, phone, recaptchaToken } = PasswordResetRequestSchema.parse(
      req.body
    );

    // Проверка reCAPTCHA
    if (recaptchaToken) {
      const isCaptchaValid = await verifyCaptcha(recaptchaToken);
      if (!isCaptchaValid) {
        return res.status(400).json({
          error: 'reCAPTCHA verification failed',
          message:
            'Проверка на бота не пройдена. Пожалуйста, попробуйте снова.',
        });
      }
    } else {
      // В production капча обязательна
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          error: 'reCAPTCHA token required',
          message: 'Токен reCAPTCHA обязателен',
        });
      }
    }

    // Ищем пользователя по email или телефону
    let user = null;
    let resetType: PasswordResetType | null = null;
    let destination = '';

    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
      resetType = 'EMAIL';
      destination = email;
    } else if (phone) {
      // Нормализуем телефон для поиска
      const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      user = await prisma.user.findFirst({
        where: { phone: normalizedPhone },
      });
      resetType = 'PHONE';
      destination = normalizedPhone;
    }

    // Для безопасности не сообщаем, существует ли пользователь
    // Всегда возвращаем успешный ответ
    if (!user) {
      // Имитируем задержку отправки для безопасности
      await new Promise(resolve => setTimeout(resolve, 500));
      return res.json(
        PasswordResetRequestResponseSchema.parse({
          success: true,
          message:
            'Если указанный email или телефон зарегистрирован, на него будет отправлен код восстановления.',
        })
      );
    }

    // Генерируем код и токен
    const code = generateResetCode();
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

    // Инвалидируем старые токены для этого пользователя
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Создаем новый токен восстановления
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        code,
        type: resetType!,
        expiresAt,
      },
    });

    // Отправляем код (заглушка)
    const sent = await sendResetCode(resetType!, destination, code);
    if (!sent) {
      logError('Не удалось отправить код восстановления', null, {
        userId: user.id,
        type: resetType,
        destination,
      });
      // В production можно вернуть ошибку, но для безопасности лучше не раскрывать детали
    }

    // Токен всегда возвращается для следующего шага верификации
    // Код показывается только в режиме разработки для тестирования
    const response: any = {
      success: true,
      message:
        'Код восстановления отправлен. Проверьте вашу почту или телефон.',
      resetToken: token, // Токен нужен для следующего шага
    };

    if (process.env.NODE_ENV !== 'production') {
      response.code = code; // Только для разработки - код выводится в консоль
    }

    return res.json(PasswordResetRequestResponseSchema.parse(response));
  } catch (err) {
    logError('Ошибка запроса восстановления пароля', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Проверка кода восстановления пароля
 */
export async function verifyPasswordResetCode(req: Request, res: Response) {
  try {
    const { resetToken, code } = PasswordResetVerifySchema.parse(req.body);

    // Ищем токен восстановления
    const resetTokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token: resetToken },
      include: { user: true },
    });

    if (!resetTokenRecord) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Неверный токен восстановления',
      });
    }

    // Проверяем, не использован ли токен
    if (resetTokenRecord.used) {
      return res.status(400).json({
        error: 'Token already used',
        message: 'Токен восстановления уже использован',
      });
    }

    // Проверяем срок действия
    if (resetTokenRecord.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'Token expired',
        message: 'Срок действия кода истек. Запросите новый код.',
      });
    }

    // Проверяем код
    if (resetTokenRecord.code !== code) {
      return res.status(400).json({
        error: 'Invalid code',
        message: 'Неверный код подтверждения',
      });
    }

    // Генерируем новый токен для сброса пароля
    const verifiedToken = generateResetToken();

    // Обновляем токен, помечая его как использованный
    await prisma.passwordResetToken.update({
      where: { id: resetTokenRecord.id },
      data: { used: true },
    });

    // Создаем новый токен для сброса пароля
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 минут
    await prisma.passwordResetToken.create({
      data: {
        userId: resetTokenRecord.userId,
        token: verifiedToken,
        code: '', // Код больше не нужен
        type: resetTokenRecord.type,
        expiresAt,
      },
    });

    return res.json(
      PasswordResetVerifyResponseSchema.parse({
        success: true,
        message: 'Код подтвержден. Теперь вы можете установить новый пароль.',
        verifiedToken,
      })
    );
  } catch (err) {
    logError('Ошибка проверки кода восстановления пароля', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Сброс пароля с новым паролем
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const { verifiedToken, newPassword } = PasswordResetSchema.parse(req.body);

    // Ищем токен восстановления
    const resetTokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token: verifiedToken },
      include: { user: true },
    });

    if (!resetTokenRecord) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Неверный токен восстановления',
      });
    }

    // Проверяем, не использован ли токен
    if (resetTokenRecord.used) {
      return res.status(400).json({
        error: 'Token already used',
        message: 'Токен восстановления уже использован',
      });
    }

    // Проверяем срок действия
    if (resetTokenRecord.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'Token expired',
        message: 'Срок действия токена истек. Запросите новый код.',
      });
    }

    // Хешируем новый пароль
    const passwordHash = await hashPassword(newPassword);

    // Обновляем пароль пользователя
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetTokenRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetTokenRecord.id },
        data: { used: true },
      }),
    ]);

    // Инвалидируем все остальные токены восстановления для этого пользователя
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: resetTokenRecord.userId,
        used: false,
      },
      data: {
        used: true,
      },
    });

    return res.json(
      PasswordResetResponseSchema.parse({
        success: true,
        message:
          'Пароль успешно изменен. Теперь вы можете войти с новым паролем.',
      })
    );
  } catch (err) {
    logError('Ошибка сброса пароля', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
