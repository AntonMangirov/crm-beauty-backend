import { z } from 'zod';

// Схема для создания услуги
export const CreateServiceSchema = z.object({
  name: z
    .string()
    .min(1, 'Название услуги обязательно')
    .max(100, 'Название услуги слишком длинное'),
  price: z
    .number()
    .positive('Цена должна быть положительной')
    .max(999999.99, 'Цена слишком большая'),
  durationMin: z
    .number()
    .int()
    .positive('Длительность должна быть положительным числом')
    .max(1440, 'Длительность не может превышать 24 часа'),
  description: z.string().max(500, 'Описание слишком длинное').optional(),
});

// Схема для обновления услуги
export const UpdateServiceSchema = z.object({
  name: z
    .string()
    .min(1, 'Название услуги обязательно')
    .max(100, 'Название услуги слишком длинное')
    .optional(),
  price: z
    .number()
    .positive('Цена должна быть положительной')
    .max(999999.99, 'Цена слишком большая')
    .optional(),
  durationMin: z
    .number()
    .int()
    .positive('Длительность должна быть положительным числом')
    .max(1440, 'Длительность не может превышать 24 часа')
    .optional(),
  description: z.string().max(500, 'Описание слишком длинное').optional(),
  isActive: z.boolean().optional(),
});

// Схема для ответа с услугой
export const ServiceResponseSchema = z.object({
  id: z.string(),
  masterId: z.string(),
  name: z.string(),
  price: z.number(),
  durationMin: z.number(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Схема для ответа со списком услуг
export const ServicesListResponseSchema = z.array(ServiceResponseSchema);

// Типы для TypeScript
export type CreateServiceRequest = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceRequest = z.infer<typeof UpdateServiceSchema>;
export type ServiceResponse = z.infer<typeof ServiceResponseSchema>;
export type ServicesListResponse = z.infer<typeof ServicesListResponseSchema>;
