import { AppointmentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import {
  IAppointmentRepository,
  AppointmentWithRelations,
  AppointmentFilters,
} from './IAppointmentRepository';

export class AppointmentRepository implements IAppointmentRepository {
  async findById(id: string) {
    return prisma.appointment.findUnique({
      where: { id },
    });
  }

  async findByIdWithRelations(
    id: string
  ): Promise<AppointmentWithRelations | null> {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            telegramUsername: true,
            email: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMin: true,
          },
        },
      },
    }) as Promise<AppointmentWithRelations | null>;
  }

  async findMany(
    filters: AppointmentFilters
  ): Promise<AppointmentWithRelations[]> {
    const where: Prisma.AppointmentWhereInput = { masterId: filters.masterId };

    if (filters.from || filters.to) {
      where.startAt = {};
      if (filters.from) {
        where.startAt.gte = filters.from;
      }
      if (filters.to) {
        where.startAt.lte = filters.to;
      }
    }

    if (filters.status) {
      where.status = filters.status as AppointmentStatus;
    }

    if (filters.serviceId) {
      where.serviceId = filters.serviceId;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    return prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            telegramUsername: true,
            email: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMin: true,
          },
        },
      },
      orderBy: { startAt: 'desc' },
    }) as Promise<AppointmentWithRelations[]>;
  }

  async findLastManual(masterId: string, limit: number) {
    return prisma.appointment.findMany({
      where: {
        masterId,
        source: {
          in: ['MANUAL', 'PHONE'],
        },
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMin: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  async update(id: string, data: Prisma.AppointmentUpdateInput) {
    return prisma.appointment.update({
      where: { id },
      data,
    });
  }

  async findOverlapping(
    masterId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string
  ) {
    const where: Prisma.AppointmentWhereInput = {
      masterId,
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        { startAt: { lte: startAt }, endAt: { gt: startAt } },
        { startAt: { lt: endAt }, endAt: { gte: endAt } },
        { startAt: { gte: startAt }, endAt: { lte: endAt } },
      ],
    };

    return prisma.appointment.findFirst({
      where,
    });
  }
}
