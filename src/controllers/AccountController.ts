import { Request, Response } from 'express';
import { AccountService } from '../services/AccountService';
import { UserRepository } from '../repositories/UserRepository';
import {
  ChangePasswordSchema,
  ChangePasswordResponseSchema,
  ChangeEmailSchema,
  ChangeEmailResponseSchema,
  ChangePhoneSchema,
  ChangePhoneResponseSchema,
} from '../schemas/me';
import { logError } from '../utils/logger';

const accountService = new AccountService(new UserRepository());

/**
 * Изменить пароль мастера
 */
export async function changePassword(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;

    const validatedData = ChangePasswordSchema.parse({
      currentPassword,
      newPassword,
    });

    const response = await accountService.changePassword(
      userId,
      validatedData.currentPassword,
      validatedData.newPassword
    );

    return res.json(ChangePasswordResponseSchema.parse(response));
  } catch (error) {
    logError('Ошибка изменения пароля', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }

    if (error instanceof Error && error.message === 'Invalid password') {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Текущий пароль неверен',
      });
    }

    return res.status(500).json({
      error: 'Failed to change password',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Изменить email мастера
 */
export async function changeEmail(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = ChangeEmailSchema.parse(req.body);
    const response = await accountService.changeEmail(
      userId,
      validatedData.newEmail,
      validatedData.password
    );

    return res.json(ChangeEmailResponseSchema.parse(response));
  } catch (error) {
    logError('Ошибка изменения email', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }

    if (error instanceof Error && error.message === 'Invalid password') {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Пароль неверен',
      });
    }

    if (error instanceof Error && error.message === 'Email already exists') {
      return res.status(400).json({
        error: 'Email already exists',
        message: 'Этот email уже используется другим пользователем',
      });
    }

    return res.status(500).json({
      error: 'Failed to change email',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Изменить телефон мастера
 */
export async function changePhone(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = ChangePhoneSchema.parse(req.body);
    const response = await accountService.changePhone(
      userId,
      validatedData.newPhone
    );

    return res.json(ChangePhoneResponseSchema.parse(response));
  } catch (error) {
    logError('Ошибка изменения телефона', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to change phone',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
