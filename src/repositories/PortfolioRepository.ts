import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { IPortfolioRepository } from './IPortfolioRepository';

export class PortfolioRepository implements IPortfolioRepository {
  async findByMasterId(masterId: string) {
    return prisma.portfolioPhoto.findMany({
      where: { masterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.PortfolioPhotoCreateInput) {
    return prisma.portfolioPhoto.create({
      data,
    });
  }

  async findById(id: string) {
    return prisma.portfolioPhoto.findUnique({
      where: { id },
    });
  }

  async delete(id: string) {
    await prisma.portfolioPhoto.delete({
      where: { id },
    });
  }
}
