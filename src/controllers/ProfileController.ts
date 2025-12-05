import { Request, Response } from 'express';
import { ProfileService } from '../services/ProfileService';
import { UserRepository } from '../repositories/UserRepository';
import { UpdateProfileSchema, MeResponseSchema } from '../schemas/me';
import { logError } from '../utils/logger';
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from '../utils/cloudinary';
import prisma from '../prismaClient';

const profileService = new ProfileService(new UserRepository());

/**
 * Получить полную информацию о текущем мастере со статистикой
 */
export async function getMe(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await profileService.getProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const response = MeResponseSchema.parse(profile);
    return res.json(response);
  } catch (error) {
    logError('Ошибка получения профиля', error);
    return res.status(500).json({
      error: 'Failed to fetch profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Обновить профиль мастера
 */
export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = UpdateProfileSchema.parse(req.body);
    const updatedProfile = await profileService.updateProfile(
      userId,
      validatedData
    );

    const response = MeResponseSchema.parse(updatedProfile);
    return res.json(response);
  } catch (error) {
    logError('Ошибка обновления профиля', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to update profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Загрузить фото профиля в Cloudinary
 */
export async function uploadPhoto(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { photoUrl: true },
    });

    const imageUrl = await uploadImageToCloudinary(
      req.file.buffer,
      'beauty-crm/profiles'
    );

    if (currentUser?.photoUrl) {
      try {
        await deleteImageFromCloudinary(currentUser.photoUrl);
      } catch (error) {
        logError('Ошибка удаления старого фото', error);
      }
    }

    const updatedProfile = await profileService.updateProfile(userId, {
      photoUrl: imageUrl,
    });

    const response = MeResponseSchema.parse(updatedProfile);
    return res.json(response);
  } catch (error) {
    logError('Ошибка загрузки фото', error);
    return res.status(500).json({
      error: 'Failed to upload photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
