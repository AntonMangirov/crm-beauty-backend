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
import { TimeslotsResponseSchema } from '../schemas/public';
import { geocodeAndCache } from '../utils/geocoding';
import { verifyCaptcha } from '../utils/recaptcha';
import { normalizePhone } from '../utils/validation';
import { logError, logBooking, logWarn } from '../utils/logger';

export async function getPublicProfileBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const user = (await prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        photoUrl: true,
        description: true,
        address: true,
        phone: true,
        lat: true,
        lng: true,
        vkUrl: true,
        telegramUrl: true,
        whatsappUrl: true,
        backgroundImageUrl: true,
        rating: true,
        isActive: true,
        services: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            durationMin: true,
            // @ts-ignore - photoUrl будет добавлен после миграции
            photoUrl: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    })) as {
      id: string;
      slug: string;
      name: string;
      photoUrl: string | null;
      description: string | null;
      address: string | null;
      phone: string | null;
      lat: number | null;
      lng: number | null;
      vkUrl: string | null;
      telegramUrl: string | null;
      whatsappUrl: string | null;
      backgroundImageUrl: string | null;
      rating: number | null;
      isActive: boolean;
      services: Array<{
        id: string;
        name: string;
        price: string | number | bigint;
        durationMin: number;
        photoUrl?: string | null;
      }>;
    } | null;

    if (!user) {
      throw new MasterNotFoundError(slug);
    }

    if (!user.isActive) {
      throw new MasterInactiveError(slug);
    }

    // Автоматический геокодинг: если координат нет, но есть адрес - пытаемся получить координаты
    // ВАЖНО: Геокодинг выполняется асинхронно в фоне, чтобы не блокировать ответ
    const finalLat = user.lat ? Number(user.lat) : null;
    const finalLng = user.lng ? Number(user.lng) : null;

    // Запускаем геокодинг в фоне (не блокируем ответ)
    if ((!finalLat || !finalLng) && user.address) {
      // Не ждём результат - выполняем в фоне
      geocodeAndCache(prisma, user.id, user.address).catch(error => {
        console.error(
          `[GEOCODING] Background geocoding failed for user ${user.id}:`,
          error
        );
      });
    }

    const response = PublicProfileResponseSchema.parse({
      slug: user.slug,
      name: user.name,
      photoUrl: user.photoUrl,
      description: user.description,
      address: user.address,
      phone: user.phone,
      lat: finalLat,
      lng: finalLng,
      vkUrl: user.vkUrl,
      telegramUrl: user.telegramUrl,
      whatsappUrl: user.whatsappUrl,
      backgroundImageUrl: user.backgroundImageUrl,
      rating:
        user.rating !== null && user.rating !== undefined
          ? Number(user.rating)
          : null,
      services: user.services.map(service => ({
        id: service.id,
        name: service.name,
        price: service.price.toString(),
        durationMin: service.durationMin,
        photoUrl: (service as { photoUrl?: string | null }).photoUrl || null,
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

  logBooking('Начало обработки записи', {
    slug,
    body: req.body,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  if (!slug) {
    logError('Slug не предоставлен', undefined, { path: req.path });
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    // 1) Находим мастера по slug
    logBooking('Поиск мастера', { slug });
    const master = await prisma.user.findUnique({ where: { slug } });
    if (!master) {
      logError('Мастер не найден', undefined, { slug, path: req.path });
      throw new MasterNotFoundError(slug);
    }

    if (!master.isActive) {
      logWarn('Попытка записи к неактивному мастеру', {
        slug,
        masterId: master.id,
      });
      throw new MasterInactiveError(slug);
    }

    logBooking('Мастер найден', {
      masterId: master.id,
      masterName: master.name,
    });

    const { name, phone, serviceId, startAt, comment, recaptchaToken } =
      req.body as {
        name: string;
        phone: string;
        serviceId: string;
        startAt: Date;
        comment?: string;
        recaptchaToken?: string;
      };

    // Проверка reCAPTCHA перед обработкой записи
    // В dev режиме, если токен не предоставлен, пропускаем проверку
    if (recaptchaToken) {
      logBooking('Проверка reCAPTCHA', { masterId: master.id });
      const isCaptchaValid = await verifyCaptcha(recaptchaToken);
      if (!isCaptchaValid) {
        logWarn('reCAPTCHA проверка не пройдена', {
          masterId: master.id,
          slug,
          ip: req.ip,
        });
        return res.status(400).json({
          error: 'reCAPTCHA verification failed',
          message:
            'Проверка на бота не пройдена. Пожалуйста, попробуйте снова.',
        });
      }
      logBooking('reCAPTCHA проверка пройдена', { masterId: master.id });
    } else {
      // В dev режиме пропускаем проверку, если токен не предоставлен
      if (process.env.NODE_ENV === 'production') {
        logWarn('reCAPTCHA токен не предоставлен в production', {
          masterId: master.id,
          slug,
          ip: req.ip,
        });
        return res.status(400).json({
          error: 'reCAPTCHA token required',
          message: 'Токен reCAPTCHA обязателен',
        });
      }
      logBooking(
        'reCAPTCHA проверка пропущена (dev режим, токен не предоставлен)',
        {
          masterId: master.id,
        }
      );
    }

    // Нормализуем телефон к единому формату
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      logError('Неверный формат телефона', undefined, {
        phone,
        masterId: master.id,
        serviceId,
      });
      return res.status(400).json({
        error: 'Invalid phone format',
        message: 'Неверный формат телефона',
      });
    }

    logBooking('Валидация прошла успешно', {
      masterId: master.id,
      serviceId,
      startAt:
        startAt instanceof Date ? startAt.toISOString() : String(startAt),
      phone: normalizedPhone,
      hasComment: !!comment,
    });

    // 3) Проверяем услугу принадлежит мастеру и активна
    logBooking('Поиск услуги', { serviceId, masterId: master.id });
    const service = await prisma.service.findFirst({
      where: { id: serviceId, masterId: master.id, isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        durationMin: true,
        isActive: true,
      },
    });
    if (!service) {
      logError('Услуга не найдена или неактивна', undefined, {
        serviceId,
        masterId: master.id,
        slug,
      });
      return res.status(400).json({
        error: 'Service not found',
        message:
          'Услуга не найдена, неактивна или не принадлежит данному мастеру',
      });
    }

    logBooking('Услуга найдена', {
      serviceId: service.id,
      serviceName: service.name,
      durationMin: service.durationMin,
      price: service.price.toString(),
    });

    const start = startAt; // Уже Date объект из Zod схемы
    const end = addMinutesToUTC(start, service.durationMin);
    logBooking('Время записи определено', {
      start: start.toISOString(),
      end: end.toISOString(),
      durationMin: service.durationMin,
    });

    // 4) Используем транзакцию для защиты от double-booking
    logBooking('Начало транзакции для создания записи', {
      masterId: master.id,
    });
    const appointment = await prisma.$transaction(async tx => {
      // 4.1) Находим/создаем клиента по телефону (используем нормализованный)
      logBooking('Поиск клиента', {
        phone: normalizedPhone,
        masterId: master.id,
      });
      let client = await tx.client.findFirst({
        where: { masterId: master.id, phone: normalizedPhone },
      });
      if (!client) {
        logBooking('Создание нового клиента', { name, phone: normalizedPhone });
        client = await tx.client.create({
          data: {
            masterId: master.id,
            name,
            phone: normalizedPhone,
          },
        });
      } else {
        logBooking('Клиент найден', {
          clientId: client.id,
          clientName: client.name,
        });
        if (!client.name && name) {
          logBooking('Обновление имени клиента', {
            clientId: client.id,
            newName: name,
          });
          // Обновим имя если пустое
          await tx.client.update({ where: { id: client.id }, data: { name } });
        }
      }

      // 4.2) Проверка пересечения внутри транзакции
      logBooking('Проверка конфликтов времени', {
        start: start.toISOString(),
        end: end.toISOString(),
      });
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
        logError('Конфликт времени обнаружен', undefined, {
          requestedStart: start.toISOString(),
          requestedEnd: end.toISOString(),
          conflictingStart: overlapping.startAt.toISOString(),
          conflictingEnd: overlapping.endAt.toISOString(),
          masterId: master.id,
          serviceId,
        });
        throw new TimeSlotConflictError(start.toISOString(), end.toISOString());
      }

      logBooking('Конфликтов времени не найдено', {
        start: start.toISOString(),
        end: end.toISOString(),
      });

      // 4.3) Создаем встречу
      logBooking('Создание записи', {
        clientId: client.id,
        serviceId: service.id,
        start: start.toISOString(),
        end: end.toISOString(),
      });
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
          clientId: true,
          serviceId: true,
        },
      });

      logBooking('Запись создана успешно', { appointmentId: appointment.id });
      return appointment;
    });

    logBooking('Добавление задачи уведомления', {
      appointmentId: appointment.id,
    });
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

        logBooking('Задача уведомления добавлена', {
          appointmentId: appointment.id,
          notificationJobId: notificationJob.id.toString(),
        });
      } catch (notificationError) {
        logError('Ошибка добавления уведомления', notificationError, {
          appointmentId: appointment.id,
        });
      }
    })();

    const response = BookingResponseSchema.parse({
      id: appointment.id,
      startAt: formatUTCToISO(appointment.startAt),
      endAt: formatUTCToISO(appointment.endAt),
      status: appointment.status,
    });

    logBooking('Запись успешно создана', {
      appointmentId: appointment.id,
      masterId: master.id,
      clientId: appointment.clientId,
      serviceId: appointment.serviceId,
      start: appointment.startAt.toISOString(),
      end: appointment.endAt.toISOString(),
    });
    return res.status(201).json(response);
  } catch (error) {
    // Логируем все ошибки в файл
    logError('Ошибка при создании записи', error, {
      slug,
      body: req.body,
      ip: req.ip,
    });

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

    // Необработанная ошибка
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}

