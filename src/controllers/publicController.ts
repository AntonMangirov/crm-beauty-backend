import { Request, Response } from 'express';
import prisma from '../prismaClient';
import {
  BookingRequestSchema,
  BookingResponseSchema,
  PublicProfileResponseSchema,
} from '../schemas/public';
import {
  notificationQueue,
  NotificationData,
} from '../services/notificationQueue';
import {
  MasterNotFoundError,
  MasterInactiveError,
  ServiceNotFoundError,
  TimeSlotConflictError,
} from '../errors/BusinessErrors';

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export async function getPublicProfileBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const user = await prisma.user.findUnique({
      where: { slug },
      select: {
        name: true,
        photoUrl: true,
        description: true,
        address: true,
        isActive: true,
        services: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            durationMin: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!user) {
      throw new MasterNotFoundError(slug);
    }

    if (!user.isActive) {
      throw new MasterInactiveError(slug);
    }

    const response = PublicProfileResponseSchema.parse({
      name: user.name,
      photoUrl: user.photoUrl,
      description: user.description,
      address: user.address,
      services: user.services.map(service => ({
        ...service,
        price: service.price.toString(),
      })),
    });
    return res.json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function bookPublicSlot(req: Request, res: Response) {
  const { slug } = req.params;
  if (!slug) return res.status(400).json({ error: 'slug is required' });

  // 1) Находим мастера по slug
  const master = await prisma.user.findUnique({ where: { slug } });
  if (!master) {
    throw new MasterNotFoundError(slug);
  }

  if (!master.isActive) {
    throw new MasterInactiveError(slug);
  }

  // 2) Валидируем вход
  const parsed = BookingRequestSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: 'Invalid request', details: parsed.error.flatten() });
  const { name, phone, serviceId, startAt, comment } = parsed.data;

  // 3) Проверяем услугу принадлежит мастеру и активна
  const service = await prisma.service.findFirst({
    where: { id: serviceId, masterId: master.id, isActive: true },
  });
  if (!service) {
    throw new ServiceNotFoundError(serviceId);
  }

  const start = new Date(startAt);
  const end = addMinutes(start, service.durationMin);

  // 4) Используем транзакцию для защиты от double-booking
  const appointment = await prisma.$transaction(async tx => {
    // 4.1) Находим/создаем клиента по телефону
    let client = await tx.client.findFirst({
      where: { masterId: master.id, phone },
    });
    if (!client) {
      client = await tx.client.create({
        data: {
          masterId: master.id,
          name,
          phone,
        },
      });
    } else if (!client.name && name) {
      // Обновим имя если пустое
      await tx.client.update({ where: { id: client.id }, data: { name } });
    }

    // 4.2) Проверка пересечения внутри транзакции
    const overlapping = await tx.appointment.findFirst({
      where: {
        masterId: master.id,
        OR: [
          // новая встреча начинается внутри существующей
          { startAt: { lte: start }, endAt: { gt: start } },
          // новая встреча заканчивается внутри существующей
          { startAt: { lt: end }, endAt: { gte: end } },
          // новая полностью покрывает существующую
          { startAt: { gte: start }, endAt: { lte: end } },
        ],
      },
    });

    if (overlapping) {
      throw new TimeSlotConflictError(start.toISOString(), end.toISOString());
    }

    // 4.3) Создаем встречу
    return await tx.appointment.create({
      data: {
        masterId: master.id,
        clientId: client.id,
        serviceId: service.id,
        startAt: start,
        endAt: end,
        status: 'CONFIRMED',
        notes: comment,
        price: service.price,
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
      },
    });
  });

  // Добавляем задачу уведомления в очередь
  try {
    const notificationData: NotificationData = {
      appointmentId: appointment.id,
      clientName: name,
      clientPhone: phone,
      masterName: master.name,
      serviceName: service.name,
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      price: Number(service.price),
    };

    const notificationJob = await notificationQueue.add(
      'send-booking-notification',
      notificationData,
      {
        priority: 1, // Высокий приоритет для новых записей
        delay: 0, // Отправляем сразу
      }
    );

    // Сохраняем ID задачи в базе данных
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notificationJobId: notificationJob.id.toString() },
    });

    console.log(
      `Notification job ${notificationJob.id} queued for appointment ${appointment.id}`
    );
  } catch (notificationError) {
    // Логируем ошибку, но не прерываем основной процесс
    console.error('Failed to queue notification:', notificationError);
  }

  const response = BookingResponseSchema.parse({
    id: appointment.id,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    status: appointment.status,
  });

  return res.status(201).json(response);
}
