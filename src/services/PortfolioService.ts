import { Prisma } from '@prisma/client';
import { IPortfolioRepository } from '../repositories/IPortfolioRepository';
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from '../utils/cloudinary';

export class PortfolioService {
  constructor(private portfolioRepository: IPortfolioRepository) {}

  async getPortfolio(masterId: string) {
    const photos = await this.portfolioRepository.findByMasterId(masterId);

    return {
      photos: photos.map(photo => ({
        ...photo,
        createdAt: photo.createdAt.toISOString(),
      })),
    };
  }

  async uploadPhoto(
    masterId: string,
    file: Express.Multer.File,
    description?: string
  ) {
    const imageUrl = await uploadImageToCloudinary(
      file.buffer,
      `beauty-crm/portfolio/${masterId}`
    );

    const photo = await this.portfolioRepository.create({
      url: imageUrl,
      description: description || null,
      master: {
        connect: { id: masterId },
      },
    } as Prisma.PortfolioPhotoCreateInput);

    return {
      photo: {
        ...photo,
        createdAt: photo.createdAt.toISOString(),
      },
    };
  }

  async deletePhoto(photoId: string, masterId: string) {
    const photo = await this.portfolioRepository.findById(photoId);

    if (!photo) {
      throw new Error('Photo not found');
    }

    if (photo.masterId !== masterId) {
      throw new Error('Photo does not belong to the current user');
    }

    try {
      await deleteImageFromCloudinary(photo.url);
    } catch (_error) {
      // Логируем ошибку, но продолжаем удаление из БД
    }

    await this.portfolioRepository.delete(photoId);
  }
}
