import { z } from 'zod';
import { isValidISOString } from '../utils/timeUtils';
import {
  isValidPhoneFormat,
  isValidBookingDate,
  isWorkingHours,
  isWorkingDay,
} from '../utils/validation';

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.union([z.string(), z.number()]),
  durationMin: z.number().int(),
});

export const PublicProfileResponseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  photoUrl: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
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
