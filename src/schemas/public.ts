import { z } from 'zod';
import { isValidISOString } from '../utils/timeUtils';
import { isValidPhoneFormat, isValidBookingDate } from '../utils/validation';

// Вспомогательная функция для валидации URL (принимает полные URL или локальные пути)
const urlOrLocalPath = z.string().refine(
  val => {
    if (typeof val !== 'string') return false;
    // Проверяем локальный путь
    if (val.startsWith('/uploads/')) return true;
    // Проверяем, является ли это валидным URL
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Некорректный URL' }
);

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.union([z.string(), z.number()]),
  durationMin: z.number().int(),
  photoUrl: urlOrLocalPath.nullable().optional(),
});

export const PortfolioPhotoSchema = z.object({
  id: z.string(),
  url: urlOrLocalPath,
  description: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const PublicProfileResponseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  photoUrl: urlOrLocalPath.nullable().optional(),
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  vkUrl: z.string().url().nullable().optional(),
  telegramUrl: z.string().url().nullable().optional(),
  whatsappUrl: z.string().url().nullable().optional(),
  backgroundImageUrl: urlOrLocalPath.nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  services: z.array(ServiceSchema),
  portfolio: z.array(PortfolioPhotoSchema).optional(),
});
export type PublicProfileResponse = z.infer<typeof PublicProfileResponseSchema>;

export const SlugParamSchema = z.object({ slug: z.string().min(1) });
export type SlugParams = z.infer<typeof SlugParamSchema>;

export const BookingRequestSchema = z
  .object({
    name: z.string().max(100, 'Имя слишком длинное').optional(),
    phone: z.string().optional(),
    telegramUsername: z.string().optional(),
    serviceId: z.string().min(1, 'ID услуги обязателен'),
    startAt: z
      .string()
      .refine(isValidISOString, {
        message:
          'startAt must be a valid ISO string (e.g., "2024-01-01T10:00:00.000Z")',
      })
      .transform(isoString => new Date(isoString))
      .refine(date => isValidBookingDate(date), {
        message:
          'Дата записи должна быть минимум через 2 часа и не более чем через 30 дней',
      }),
    comment: z
      .string()
      .max(500, 'Комментарий не должен превышать 500 символов')
      .optional(),
    recaptchaToken: z.string().min(1).optional(),
  })
  .refine(
    data => {
      // Проверяем что дата не в прошлом (дополнительная проверка)
      return data.startAt > new Date();
    },
    {
      message: 'Дата записи не может быть в прошлом',
      path: ['startAt'],
    }
  )
  .refine(
    data => {
      // Нормализуем phone: пустые строки считаем как отсутствие поля
      const normalizedPhone = data.phone?.trim() || undefined;
      if (normalizedPhone && !isValidPhoneFormat(normalizedPhone)) {
        return false;
      }
      return true;
    },
    {
      message:
        'Неверный формат телефона. Используйте формат: +7 (999) 123-45-67',
      path: ['phone'],
    }
  )
  .refine(
    data => {
      // Нормализуем telegramUsername: пустые строки считаем как отсутствие поля
      const normalizedTelegram = data.telegramUsername?.trim() || undefined;
      if (normalizedTelegram) {
        if (normalizedTelegram.length < 5) {
          return false;
        }
        if (normalizedTelegram.length > 32) {
          return false;
        }
        if (!/^[a-zA-Z0-9_]{5,32}$/.test(normalizedTelegram)) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        'Ник Telegram должен содержать 5-32 символа (только буквы, цифры и подчеркивания)',
      path: ['telegramUsername'],
    }
  )
  .refine(
    data => {
      // Хотя бы одно из полей (phone или telegramUsername) должно быть заполнено
      const normalizedPhone = data.phone?.trim() || undefined;
      const normalizedTelegram = data.telegramUsername?.trim() || undefined;

      const hasPhone = normalizedPhone && isValidPhoneFormat(normalizedPhone);
      const hasTelegram =
        normalizedTelegram &&
        normalizedTelegram.length >= 5 &&
        /^[a-zA-Z0-9_]{5,32}$/.test(normalizedTelegram);

      return hasPhone || hasTelegram;
    },
    {
      message: 'Необходимо указать телефон или ник Telegram',
      path: ['phone'], // Привязываем к phone, но сообщение указывает на оба поля
    }
  );
export type BookingRequest = z.infer<typeof BookingRequestSchema>;

export const BookingResponseSchema = z.object({
  id: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW']),
});
export type BookingResponse = z.infer<typeof BookingResponseSchema>;

export const TimeslotsQuerySchema = z.object({
  date: z.string().optional(), // ISO date string (YYYY-MM-DD)
  serviceId: z.string().optional(),
});
export type TimeslotsQuery = z.infer<typeof TimeslotsQuerySchema>;

export const TimeslotsResponseSchema = z.object({
  available: z.array(z.string()), // ISO datetime strings
});
export type TimeslotsResponse = z.infer<typeof TimeslotsResponseSchema>;

export const CreateReviewRequestSchema = z.object({
  authorName: z
    .string()
    .min(1, 'Имя автора обязательно')
    .max(100, 'Имя слишком длинное'),
  rating: z
    .number()
    .int()
    .min(1, 'Оценка должна быть от 1 до 5')
    .max(5, 'Оценка должна быть от 1 до 5'),
  text: z
    .string()
    .min(10, 'Отзыв должен содержать минимум 10 символов')
    .max(1000, 'Отзыв не должен превышать 1000 символов'),
});
export type CreateReviewRequest = z.infer<typeof CreateReviewRequestSchema>;

export const ReviewSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(),
  createdAt: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const ReviewsResponseSchema = z.array(ReviewSchema);
export type ReviewsResponse = z.infer<typeof ReviewsResponseSchema>;
