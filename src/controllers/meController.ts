import { Request, Response } from 'express';
import prisma from '../prismaClient';
import {
  UpdateProfileSchema,
  MeResponseSchema,
  AppointmentsFilterSchema,
  UpdateAppointmentStatusSchema,
  ClientListItemSchema,
  ClientHistoryResponseSchema,
  UploadAppointmentPhotosResponseSchema,
  AnalyticsResponseSchema,
} from '../schemas/me';
import { Prisma } from '@prisma/client';
import { geocodeAndCache } from '../utils/geocoding';
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from '../utils/cloudinary';
import { AppointmentNotFoundError } from '../errors/BusinessErrors';
import { ForbiddenError } from '../errors/AppError';
import { logError } from '../utils/logger';

/**
 * Получить полную информацию о текущем мастере со статистикой
 */
export async function getMe(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    const [
      totalServices,
      activeServices,
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      totalClients,
    ] = await Promise.all([
      prisma.service.count({
        where: { masterId: userId },
      }),
      prisma.service.count({
        where: { masterId: userId, isActive: true },
      }),
      prisma.appointment.count({
        where: { masterId: userId },
      }),
      prisma.appointment.count({
        where: {
          masterId: userId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: { gte: new Date() },
        },
      }),
      prisma.appointment.count({
        where: {
          masterId: userId,
          status: 'COMPLETED',
        },
      }),
      prisma.client.count({
        where: { masterId: userId },
      }),
    ]);
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
    logError('Ошибка получения профиля', error);
    return res.status(500).json({
      error: 'Failed to fetch profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Обновить профиль мастера
 * При обновлении address автоматически получаются координаты через геокодинг
 */
export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = UpdateProfileSchema.parse(req.body);
    const updateData: Prisma.UserUpdateInput = {};

    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }

    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    if (validatedData.photoUrl !== undefined) {
      updateData.photoUrl = validatedData.photoUrl;
    }

    // При обновлении адреса автоматически получаем координаты через геокодинг
    if (validatedData.address !== undefined) {
      updateData.address = validatedData.address;

      if (validatedData.address) {
        const coordinates = await geocodeAndCache(
          prisma,
          userId,
          validatedData.address
        );

        if (coordinates) {
          updateData.lat = coordinates.lat;
          updateData.lng = coordinates.lng;
        } else {
          updateData.lat = null;
          updateData.lng = null;
        }
      } else {
        updateData.lat = null;
        updateData.lng = null;
      }
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
    logError('Ошибка обновления профиля', error);

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
 * Получить записи мастера с фильтрами
 */
export async function getAppointments(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters = AppointmentsFilterSchema.parse(req.query);
    const where: Prisma.AppointmentWhereInput = { masterId: userId };

    const dateFrom = filters.from || filters.dateFrom;
    const dateTo = filters.to || filters.dateTo;

    if (dateFrom || dateTo) {
      where.startAt = {};
      if (dateFrom) {
        where.startAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.startAt.lte = new Date(dateTo);
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.serviceId) {
      where.serviceId = filters.serviceId;
    }

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

    // Получаем все фото для клиентов из записей
    const clientIds = [...new Set(appointments.map(apt => apt.clientId))];
    const allPhotos = await prisma.photo.findMany({
      where: {
        clientId: { in: clientIds },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Привязываем фото к записям по дате создания
    const appointmentsWithPhotos = appointments.map((appointment, index) => {
      const appointmentDate = new Date(appointment.startAt);
      appointmentDate.setHours(0, 0, 0, 0);

      const nextAppointment = appointments[index + 1];
      const periodEnd = nextAppointment
        ? new Date(nextAppointment.startAt)
        : new Date();

      const relatedPhotos = allPhotos
        .filter(photo => {
          const photoDate = new Date(photo.createdAt);
          return (
            photo.clientId === appointment.clientId &&
            photoDate >= appointmentDate &&
            photoDate <= periodEnd
          );
        })
        .map(photo => ({
          id: photo.id,
          url: photo.url,
          description: photo.description,
          createdAt: photo.createdAt,
        }));

      return {
        id: appointment.id,
        masterId: appointment.masterId,
        clientId: appointment.clientId,
        serviceId: appointment.serviceId,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        status: appointment.status,
        source: appointment.source,
        notes: appointment.notes,
        price: appointment.price ? Number(appointment.price) : null,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
        client: appointment.client,
        service: {
          ...appointment.service,
          price: Number(appointment.service.price),
        },
        photos: relatedPhotos,
      };
    });

    return res.json(appointmentsWithPhotos);
  } catch (error) {
    logError('Ошибка получения записей', error);

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

/**
 * Загрузить фото профиля в Cloudinary
 */
export async function uploadPhoto(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { photoUrl: true },
    });

    const imageUrl = await uploadImageToCloudinary(
      req.file.buffer,
      'beauty-crm/profiles'
    );

    if (currentUser?.photoUrl) {
      try {
        await deleteImageFromCloudinary(currentUser.photoUrl);
      } catch (error) {
        logError('Ошибка удаления старого фото', error);
      }
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { photoUrl: imageUrl },
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
    logError('Ошибка загрузки фото', error);
    return res.status(500).json({
      error: 'Failed to upload photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Обновить статус записи
 */
export async function updateAppointmentStatus(req: Request, res: Response) {
  try {
    const masterId = req.user?.id;
    if (!masterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const validatedData = UpdateAppointmentStatusSchema.parse(req.body);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      const notFoundError = new AppointmentNotFoundError(id);
      return res.status(notFoundError.statusCode).json({
        error: notFoundError.message,
        code: notFoundError.code,
      });
    }

    if (appointment.masterId !== masterId) {
      const forbiddenError = new ForbiddenError(
        'Appointment does not belong to the current user',
        'APPOINTMENT_ACCESS_DENIED'
      );
      return res.status(forbiddenError.statusCode).json({
        error: forbiddenError.message,
        code: forbiddenError.code,
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: validatedData.status },
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
    });

    const response = {
      id: updatedAppointment.id,
      masterId: updatedAppointment.masterId,
      clientId: updatedAppointment.clientId,
      serviceId: updatedAppointment.serviceId,
      startAt: updatedAppointment.startAt,
      endAt: updatedAppointment.endAt,
      status: updatedAppointment.status,
      source: updatedAppointment.source,
      notes: updatedAppointment.notes,
      price: updatedAppointment.price ? Number(updatedAppointment.price) : null,
      createdAt: updatedAppointment.createdAt,
      updatedAt: updatedAppointment.updatedAt,
      client: updatedAppointment.client,
      service: {
        ...updatedAppointment.service,
        price: Number(updatedAppointment.service.price),
      },
    };

    return res.json(response);
  } catch (error) {
    logError('Ошибка обновления статуса записи', error);

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
      error: 'Failed to update appointment status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Получить список клиентов мастера с информацией о посещениях
 */
export async function getClients(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const clients = await prisma.client.findMany({
      where: {
        masterId: userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        appointments: {
          where: {
            masterId: userId,
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
    });
    const clientsWithStats = clients.map(client => {
      const lastVisit =
        client.appointments.length > 0 ? client.appointments[0].startAt : null;
      const visitsCount = client.appointments.length;
      const photosCount = client._count.photos;

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        lastVisit,
        visitsCount,
        photosCount,
      };
    });

    const response = clientsWithStats.map(client =>
      ClientListItemSchema.parse(client)
    );

    return res.json(response);
  } catch (error) {
    logError('Ошибка получения клиентов', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch clients',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Получить историю посещений клиента
 */
export async function getClientHistory(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: clientId } = req.params;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        masterId: userId,
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        clientId,
        masterId: userId,
      },
      include: {
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
    const allPhotos = await prisma.photo.findMany({
      where: {
        clientId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Привязываем фото к записям по дате создания: фото относится к записи,
    // если оно создано в день записи или после неё, но до следующей записи
    const historyItems = appointments.map((appointment, index) => {
      const appointmentDate = new Date(appointment.startAt);
      appointmentDate.setHours(0, 0, 0, 0);

      const nextAppointment = appointments[index + 1];
      const periodEnd = nextAppointment
        ? new Date(nextAppointment.startAt)
        : new Date();
      const relatedPhotos = allPhotos
        .filter(photo => {
          const photoDate = new Date(photo.createdAt);
          return photoDate >= appointmentDate && photoDate <= periodEnd;
        })
        .map(photo => ({
          id: photo.id,
          url: photo.url,
          description: photo.description,
          createdAt: photo.createdAt,
        }));

      return {
        id: appointment.id,
        date: appointment.startAt,
        service: {
          id: appointment.service.id,
          name: appointment.service.name,
          price: Number(appointment.service.price),
        },
        status: appointment.status,
        photos: relatedPhotos,
      };
    });

    const response = ClientHistoryResponseSchema.parse(historyItems);

    return res.json(response);
  } catch (error) {
    logError('Ошибка получения истории клиента', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch client history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

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

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        masterId: true,
        clientId: true,
      },
    });

    if (!appointment) {
      const notFoundError = new AppointmentNotFoundError(appointmentId);
      return res.status(notFoundError.statusCode).json({
        error: notFoundError.message,
        code: notFoundError.code,
      });
    }

    if (appointment.masterId !== userId) {
      const forbiddenError = new ForbiddenError(
        'Appointment does not belong to the current user',
        'APPOINTMENT_ACCESS_DENIED'
      );
      return res.status(forbiddenError.statusCode).json({
        error: forbiddenError.message,
        code: forbiddenError.code,
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Описание может быть строкой (применяется ко всем фото) или массивом строк (по порядку)
    const descriptions = req.body.description
      ? Array.isArray(req.body.description)
        ? req.body.description
        : [req.body.description]
      : [];

    const uploadedPhotos = await Promise.all(
      files.map(async (file, index) => {
        const imageUrl = await uploadImageToCloudinary(
          file.buffer,
          `beauty-crm/appointments/${appointmentId}`
        );

        const description = descriptions[index] || descriptions[0] || null;
        const photo = await prisma.photo.create({
          data: {
            clientId: appointment.clientId,
            url: imageUrl,
            description: description || null,
          },
        });

        return {
          id: photo.id,
          url: photo.url,
          description: photo.description,
          createdAt: photo.createdAt,
        };
      })
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

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        masterId: true,
        clientId: true,
      },
    });

    if (!appointment) {
      const notFoundError = new AppointmentNotFoundError(appointmentId);
      return res.status(notFoundError.statusCode).json({
        error: notFoundError.message,
        code: notFoundError.code,
      });
    }

    if (appointment.masterId !== userId) {
      const forbiddenError = new ForbiddenError(
        'Appointment does not belong to the current user',
        'APPOINTMENT_ACCESS_DENIED'
      );
      return res.status(forbiddenError.statusCode).json({
        error: forbiddenError.message,
        code: forbiddenError.code,
      });
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        clientId: true,
        url: true,
      },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (photo.clientId !== appointment.clientId) {
      return res.status(403).json({
        error: 'Photo does not belong to this appointment',
      });
    }

    try {
      await deleteImageFromCloudinary(photo.url);
    } catch (error) {
      logError('Ошибка удаления фото из Cloudinary', error);
    }
    await prisma.photo.delete({
      where: { id: photoId },
    });

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

    return res.status(500).json({
      error: 'Failed to delete photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Получить аналитику за текущий месяц
 * Подсчёты выполняются на уровне SQL
 */
export async function getAnalytics(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Определяем начало и конец текущего месяца
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setUTCHours(23, 59, 59, 999);

    // Выполняем все запросы параллельно для оптимизации
    const [
      appointmentsCountResult,
      revenueResult,
      topServicesResult,
      newClientsStatsResult,
    ] = await Promise.all([
      // Количество записей за месяц
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int as count
        FROM "Appointment"
        WHERE "masterId" = ${userId}
          AND "startAt" >= ${startOfMonth}
          AND "startAt" <= ${endOfMonth}
      `,
      // Доход за месяц (сумма цен завершённых записей)
      prisma.$queryRaw<Array<{ revenue: number | null }>>`
        SELECT COALESCE(SUM("price"), 0)::decimal as revenue
        FROM "Appointment"
        WHERE "masterId" = ${userId}
          AND "status" = 'COMPLETED'
          AND "startAt" >= ${startOfMonth}
          AND "startAt" <= ${endOfMonth}
      `,
      // Топ 5 услуг по количеству записей
      prisma.$queryRaw<Array<{ id: string; name: string; count: bigint }>>`
        SELECT 
          s."id",
          s."name",
          COUNT(a."id")::int as count
        FROM "Service" s
        INNER JOIN "Appointment" a ON s."id" = a."serviceId"
        WHERE s."masterId" = ${userId}
          AND s."isActive" = true
          AND a."masterId" = ${userId}
          AND a."startAt" >= ${startOfMonth}
          AND a."startAt" <= ${endOfMonth}
        GROUP BY s."id", s."name"
        ORDER BY count DESC, s."name" ASC
        LIMIT 5
      `,
      // Статистика новых клиентов
      prisma.$queryRaw<Array<{ new_clients: bigint; total_clients: bigint }>>`
        SELECT 
          COUNT(CASE WHEN "createdAt" >= ${startOfMonth} AND "createdAt" <= ${endOfMonth} THEN 1 END)::int as new_clients,
          COUNT(*)::int as total_clients
        FROM "Client"
        WHERE "masterId" = ${userId}
          AND "isActive" = true
      `,
    ]);

    const appointmentsCount = appointmentsCountResult[0]?.count ?? BigInt(0);
    const revenueRaw = revenueResult[0]?.revenue ?? 0;
    const newClients = newClientsStatsResult[0]?.new_clients ?? BigInt(0);
    const totalClients = newClientsStatsResult[0]?.total_clients ?? BigInt(0);

    // Преобразуем revenue в число (может быть Decimal, string или bigint)
    const revenue =
      typeof revenueRaw === 'string'
        ? parseFloat(revenueRaw)
        : typeof revenueRaw === 'bigint'
          ? Number(revenueRaw)
          : Number(revenueRaw) || 0;

    // Вычисляем процент новых клиентов (преобразуем BigInt в Number перед вычислениями)
    const totalClientsNum = Number(totalClients);
    const newClientsNum = Number(newClients);
    const newClientsPercentage =
      totalClientsNum > 0 ? (newClientsNum * 100) / totalClientsNum : 0;

    const topServices = topServicesResult.map(service => ({
      id: service.id,
      name: service.name,
      count: Number(service.count),
    }));

    const response = AnalyticsResponseSchema.parse({
      appointmentsCount: Number(appointmentsCount),
      revenue: Number(revenue),
      topServices,
      newClientsPercentage,
    });

    return res.json(response);
  } catch (error) {
    logError('Ошибка получения аналитики', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Получить портфолио мастера
 */
export async function getPortfolio(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const photos = await prisma.portfolioPhoto.findMany({
      where: { masterId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        description: true,
        createdAt: true,
      },
    });

    return res.json({
      photos: photos.map(photo => ({
        ...photo,
        createdAt: photo.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logError('Ошибка получения портфолио', error);
    return res.status(500).json({
      error: 'Failed to fetch portfolio',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Загрузить фото в портфолио
 */
export async function uploadPortfolioPhoto(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const description = req.body.description || null;

    const imageUrl = await uploadImageToCloudinary(
      req.file.buffer,
      `beauty-crm/portfolio/${userId}`
    );

    const photo = await prisma.portfolioPhoto.create({
      data: {
        masterId: userId,
        url: imageUrl,
        description: description || null,
      },
      select: {
        id: true,
        url: true,
        description: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      photo: {
        ...photo,
        createdAt: photo.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logError('Ошибка загрузки фото портфолио', error);
    return res.status(500).json({
      error: 'Failed to upload portfolio photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Удалить фото из портфолио
 */
export async function deletePortfolioPhoto(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: photoId } = req.params;
    if (!photoId) {
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    const photo = await prisma.portfolioPhoto.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        masterId: true,
        url: true,
      },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (photo.masterId !== userId) {
      return res.status(403).json({
        error: 'Photo does not belong to the current user',
      });
    }

    try {
      await deleteImageFromCloudinary(photo.url);
    } catch (error) {
      logError('Ошибка удаления фото из Cloudinary', error);
    }

    await prisma.portfolioPhoto.delete({
      where: { id: photoId },
    });

    return res.status(204).send();
  } catch (error) {
    logError('Ошибка удаления фото портфолио', error);
    return res.status(500).json({
      error: 'Failed to delete portfolio photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
