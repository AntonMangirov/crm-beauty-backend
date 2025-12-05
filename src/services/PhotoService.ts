import { Prisma } from '@prisma/client';
import { IPhotoRepository } from '../repositories/IPhotoRepository';
import { IAppointmentRepository } from '../repositories/IAppointmentRepository';
import { AppointmentNotFoundError } from '../errors/BusinessErrors';
import { ForbiddenError } from '../errors/AppError';
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from '../utils/cloudinary';

export class PhotoService {
  constructor(
    private photoRepository: IPhotoRepository,
    private appointmentRepository: IAppointmentRepository
  ) {}

  async uploadAppointmentPhotos(
    appointmentId: string,
    masterId: string,
    files: Express.Multer.File[],
    descriptions?: string[]
  ) {
    const appointment =
      await this.appointmentRepository.findById(appointmentId);

    if (!appointment) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    if (appointment.masterId !== masterId) {
      throw new ForbiddenError(
        'Appointment does not belong to the current user',
        'APPOINTMENT_ACCESS_DENIED'
      );
    }

    const uploadedPhotos = await Promise.all(
      files.map(async (file, index) => {
        const imageUrl = await uploadImageToCloudinary(
          file.buffer,
          `beauty-crm/appointments/${appointmentId}`
        );

        const description = descriptions?.[index] || descriptions?.[0] || null;
        const photo = await this.photoRepository.create({
          url: imageUrl,
          description: description || null,
          client: {
            connect: { id: appointment.clientId },
          },
          appointment: {
            connect: { id: appointmentId },
          },
          masterId: masterId,
        } as Prisma.PhotoCreateInput);

        return {
          id: photo.id,
          url: photo.url,
          description: photo.description,
          createdAt: photo.createdAt,
        };
      })
    );

    return uploadedPhotos;
  }

  async deleteAppointmentPhoto(
    appointmentId: string,
    photoId: string,
    masterId: string
  ) {
    const appointment =
      await this.appointmentRepository.findById(appointmentId);

    if (!appointment) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    if (appointment.masterId !== masterId) {
      throw new ForbiddenError(
        'Appointment does not belong to the current user',
        'APPOINTMENT_ACCESS_DENIED'
      );
    }

    const photo = await this.photoRepository.findById(photoId);

    if (!photo) {
      throw new Error('Photo not found');
    }

    if (photo.clientId !== appointment.clientId) {
      throw new Error('Photo does not belong to this appointment');
    }

    try {
      await deleteImageFromCloudinary(photo.url);
    } catch (_error) {
      // Логируем ошибку, но продолжаем удаление из БД
    }

    await this.photoRepository.delete(photoId);
  }
}
