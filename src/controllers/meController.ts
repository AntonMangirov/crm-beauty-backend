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
} from '../schemas/me';
import { Prisma } from '@prisma/client';
import { geocodeAndCache } from '../utils/geocoding';
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from '../utils/cloudinary';
import { AppointmentNotFoundError } from '../errors/BusinessErrors';
import { ForbiddenError } from '../errors/AppError';

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
 * PATCH /me/profile
 * Обновить профиль мастера (только указанные поля: name, description, address, photoUrl)
 * При обновлении address автоматически получаются координаты через геокодинг
 */
export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = UpdateProfileSchema.parse(req.body);

    // Подготавливаем данные для обновления
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

    // Если обновляется адрес, получаем координаты
    if (validatedData.address !== undefined) {
      updateData.address = validatedData.address;

      // Если адрес не null, делаем геокодинг
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
          // Если геокодинг не удался, очищаем координаты
          updateData.lat = null;
          updateData.lng = null;
        }
      } else {
        // Если адрес удален, очищаем координаты
        updateData.lat = null;
        updateData.lng = null;
      }
    }

    // Обновляем профиль
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
    // Поддерживаем оба варианта: from/to и dateFrom/dateTo
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

/**
 * POST /me/profile/upload-photo
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

    // Получаем текущего пользователя для удаления старого фото
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { photoUrl: true },
    });

    // Загружаем новое фото в Cloudinary
    const imageUrl = await uploadImageToCloudinary(
      req.file.buffer,
      'beauty-crm/profiles'
    );

    // Удаляем старое фото (если есть)
    if (currentUser?.photoUrl) {
      try {
        await deleteImageFromCloudinary(currentUser.photoUrl);
      } catch (error) {
        console.error('Error deleting old photo:', error);
        // Продолжаем даже если удаление не удалось
      }
    }

    // Обновляем photoUrl в БД
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
    console.error('Error uploading photo:', error);
    return res.status(500).json({
      error: 'Failed to upload photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /me/appointments/:id
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

    // Валидация данных
    const validatedData = UpdateAppointmentStatusSchema.parse(req.body);

    // Проверяем, существует ли запись вообще
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

    // Проверяем, что запись принадлежит мастеру
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

    // Обновляем статус записи
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

    // Преобразуем Decimal в number для цены
    const response = {
      ...updatedAppointment,
      price: updatedAppointment.price ? Number(updatedAppointment.price) : null,
    };

    return res.json(response);
  } catch (error) {
    console.error('Error updating appointment status:', error);

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
 * GET /me/clients
 * Получить список клиентов мастера с информацией о посещениях
 */
export async function getClients(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Получаем всех клиентов мастера с их завершенными посещениями
    const clients = await prisma.client.findMany({
      where: {
        masterId: userId,
        isActive: true, // Только активные клиенты
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
      },
      orderBy: {
        name: 'asc', // Сортировка по имени
      },
    });

    // Формируем ответ с вычисленными полями
    const clientsWithStats = clients.map(client => {
      const lastVisit =
        client.appointments.length > 0 ? client.appointments[0].startAt : null;
      const visitsCount = client.appointments.length;

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        lastVisit,
        visitsCount,
      };
    });

    // Валидируем и возвращаем ответ
    const response = clientsWithStats.map(client =>
      ClientListItemSchema.parse(client)
    );

    return res.json(response);
  } catch (error) {
    console.error('Error fetching clients:', error);

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
 * GET /me/clients/:id/history
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

    // Проверяем, что клиент принадлежит мастеру
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        masterId: userId,
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Получаем все записи клиента с информацией об услуге
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
        startAt: 'desc', // Сначала новые записи
      },
    });

    // Получаем все фото клиента
    const allPhotos = await prisma.photo.findMany({
      where: {
        clientId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Формируем ответ: для каждой записи находим связанные фото
    // Фото считается связанным с записью, если оно создано в день записи или после неё,
    // но до следующей записи (или до текущего момента, если это последняя запись)
    const historyItems = appointments.map((appointment, index) => {
      const appointmentDate = new Date(appointment.startAt);
      appointmentDate.setHours(0, 0, 0, 0); // Начало дня записи

      // Определяем период для фото: от даты записи до следующей записи
      const nextAppointment = appointments[index + 1];
      const periodEnd = nextAppointment
        ? new Date(nextAppointment.startAt)
        : new Date(); // Если это последняя запись, используем текущую дату

      // Фильтруем фото, которые попадают в период записи
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

    // Валидируем и возвращаем ответ
    const response = ClientHistoryResponseSchema.parse(historyItems);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching client history:', error);

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
 * POST /me/appointments/:id/photos
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

    // Проверяем, что запись существует и принадлежит мастеру
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

    // Проверяем, что запись принадлежит мастеру
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

    // Проверяем наличие файлов
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Получаем описание из тела запроса (опционально)
    // Если передано одно описание, оно применяется ко всем фото
    // Если передано несколько описаний, они применяются по порядку
    const descriptions = req.body.description
      ? Array.isArray(req.body.description)
        ? req.body.description
        : [req.body.description]
      : [];

    // Загружаем все фото в Cloudinary и сохраняем в БД
    const uploadedPhotos = await Promise.all(
      files.map(async (file, index) => {
        // Загружаем фото в Cloudinary
        const imageUrl = await uploadImageToCloudinary(
          file.buffer,
          `beauty-crm/appointments/${appointmentId}`
        );

        // Получаем описание для этого фото (если есть)
        const description = descriptions[index] || descriptions[0] || null;

        // Сохраняем в БД
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

    // Валидируем и возвращаем ответ
    const response = UploadAppointmentPhotosResponseSchema.parse({
      photos: uploadedPhotos,
    });

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error uploading appointment photos:', error);

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
