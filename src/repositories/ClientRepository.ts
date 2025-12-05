import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import {
  IClientRepository,
  ClientWithStats,
  ClientFilters,
} from './IClientRepository';

export class ClientRepository implements IClientRepository {
  async findById(id: string) {
    return prisma.client.findUnique({
      where: { id },
    });
  }

  async findByIdWithMaster(id: string, masterId: string) {
    return prisma.client.findFirst({
      where: {
        id,
        masterId,
      },
    });
  }

  async findMany(filters: ClientFilters): Promise<ClientWithStats[]> {
    const whereClause: Prisma.ClientWhereInput = {
      masterId: filters.masterId,
      isActive: true,
    };

    if (filters.name && filters.name.trim()) {
      whereClause.name = {
        contains: filters.name.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.phone && filters.phone.trim()) {
      const phoneDigits = filters.phone.trim().replace(/[^\d+]/g, '');
      const telegramSearch = filters.phone.trim().replace(/^@/, '');
      whereClause.OR = [
        {
          phone: {
            contains: phoneDigits,
          },
        },
        {
          telegramUsername: {
            contains: telegramSearch,
            mode: 'insensitive',
          },
        },
      ];
    }

    return prisma.client.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phone: true,
        telegramUsername: true,
        notes: true,
        appointments: {
          where: {
            masterId: filters.masterId,
            status: 'COMPLETED',
          },
          select: {
            startAt: true,
          },
          orderBy: {
            startAt: 'desc',
          },
        },
        _count: {
          select: {
            photos: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    }) as Promise<ClientWithStats[]>;
  }

  async update(id: string, data: Prisma.ClientUpdateInput) {
    return prisma.client.update({
      where: { id },
      data,
    });
  }

  async getHistory(clientId: string, masterId: string) {
    return prisma.appointment.findMany({
      where: {
        clientId,
        masterId,
      },
      select: {
        id: true,
        startAt: true,
        status: true,
        serviceId: true,
        serviceName: true,
        serviceDuration: true,
        servicePrice: true,
        price: true,
        service: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
      orderBy: {
        startAt: 'desc',
      },
    });
  }
}
