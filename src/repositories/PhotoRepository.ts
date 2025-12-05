import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { IPhotoRepository } from './IPhotoRepository';

export class PhotoRepository implements IPhotoRepository {
  async findByClientId(clientId: string) {
    return prisma.photo.findMany({
      where: { clientId },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findByClientIds(clientIds: string[]) {
    return prisma.photo.findMany({
      where: {
        clientId: { in: clientIds },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async create(data: Prisma.PhotoCreateInput) {
    return prisma.photo.create({
      data,
    });
  }

  async findById(id: string) {
    return prisma.photo.findUnique({
      where: { id },
    });
  }

  async delete(id: string) {
    await prisma.photo.delete({
      where: { id },
    });
  }
}
