import { z } from 'zod';
import { isValidISOString } from '../utils/timeUtils';
import {
  isValidPhoneFormat,
  isValidBookingDate,
  isWorkingHours,
  isWorkingDay,
} from '../utils/validation';

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
});
export type PublicProfileResponse = z.infer<typeof PublicProfileResponseSchema>;

export const SlugParamSchema = z.object({ slug: z.string().min(1) });
export type SlugParams = z.infer<typeof SlugParamSchema>;

export const BookingRequestSchema = z
  .object({
    name: z.string().min(1, 'Имя обязательно').max(100, 'Имя слишком длинное'),
    phone: z.string().min(1, 'Телефон обязателен').refine(isValidPhoneFormat, {
      message:
        'Неверный формат телефона. Используйте формат: +7 (999) 123-45-67',
    }),
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
      })
      .refine(date => isWorkingHours(date), {
        message: 'Время записи должно быть в рабочих часах (9:00 - 18:00 UTC)',
      })
      .refine(date => isWorkingDay(date), {
        message: 'Запись возможна только в рабочие дни (понедельник - пятница)',
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
