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

// Схемы для изменения пароля, email и телефона
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
    newPassword: z
      .string()
      .min(6, 'Новый пароль должен содержать минимум 6 символов')
      .max(128, 'Пароль слишком длинный'),
  })
  .refine(data => data.currentPassword !== data.newPassword, {
    message: 'Новый пароль должен отличаться от текущего',
    path: ['newPassword'],
  });

export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;

export const ChangeEmailSchema = z.object({
  newEmail: z.string().email('Некорректный email адрес'),
  password: z.string().min(1, 'Пароль обязателен для подтверждения'),
});

export type ChangeEmailRequest = z.infer<typeof ChangeEmailSchema>;

export const ChangePhoneSchema = z.object({
  newPhone: z
    .string()
    .min(3, 'Телефон слишком короткий')
    .max(32, 'Телефон слишком длинный'),
});

export type ChangePhoneRequest = z.infer<typeof ChangePhoneSchema>;

// Схемы ответов
export const ChangePasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const ChangeEmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  email: z.string().email(),
});

export const ChangePhoneResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  phone: z.string().nullable(),
});

export type ChangePasswordResponse = z.infer<
  typeof ChangePasswordResponseSchema
>;
export type ChangeEmailResponse = z.infer<typeof ChangeEmailResponseSchema>;
export type ChangePhoneResponse = z.infer<typeof ChangePhoneResponseSchema>;

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

// Схема для переноса записи (изменения времени)
export const RescheduleAppointmentSchema = z.object({
  startAt: z.string().datetime(),
});

export type RescheduleAppointmentRequest = z.infer<
  typeof RescheduleAppointmentSchema
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
  telegramUsername: z.string().nullable(),
  firstVisit: z.date().nullable(), // Дата первого завершенного посещения
  lastVisit: z.date().nullable(), // Дата последнего завершенного посещения
  visitsCount: z.number(), // Количество завершенных посещений
  photosCount: z.number(), // Количество фото у клиента
  notes: z.string().nullable(), // Заметки о клиенте
});

export type ClientListItem = z.infer<typeof ClientListItemSchema>;

// Схема для обновления клиента
export const UpdateClientSchema = z.object({
  name: z
    .string()
    .min(1, 'Имя обязательно')
    .max(100, 'Имя слишком длинное')
    .optional(),
  notes: z
    .string()
    .max(2000, 'Заметки слишком длинные (максимум 2000 символов)')
    .nullable()
    .optional(),
});

export type UpdateClientRequest = z.infer<typeof UpdateClientSchema>;

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

// Схема для обновления расписания мастера
const TimeStringSchema = z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
  message: 'Время должно быть в формате HH:mm (например, 09:00)',
});

const WorkIntervalSchema = z
  .object({
    from: TimeStringSchema,
    to: TimeStringSchema,
  })
  .refine(
    data => {
      const [fromHours, fromMinutes] = data.from.split(':').map(Number);
      const [toHours, toMinutes] = data.to.split(':').map(Number);
      const fromTime = fromHours * 60 + fromMinutes;
      const toTime = toHours * 60 + toMinutes;
      return fromTime < toTime;
    },
    {
      message: 'Время начала (from) должно быть меньше времени окончания (to)',
    }
  );

const DayScheduleSchema = z.object({
  dayOfWeek: z
    .number()
    .int()
    .min(0, 'День недели должен быть от 0 до 6')
    .max(6, 'День недели должен быть от 0 до 6'),
  intervals: z
    .array(WorkIntervalSchema)
    .min(1, 'Должен быть хотя бы один рабочий интервал')
    .refine(
      intervals => {
        // Проверяем, что интервалы не пересекаются
        for (let i = 0; i < intervals.length; i++) {
          for (let j = i + 1; j < intervals.length; j++) {
            const interval1 = intervals[i];
            const interval2 = intervals[j];

            const [from1Hours, from1Minutes] = interval1.from
              .split(':')
              .map(Number);
            const [to1Hours, to1Minutes] = interval1.to.split(':').map(Number);
            const [from2Hours, from2Minutes] = interval2.from
              .split(':')
              .map(Number);
            const [to2Hours, to2Minutes] = interval2.to.split(':').map(Number);

            const from1Time = from1Hours * 60 + from1Minutes;
            const to1Time = to1Hours * 60 + to1Minutes;
            const from2Time = from2Hours * 60 + from2Minutes;
            const to2Time = to2Hours * 60 + to2Minutes;

            // Проверяем пересечение: интервалы пересекаются если
            // from1 < to2 && from2 < to1
            if (from1Time < to2Time && from2Time < to1Time) {
              return false;
            }
          }
        }
        return true;
      },
      {
        message: 'Рабочие интервалы не должны пересекаться',
      }
    ),
});

