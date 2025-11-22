import { Request, Response } from 'express';
import prisma from '../prismaClient';
import {
  UpdateProfileSchema,
  MeResponseSchema,
  AppointmentsFilterSchema,
} from '../schemas/me';
import { Prisma } from '@prisma/client';

/**
 * GET /me
 * Получить полную информацию о текущем мастере со статистикой
 */
export async function getMe(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Получаем полную информацию о мастере
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        slug: true,
        phone: true,
        description: true,
        photoUrl: true,
        address: true,
        lat: true,
        lng: true,
        vkUrl: true,
        telegramUrl: true,
        whatsappUrl: true,
        backgroundImageUrl: true,
        rating: true,
        isActive: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Получаем статистику
    const [
      totalServices,
      activeServices,
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      totalClients,
    ] = await Promise.all([
      // Общее количество услуг
      prisma.service.count({
        where: { masterId: userId },
      }),
      // Активные услуги
      prisma.service.count({
        where: { masterId: userId, isActive: true },
      }),
      // Общее количество записей
      prisma.appointment.count({
        where: { masterId: userId },
      }),
      // Предстоящие записи (PENDING или CONFIRMED, startAt в будущем)
      prisma.appointment.count({
        where: {
          masterId: userId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: { gte: new Date() },
        },
      }),
      // Завершенные записи
      prisma.appointment.count({
        where: {
          masterId: userId,
          status: 'COMPLETED',
        },
      }),
      // Общее количество клиентов
      prisma.client.count({
        where: { masterId: userId },
      }),
    ]);

    // Формируем ответ
    const response = MeResponseSchema.parse({
      ...user,
      lat: user.lat ? Number(user.lat) : null,
      lng: user.lng ? Number(user.lng) : null,
      rating: user.rating ? Number(user.rating) : null,
      stats: {
        totalServices,
        activeServices,
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        totalClients,
      },
    });

    return res.json(response);
  } catch (error) {
    console.error('Error fetching me:', error);
    return res.status(500).json({
      error: 'Failed to fetch profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /me/profile
 * Обновить профиль мастера
 */
export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = UpdateProfileSchema.parse(req.body);

    // Обновляем профиль
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        email: true,
        name: true,
        slug: true,
        phone: true,
        description: true,
        photoUrl: true,
        address: true,
        lat: true,
        lng: true,
        vkUrl: true,
        telegramUrl: true,
        whatsappUrl: true,
        backgroundImageUrl: true,
        rating: true,
        isActive: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Получаем статистику для ответа
    const [
      totalServices,
      activeServices,
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      totalClients,
    ] = await Promise.all([
      prisma.service.count({ where: { masterId: userId } }),
      prisma.service.count({ where: { masterId: userId, isActive: true } }),
      prisma.appointment.count({ where: { masterId: userId } }),
      prisma.appointment.count({
        where: {
          masterId: userId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: { gte: new Date() },
        },
      }),
      prisma.appointment.count({
        where: { masterId: userId, status: 'COMPLETED' },
      }),
      prisma.client.count({ where: { masterId: userId } }),
    ]);

    const response = MeResponseSchema.parse({
      ...updatedUser,
      lat: updatedUser.lat ? Number(updatedUser.lat) : null,
      lng: updatedUser.lng ? Number(updatedUser.lng) : null,
      rating: updatedUser.rating ? Number(updatedUser.rating) : null,
      stats: {
        totalServices,
        activeServices,
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        totalClients,
      },
    });

    return res.json(response);
  } catch (error) {
    console.error('Error updating profile:', error);

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
 * GET /me/appointments
 * Получить записи мастера с фильтрами
 */
export async function getAppointments(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters = AppointmentsFilterSchema.parse(req.query);

    // Формируем условия фильтрации
    const where: Prisma.AppointmentWhereInput = { masterId: userId };

    // Фильтр по дате начала
    if (filters.dateFrom || filters.dateTo) {
      where.startAt = {};
      if (filters.dateFrom) {
        where.startAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.startAt.lte = new Date(filters.dateTo);
      }
    }

    // Фильтр по статусу
    if (filters.status) {
      where.status = filters.status;
    }

    // Фильтр по услуге
    if (filters.serviceId) {
      where.serviceId = filters.serviceId;
    }

    // Фильтр по клиенту
    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    // Получаем записи с связанными данными
    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
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
    });

    return res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch appointments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
