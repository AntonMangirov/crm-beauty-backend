import { Request, Response } from 'express';
import prisma from '../prismaClient';
import {
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
import { addMinutesToUTC, formatUTCToISO } from '../utils/timeUtils';

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

  console.log(`[BOOKING] Начало обработки записи для мастера: ${slug}`);
  console.log(`[BOOKING] Тело запроса:`, JSON.stringify(req.body, null, 2));

  if (!slug) {
    console.log(`[BOOKING] Ошибка: slug не предоставлен`);
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    // 1) Находим мастера по slug
    console.log(`[BOOKING] Поиск мастера по slug: ${slug}`);
    const master = await prisma.user.findUnique({ where: { slug } });
    if (!master) {
      console.log(`[BOOKING] Ошибка: мастер с slug '${slug}' не найден`);
      throw new MasterNotFoundError(slug);
    }

    if (!master.isActive) {
      console.log(`[BOOKING] Ошибка: мастер '${slug}' неактивен`);
      throw new MasterInactiveError(slug);
    }

    console.log(`[BOOKING] Мастер найден: ${master.name} (ID: ${master.id})`);

    console.log(`[BOOKING] Использование данных из валидированного body...`);
    const { name, phone, serviceId, startAt, comment } = req.body as {
      name: string;
      phone: string;
      serviceId: string;
      startAt: Date;
      comment?: string;
    };
    console.log(`[BOOKING] Валидация прошла успешно. Данные:`, {
      name,
      phone,
      serviceId,
      startAt,
      comment,
    });

    // 3) Проверяем услугу принадлежит мастеру и активна
    console.log(
      `[BOOKING] Поиск услуги: ${serviceId} для мастера: ${master.id}`
    );
    const service = await prisma.service.findFirst({
      where: { id: serviceId, masterId: master.id, isActive: true },
    });
    if (!service) {
      console.log(
        `[BOOKING] Ошибка: услуга '${serviceId}' не найдена или не принадлежит мастеру '${master.id}'`
      );
      throw new ServiceNotFoundError(serviceId);
    }

    console.log(
      `[BOOKING] Услуга найдена: ${service.name} (${service.durationMin} мин, ${service.price} руб)`
    );

    const start = startAt; // Уже Date объект из Zod схемы
    const end = addMinutesToUTC(start, service.durationMin);
    console.log(
      `[BOOKING] Время записи: ${start.toISOString()} - ${end.toISOString()}`
    );

    // 4) Используем транзакцию для защиты от double-booking
    console.log(`[BOOKING] Начало транзакции для создания записи...`);
    const appointment = await prisma.$transaction(async tx => {
      // 4.1) Находим/создаем клиента по телефону
      console.log(`[BOOKING] Поиск клиента по телефону: ${phone}`);
      let client = await tx.client.findFirst({
        where: { masterId: master.id, phone },
      });
      if (!client) {
        console.log(`[BOOKING] Создание нового клиента: ${name} (${phone})`);
        client = await tx.client.create({
          data: {
            masterId: master.id,
            name,
            phone,
          },
        });
      } else {
        console.log(
          `[BOOKING] Клиент найден: ${client.name} (ID: ${client.id})`
        );
        if (!client.name && name) {
          console.log(`[BOOKING] Обновление имени клиента: ${name}`);
          // Обновим имя если пустое
          await tx.client.update({ where: { id: client.id }, data: { name } });
        }
      }

      // 4.2) Проверка пересечения внутри транзакции
      console.log(`[BOOKING] Проверка конфликтов времени...`);
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
        console.log(
          `[BOOKING] Ошибка: конфликт времени с записью ID: ${overlapping.id}`
        );
        throw new TimeSlotConflictError(start.toISOString(), end.toISOString());
      }

      console.log(`[BOOKING] Конфликтов времени не найдено`);

      // 4.3) Создаем встречу
      console.log(`[BOOKING] Создание записи...`);
      const appointment = await tx.appointment.create({
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

      console.log(`[BOOKING] Запись создана успешно: ID ${appointment.id}`);
      return appointment;
    });

    console.log(`[BOOKING] Добавление задачи уведомления...`);
    (async () => {
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

        const notificationPromise = notificationQueue.add(
          'send-booking-notification',
          notificationData,
          {
            priority: 1,
            delay: 0,
          }
        );

        const timeoutPromise = new Promise<never>((_, reject) =>
          global.setTimeout(
            () => reject(new Error('Notification queue timeout')),
            5000
          )
        );

        const notificationJob = (await Promise.race([
          notificationPromise,
          timeoutPromise,
        ])) as Awaited<typeof notificationPromise>;

        const updatePromise = prisma.appointment.update({
          where: { id: appointment.id },
          data: { notificationJobId: notificationJob.id.toString() },
        });

        const updateTimeoutPromise = new Promise<never>((_, reject) =>
          global.setTimeout(() => reject(new Error('Update timeout')), 3000)
        );

        await Promise.race([updatePromise, updateTimeoutPromise]);

        console.log(
          `[BOOKING] Задача уведомления ${notificationJob.id} добавлена для записи ${appointment.id}`
        );
      } catch (notificationError) {
        console.error(
          `[BOOKING] Ошибка добавления уведомления:`,
          notificationError
        );
      }
    })();

    const response = BookingResponseSchema.parse({
      id: appointment.id,
      startAt: formatUTCToISO(appointment.startAt),
      endAt: formatUTCToISO(appointment.endAt),
      status: appointment.status,
    });

    console.log(`[BOOKING] Успешно! Запись создана:`, response);
    return res.status(201).json(response);
  } catch (error) {
    console.error(`[BOOKING] Ошибка при создании записи:`, error);

    if (error instanceof MasterNotFoundError) {
      return res.status(404).json({
        error: 'Master not found',
        message: `Мастер с slug '${slug}' не найден`,
      });
    }

    if (error instanceof MasterInactiveError) {
      return res.status(404).json({
        error: 'Master inactive',
        message: `Мастер '${slug}' неактивен`,
      });
    }

    if (error instanceof ServiceNotFoundError) {
      return res.status(400).json({
        error: 'Service not found',
        message: 'Услуга не найдена или не принадлежит мастеру',
      });
    }

    if (error instanceof TimeSlotConflictError) {
      return res.status(409).json({
        error: 'Time slot conflict',
        message: 'Выбранное время уже занято',
      });
    }

    console.error(`[BOOKING] Необработанная ошибка:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}