const BreakSchema = z
  .object({
    from: TimeStringSchema,
    to: TimeStringSchema,
    reason: z.string().max(200, 'Причина перерыва слишком длинная').optional(),
  })
  .refine(
    data => {
      const [fromHours, fromMinutes] = data.from.split(':').map(Number);
      const [toHours, toMinutes] = data.to.split(':').map(Number);
      const fromTime = fromHours * 60 + fromMinutes;
      const toTime = toHours * 60 + toMinutes;
      return fromTime < toTime;
    },
    {
      message:
        'Время начала перерыва (from) должно быть меньше времени окончания (to)',
    }
  );

export const UpdateScheduleSchema = z
  .object({
    workSchedule: z
      .array(DayScheduleSchema)
      .optional()
      .refine(
        schedule => {
          if (!schedule) return true;
          // Проверяем, что нет дубликатов дней недели
          const dayOfWeeks = schedule.map(s => s.dayOfWeek);
          return new Set(dayOfWeeks).size === dayOfWeeks.length;
        },
        {
          message: 'Не должно быть дубликатов дней недели в расписании',
        }
      ),
    breaks: z.array(BreakSchema).optional(),
    defaultBufferMinutes: z
      .number()
      .int()
      .min(10, 'Буфер должен быть не менее 10 минут')
      .max(30, 'Буфер не должен превышать 30 минут')
      .optional(),
    slotStepMinutes: z
      .union([z.literal(5), z.literal(10), z.literal(15)])
      .optional(),
  })
  .refine(
    data => {
      // Проверяем, что перерывы не выходят за рабочие интервалы
      if (!data.workSchedule || !data.breaks || data.breaks.length === 0) {
        return true;
      }

      // Создаем карту рабочих интервалов по дням недели
      const workIntervalsByDay = new Map<
        number,
        Array<{ from: number; to: number }>
      >();

      for (const daySchedule of data.workSchedule) {
        const intervals = daySchedule.intervals.map(interval => {
          const [fromHours, fromMinutes] = interval.from.split(':').map(Number);
          const [toHours, toMinutes] = interval.to.split(':').map(Number);
          return {
            from: fromHours * 60 + fromMinutes,
            to: toHours * 60 + toMinutes,
          };
        });
        workIntervalsByDay.set(daySchedule.dayOfWeek, intervals);
      }

      // Проверяем каждый перерыв
      for (const breakItem of data.breaks) {
        const [breakFromHours, breakFromMinutes] = breakItem.from
          .split(':')
          .map(Number);
        const [breakToHours, breakToMinutes] = breakItem.to
          .split(':')
          .map(Number);
        const breakFromTime = breakFromHours * 60 + breakFromMinutes;
        const breakToTime = breakToHours * 60 + breakToMinutes;

        // Перерыв должен находиться внутри хотя бы одного рабочего интервала любого дня
        let foundInWorkInterval = false;

        for (const [, intervals] of workIntervalsByDay) {
          for (const interval of intervals) {
            // Перерыв находится внутри интервала если
            // breakFrom >= interval.from && breakTo <= interval.to
            if (breakFromTime >= interval.from && breakToTime <= interval.to) {
              foundInWorkInterval = true;
              break;
            }
          }
          if (foundInWorkInterval) break;
        }

        if (!foundInWorkInterval) {
          return false;
        }
      }

      return true;
    },
    {
      message: 'Перерывы должны находиться внутри рабочих интервалов',
    }
  );

export type UpdateScheduleRequest = z.infer<typeof UpdateScheduleSchema>;

export const UpdateScheduleResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  schedule: z.object({
    workSchedule: z.array(DayScheduleSchema).nullable(),
    breaks: z.array(BreakSchema).nullable(),
    defaultBufferMinutes: z.number().int().nullable(),
    slotStepMinutes: z.number().int().nullable(),
  }),
});

export type UpdateScheduleResponse = z.infer<
  typeof UpdateScheduleResponseSchema
>;
