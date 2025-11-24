import { z } from 'zod';

// Схема для обновления профиля мастера (PATCH - только указанные поля)
export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Имя обязательно')
    .max(100, 'Имя слишком длинное')
    .optional(),
  description: z
    .union([z.string().max(2000, 'Описание слишком длинное'), z.null()])
    .optional(),
  address: z
    .union([z.string().max(200, 'Адрес слишком длинный'), z.null()])
    .optional(),
  photoUrl: z
    .union([
      z.string().refine(
        val => {
          // Принимаем полные URL (http/https) или относительные пути для локального хранилища
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
        { message: 'Некорректный URL фото' }
      ),
      z.null(),
    ])
    .optional(),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

// Схема для фильтров записей
// Поддерживаем оба варианта: from/to (короткие) и dateFrom/dateTo (для обратной совместимости)
export const AppointmentsFilterSchema = z.object({
  // Короткие параметры (предпочтительные)
  from: z
    .string()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid from format',
    }),
  to: z
    .string()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid to format',
    }),
  // Старые параметры (для обратной совместимости)
  dateFrom: z
    .string()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid dateFrom format',
    }),
  dateTo: z
    .string()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid dateTo format',
    }),
  status: z
    .enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW'])
    .optional(),
  serviceId: z.string().optional(),
  clientId: z.string().optional(),
});

export type AppointmentsFilterRequest = z.infer<
  typeof AppointmentsFilterSchema
>;

// Схема для обновления статуса записи
export const UpdateAppointmentStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELED', 'COMPLETED']),
});

export type UpdateAppointmentStatusRequest = z.infer<
  typeof UpdateAppointmentStatusSchema
>;

// Схема для ответа /me с полной информацией о мастере
export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  slug: z.string(),
  phone: z.string().nullable(),
  description: z.string().nullable(),
  photoUrl: z.string().nullable(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  vkUrl: z.string().nullable(),
  telegramUrl: z.string().nullable(),
  whatsappUrl: z.string().nullable(),
  backgroundImageUrl: z.string().nullable(),
  rating: z.number().nullable(),
  isActive: z.boolean(),
  role: z.enum(['MASTER', 'ADMIN']),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Статистика
  stats: z.object({
    totalServices: z.number(),
    activeServices: z.number(),
    totalAppointments: z.number(),
    upcomingAppointments: z.number(),
    completedAppointments: z.number(),
    totalClients: z.number(),
  }),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

// Схема для ответа списка клиентов
export const ClientListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  lastVisit: z.date().nullable(), // Дата последнего завершенного посещения
  visitsCount: z.number(), // Количество завершенных посещений
  photosCount: z.number(), // Количество фото у клиента
});

export type ClientListItem = z.infer<typeof ClientListItemSchema>;

// Схема для ответа истории клиента
export const ClientHistoryItemSchema = z.object({
  id: z.string(),
  date: z.date(), // Дата записи (startAt)
  service: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
  }),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW']),
  photos: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      description: z.string().nullable(),
      createdAt: z.date(),
    })
  ),
});

export const ClientHistoryResponseSchema = z.array(ClientHistoryItemSchema);

export type ClientHistoryItem = z.infer<typeof ClientHistoryItemSchema>;
export type ClientHistoryResponse = z.infer<typeof ClientHistoryResponseSchema>;

// Схема для ответа загрузки фото к записи
export const UploadedPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
});

export const UploadAppointmentPhotosResponseSchema = z.object({
  photos: z.array(UploadedPhotoSchema),
});

export type UploadedPhoto = z.infer<typeof UploadedPhotoSchema>;
export type UploadAppointmentPhotosResponse = z.infer<
  typeof UploadAppointmentPhotosResponseSchema
>;

// Схема для ответа аналитики
export const AnalyticsResponseSchema = z.object({
  appointmentsCount: z.number(), // Количество записей за месяц
  revenue: z.number(), // Доход за месяц
  topServices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      count: z.number(), // Количество записей
    })
  ), // Топ 5 услуг
  newClientsPercentage: z.number(), // % новых клиентов
});

export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
