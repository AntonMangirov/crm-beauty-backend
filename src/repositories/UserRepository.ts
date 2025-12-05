import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { IUserRepository } from './IUserRepository';

export class UserRepository implements IUserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findBySlug(slug: string) {
    return prisma.user.findUnique({
      where: { slug },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async getStats(masterId: string) {
    const [
      totalServices,
      activeServices,
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      totalClients,
    ] = await Promise.all([
      prisma.service.count({
        where: { masterId },
      }),
      prisma.service.count({
        where: { masterId, isActive: true },
      }),
      prisma.appointment.count({
        where: { masterId },
      }),
      prisma.appointment.count({
        where: {
          masterId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: { gte: new Date() },
        },
      }),
      prisma.appointment.count({
        where: {
          masterId,
          status: 'COMPLETED',
        },
      }),
      prisma.client.count({
        where: { masterId },
      }),
    ]);

    return {
      totalServices,
      activeServices,
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      totalClients,
    };
  }
}
