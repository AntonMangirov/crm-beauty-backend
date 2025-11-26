import { Request, Response } from 'express';
import prisma from '../prismaClient';
import {
  BookingResponseSchema,
  PublicProfileResponseSchema,
  CreateReviewRequestSchema,
  ReviewsResponseSchema,
  ReviewSchema,
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
import { logError, logDevError } from '../utils/logger';
import { trackManualBooking } from '../utils/metrics';

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

    const finalLat = user.lat ? Number(user.lat) : null;
    const finalLng = user.lng ? Number(user.lng) : null;

    // Геокодинг выполняется асинхронно в фоне, чтобы не блокировать ответ
    if ((!finalLat || !finalLng) && user.address) {
      geocodeAndCache(prisma, user.id, user.address).catch(error => {
        logError(
          `Фоновый геокодинг не удался для пользователя ${user.id}`,
          error
        );
      });
    }

    // Получаем примеры работ из портфолио мастера
    const portfolioPhotos = await prisma.portfolioPhoto.findMany({
      where: {
        masterId: user.id,
      },
      select: {
        id: true,
        url: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20, // Ограничиваем до 20 последних фото
    });

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
      portfolio:
        portfolioPhotos.length > 0
          ? portfolioPhotos.map(photo => ({
              id: photo.id,
              url: photo.url,
              description: photo.description,
              createdAt: photo.createdAt.toISOString(),
            }))
          : undefined,
    });
    return res.json(response);
  } catch (error) {
    logError('Ошибка получения публичного профиля', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function bookPublicSlot(req: Request, res: Response) {
  const { slug } = req.params;

  if (!slug) {
    logError('Slug не предоставлен', undefined, { path: req.path });
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const master = await prisma.user.findUnique({ where: { slug } });
    if (!master) {
      throw new MasterNotFoundError(slug);
    }

    if (!master.isActive) {
      throw new MasterInactiveError(slug);
    }

    const {
      name,
      phone,
      telegramUsername,
      serviceId,
      startAt,
      comment,
      recaptchaToken,
      source,
      price,
      durationOverride,
    } = req.body as {
      name: string;
      phone?: string;
      telegramUsername?: string;
      serviceId: string;
      startAt: Date;
      comment?: string;
      recaptchaToken?: string;
      source?: 'MANUAL' | 'PHONE' | 'WEB' | 'TELEGRAM' | 'VK' | 'WHATSAPP';
      price?: number;
      durationOverride?: number;
    };

    if (recaptchaToken) {
      const isCaptchaValid = await verifyCaptcha(recaptchaToken);
      if (!isCaptchaValid) {
        return res.status(400).json({
          error: 'reCAPTCHA verification failed',
          message:
            'Проверка на бота не пройдена. Пожалуйста, попробуйте снова.',
        });
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          error: 'reCAPTCHA token required',
          message: 'Токен reCAPTCHA обязателен',
        });
      }
    }

    // Нормализуем телефон, если он передан
    let normalizedPhone: string | undefined = undefined;
    if (phone && phone.trim()) {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        // Логируем ошибку валидации для разработчиков
        logDevError(
          'validationFailed',
          'Invalid phone format when booking appointment',
          undefined,
          {
            slug,
            phone: phone.trim(),
            source,
          }
        );

        return res.status(400).json({
          error: 'Invalid phone format',
          message: 'Неверный формат телефона',
        });
      }
      normalizedPhone = normalized;
    }

    // Проверяем, что хотя бы одно поле заполнено
    if (!normalizedPhone && (!telegramUsername || !telegramUsername.trim())) {
      // Логируем ошибку валидации для разработчиков
      logDevError(
        'validationFailed',
        'Missing contact information when booking appointment',
        undefined,
        {
          slug,
          hasPhone: !!phone,
          hasTelegram: !!telegramUsername,
          source,
        }
      );

      return res.status(400).json({
        error: 'Phone or telegram username required',
        message: 'Необходимо указать телефон или ник Telegram',
      });
    }

    // Нормализуем telegramUsername (убираем @ если есть, приводим к нижнему регистру)
    const normalizedTelegramUsername = telegramUsername?.trim()
      ? telegramUsername.trim().replace(/^@/, '').toLowerCase()
      : undefined;

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
      // Логируем ошибку для разработчиков
      logDevError(
        'noServices',
        'Service not found when booking appointment',
        undefined,
        {
          slug,
          serviceId,
          masterId: master.id,
          source,
        }
      );

      return res.status(400).json({
        error: 'Service not found',
        message:
          'Услуга не найдена, неактивна или не принадлежит данному мастеру',
      });
    }

    const start = startAt;
    // Используем кастомную длительность, если указана, иначе длительность услуги
    const duration =
      durationOverride && durationOverride > 0
        ? durationOverride
        : service.durationMin;
    const end = addMinutesToUTC(start, duration);
    // Используем кастомную цену, если указана, иначе цену услуги
    const finalPrice = price && price > 0 ? price : Number(service.price);

    // Используем транзакцию для защиты от double-booking
    const appointment = await prisma.$transaction(async tx => {
      // Ищем клиента по телефону или telegramUsername
      const whereConditions: Array<
        { phone: string } | { telegramUsername: string }
      > = [];
      if (normalizedPhone) {
        whereConditions.push({ phone: normalizedPhone });
      }
      if (normalizedTelegramUsername) {
        whereConditions.push({ telegramUsername: normalizedTelegramUsername });
      }

      // Должно быть хотя бы одно условие для поиска (проверено выше, но на всякий случай)
      if (whereConditions.length === 0) {
        throw new Error('Phone or telegram username required');
      }

      let client = await tx.client.findFirst({
        where: {
          masterId: master.id,
          OR: whereConditions,
        },
      });

      if (!client) {
        // Создаем нового клиента
        client = await tx.client.create({
          data: {
            masterId: master.id,
            name,
            phone: normalizedPhone,
            telegramUsername: normalizedTelegramUsername,
          },
        });
      } else {
        // Обновляем существующего клиента
        const updateData: {
          name?: string;
          phone?: string;
          telegramUsername?: string;
        } = {};
        if (!client.name && name) {
          updateData.name = name;
        }
        if (normalizedPhone && !client.phone) {
          updateData.phone = normalizedPhone;
        }
        if (normalizedTelegramUsername && !client.telegramUsername) {
          updateData.telegramUsername = normalizedTelegramUsername;
        }
        if (Object.keys(updateData).length > 0) {
          await tx.client.update({
            where: { id: client.id },
            data: updateData,
          });
        }
      }

      const overlapping = await tx.appointment.findFirst({
        where: {
          masterId: master.id,
          OR: [
            { startAt: { lte: start }, endAt: { gt: start } },
            { startAt: { lt: end }, endAt: { gte: end } },
            { startAt: { gte: start }, endAt: { lte: end } },
          ],
        },
      });

      if (overlapping) {
        throw new TimeSlotConflictError(start.toISOString(), end.toISOString());
      }

      const appointment = await tx.appointment.create({
        data: {
          masterId: master.id,
          clientId: client.id,
          serviceId: service.id,
          startAt: start,
          endAt: end,
          status: 'CONFIRMED',
          notes: comment,
          price: finalPrice,
          source: source || 'WEB', // По умолчанию WEB, но можно передать MANUAL для записей из ЛК
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

      // Отслеживаем метрику создания ручной записи
      if (source === 'MANUAL') {
        trackManualBooking({
          masterId: master.id,
          serviceId: service.id,
          appointmentId: appointment.id,
          hasCustomPrice: price !== undefined && price > 0,
          hasCustomDuration:
            durationOverride !== undefined && durationOverride > 0,
        });
      }

      return appointment;
    });

    // Добавляем задачу уведомления асинхронно
    (async () => {
      try {
        const notificationData: NotificationData = {
          appointmentId: appointment.id,
          clientName: name,
          ...(normalizedPhone && { clientPhone: normalizedPhone }),
          ...(normalizedTelegramUsername && {
            clientTelegramUsername: normalizedTelegramUsername,
          }),
          masterName: master.name,
          serviceName: service.name,
          startAt: appointment.startAt.toISOString(),
          endAt: appointment.endAt.toISOString(),
          price: finalPrice,
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

    return res.status(201).json(response);
  } catch (error) {
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
      // Логируем ошибку для разработчиков
      logDevError(
        'invalidTimeslot',
        'Time slot conflict when booking appointment',
        error,
        {
          slug,
          serviceId: req.body.serviceId,
          startAt: req.body.startAt,
          source: req.body.source,
        }
      );

      return res.status(409).json({
        error: 'Time slot conflict',
        message: 'Выбранное время уже занято',
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}

/**
 * Получение доступных временных слотов для мастера
 */
export async function getTimeslots(req: Request, res: Response) {
  try {
    const { slug } = req.params;
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

    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          error: 'Invalid date format',
          message: 'Дата должна быть в формате YYYY-MM-DD',
        });
      }

      const parsedDate = new Date(date + 'T00:00:00.000Z');
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format',
          message: 'Неверный формат даты',
        });
      }
      targetDate = parsedDate;
    } else {
      targetDate = new Date();
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
      targetDate.setUTCHours(0, 0, 0, 0);
    }

    let serviceDuration = 60;
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

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

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

    const availableSlots: string[] = [];
    const workStartHour = 9;
    const workEndHour = 18;
    const slotInterval = 60;

    for (let hour = workStartHour; hour < workEndHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotStart = new Date(targetDate);
        slotStart.setUTCHours(hour, minute, 0, 0);

        if (slotStart < new Date()) {
          continue;
        }

        const slotEnd = addMinutesToUTC(slotStart, serviceDuration);

        if (slotEnd.getUTCHours() > workEndHour) {
          continue;
        }

        const isAvailable = !existingAppointments.some(apt => {
          const aptStart = apt.startAt;
          const aptEnd = apt.endAt;
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

export async function getReviewsBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const master = await prisma.user.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!master) {
      throw new MasterNotFoundError(slug);
    }

    if (!master.isActive) {
      throw new MasterInactiveError(slug);
    }

    const reviews = await prisma.review.findMany({
      where: { masterId: master.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        authorName: true,
        rating: true,
        text: true,
        createdAt: true,
      },
    });

    const response = ReviewsResponseSchema.parse(
      reviews.map(review => ({
        ...review,
        rating: Number(review.rating),
        createdAt: review.createdAt.toISOString(),
      }))
    );

    return res.json(response);
  } catch (error) {
    logError('Ошибка получения отзывов', error, {
      slug: req.params.slug,
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

export async function createReview(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const master = await prisma.user.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!master) {
      throw new MasterNotFoundError(slug);
    }

    if (!master.isActive) {
      throw new MasterInactiveError(slug);
    }

    const validatedData = CreateReviewRequestSchema.parse(req.body);

    // Создаем отзыв
    const review = await prisma.review.create({
      data: {
        masterId: master.id,
        authorName: validatedData.authorName,
        rating: validatedData.rating,
        text: validatedData.text,
      },
      select: {
        id: true,
        authorName: true,
        rating: true,
        text: true,
        createdAt: true,
      },
    });

    // Пересчитываем средний рейтинг мастера
    const reviews = await prisma.review.findMany({
      where: { masterId: master.id },
      select: { rating: true },
    });

    if (reviews.length > 0) {
      const avgRating =
        reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length;
      await prisma.user.update({
        where: { id: master.id },
        data: {
          rating: avgRating.toFixed(2),
        },
      });
    }

    const response = ReviewSchema.parse({
      ...review,
      rating: Number(review.rating),
      createdAt: review.createdAt.toISOString(),
    });

    return res.status(201).json(response);
  } catch (error) {
    logError('Ошибка создания отзыва', error, {
      slug: req.params.slug,
      body: req.body,
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

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Ошибка валидации данных',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}
