import prisma from '../prismaClient';
import { IServiceRepository, ServiceStats } from './IServiceRepository';

export class ServiceRepository implements IServiceRepository {
  async getTopServices(
    masterId: string,
    startDate: Date,
    limit: number
  ): Promise<ServiceStats[]> {
    const serviceStats = await prisma.appointment.groupBy({
      by: ['serviceId'],
      where: {
        masterId,
        createdAt: {
          gte: startDate,
        },
        status: {
          notIn: ['CANCELED', 'NO_SHOW'],
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    const serviceIds = serviceStats.map(stat => stat.serviceId);
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        masterId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        durationMin: true,
      },
    });

    const servicesMap = new Map(
      services.map(s => [
        s.id,
        { name: s.name, price: s.price, durationMin: s.durationMin },
      ])
    );

    return serviceStats
      .map(stat => {
        const service = servicesMap.get(stat.serviceId);
        if (!service) return null;
        return {
          id: stat.serviceId,
          name: service.name,
          price: service.price,
          durationMin: service.durationMin,
          count: Number(stat._count.id),
        };
      })
      .filter((item): item is ServiceStats => item !== null);
  }
}