/**
 * Получение доступных временных слотов для мастера
 * GET /api/public/:slug/timeslots?date=2025-11-06&serviceId=xxx
 */
export async function getTimeslots(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    // Используем валидированные данные из middleware, если они есть
    const validatedQuery = (req as any).validatedQuery as
      | {
          date?: string;
          serviceId?: string;
        }
      | undefined;
    const { date, serviceId } =
      validatedQuery ||
      (req.query as {
        date?: string;
        serviceId?: string;
      });

    logBooking('Запрос временных слотов', {
      slug,
      date,
      serviceId,
    });

    if (!slug) {
      logError('Slug не предоставлен для timeslots', undefined, {
        path: req.path,
      });
      return res.status(400).json({ error: 'slug is required' });
    }

    // Находим мастера
    const master = await prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!master) {
      throw new MasterNotFoundError(slug);
    }

    if (!master.isActive) {
      throw new MasterInactiveError(slug);
    }

    // Определяем дату для поиска слотов
    let targetDate: Date;
    if (date) {
      // Если дата передана, парсим её (ожидаем формат YYYY-MM-DD)
      // Проверяем формат даты перед парсингом
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        logError('Неверный формат даты в timeslots', undefined, {
          date,
          slug,
        });
        return res.status(400).json({
          error: 'Invalid date format',
          message: 'Дата должна быть в формате YYYY-MM-DD',
        });
      }

      const parsedDate = new Date(date + 'T00:00:00.000Z');
      if (isNaN(parsedDate.getTime())) {
        logError('Не удалось распарсить дату в timeslots', undefined, {
          date,
          slug,
        });
        return res.status(400).json({
          error: 'Invalid date format',
          message: 'Неверный формат даты',
        });
      }
      targetDate = parsedDate;
    } else {
      // Если дата не передана, используем завтрашний день
      targetDate = new Date();
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
      targetDate.setUTCHours(0, 0, 0, 0);
    }

    // Получаем длительность услуги если указана
    let serviceDuration = 60; // По умолчанию 60 минут
    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: {
          id: serviceId,
          masterId: master.id,
          isActive: true,
        },
        select: { durationMin: true },
      });

      if (service) {
        serviceDuration = service.durationMin;
      }
    }

    // Получаем начало и конец дня в UTC
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Получаем существующие записи на эту дату
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        masterId: master.id,
        startAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['CANCELED', 'NO_SHOW'],
        },
      },
      select: {
        startAt: true,
        endAt: true,
      },
    });

    // Генерируем все возможные временные слоты (9:00 - 18:00 UTC)
    const availableSlots: string[] = [];
    const workStartHour = 9;
    const workEndHour = 18;
    const slotInterval = 60; // Интервал между слотами в минутах

    for (let hour = workStartHour; hour < workEndHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotStart = new Date(targetDate);
        slotStart.setUTCHours(hour, minute, 0, 0);

        // Пропускаем слоты в прошлом
        if (slotStart < new Date()) {
          continue;
        }

        const slotEnd = addMinutesToUTC(slotStart, serviceDuration);

        // Проверяем что слот не выходит за рабочие часы
        if (slotEnd.getUTCHours() > workEndHour) {
          continue;
        }

        // Проверяем что слот не пересекается с существующими записями
        const isAvailable = !existingAppointments.some(apt => {
          const aptStart = apt.startAt;
          const aptEnd = apt.endAt;

          // Проверяем пересечение: новый слот начинается внутри существующей записи
          // или существующая запись начинается внутри нового слота
          return (
            (slotStart >= aptStart && slotStart < aptEnd) ||
            (aptStart >= slotStart && aptStart < slotEnd)
          );
        });

        if (isAvailable) {
          availableSlots.push(formatUTCToISO(slotStart));
        }
      }
    }

    const response = TimeslotsResponseSchema.parse({
      available: availableSlots,
    });

    logBooking('Временные слоты успешно получены', {
      slug: req.params.slug,
      date: targetDate.toISOString().split('T')[0],
      slotsCount: availableSlots.length,
    });

    return res.json(response);
  } catch (error) {
    logError('Ошибка получения временных слотов', error, {
      slug: req.params.slug,
      date: req.query.date as string,
      serviceId: req.query.serviceId as string,
    });

    const { slug: slugParam } = req.params;

    if (error instanceof MasterNotFoundError) {
      return res.status(404).json({
        error: 'Master not found',
        message: `Мастер с slug '${slugParam}' не найден`,
      });
    }

    if (error instanceof MasterInactiveError) {
      return res.status(404).json({
        error: 'Master inactive',
        message: `Мастер '${slugParam}' неактивен`,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}
