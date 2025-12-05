import { Request, Response } from 'express';
import { PhotoService } from '../services/PhotoService';
import { AppointmentRepository } from '../repositories/AppointmentRepository';
import { PhotoRepository } from '../repositories/PhotoRepository';
import { UploadAppointmentPhotosResponseSchema } from '../schemas/me';
import { AppointmentNotFoundError } from '../errors/BusinessErrors';
import { ForbiddenError } from '../errors/AppError';
import { logError } from '../utils/logger';

const photoService = new PhotoService(
  new PhotoRepository(),
  new AppointmentRepository()
);

/**
 * Загрузить фото к записи
 */
export async function uploadAppointmentPhotos(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: appointmentId } = req.params;
    if (!appointmentId) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const descriptions = req.body.description
      ? Array.isArray(req.body.description)
        ? req.body.description
        : [req.body.description]
      : [];

    const uploadedPhotos = await photoService.uploadAppointmentPhotos(
      appointmentId,
      userId,
      files,
      descriptions
    );

    const response = UploadAppointmentPhotosResponseSchema.parse({
      photos: uploadedPhotos,
    });

    return res.status(201).json(response);
  } catch (error) {
    logError('Ошибка загрузки фото записи', error);

    if (
      error instanceof AppointmentNotFoundError ||
      error instanceof ForbiddenError
    ) {
      const appError = error as AppointmentNotFoundError | ForbiddenError;
      return res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code,
      });
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to upload photos',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Удалить фото из записи
 */
export async function deleteAppointmentPhoto(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: appointmentId, photoId } = req.params;
    if (!appointmentId || !photoId) {
      return res.status(400).json({
        error: 'Appointment ID and Photo ID are required',
      });
    }

    await photoService.deleteAppointmentPhoto(appointmentId, photoId, userId);

    return res.status(204).send();
  } catch (error) {
    logError('Ошибка удаления фото записи', error);

    if (
      error instanceof AppointmentNotFoundError ||
      error instanceof ForbiddenError
    ) {
      const appError = error as AppointmentNotFoundError | ForbiddenError;
      return res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code,
      });
    }

    if (error instanceof Error && error.message === 'Photo not found') {
      return res.status(404).json({ error: error.message });
    }

    if (
      error instanceof Error &&
      error.message === 'Photo does not belong to this appointment'
    ) {
      return res.status(403).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to delete photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
