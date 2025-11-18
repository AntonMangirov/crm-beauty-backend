import { z } from 'zod';
import { isValidISOString } from '../utils/timeUtils';

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

export const BookingRequestSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(5).max(32),
  serviceId: z.string().min(1),
  startAt: z
    .string()
    .refine(isValidISOString, {
      message:
        'startAt must be a valid ISO string (e.g., "2024-01-01T10:00:00.000Z")',
    })
    .transform(isoString => new Date(isoString)),
  comment: z.string().max(500).optional(),
});
export type BookingRequest = z.infer<typeof BookingRequestSchema>;

export const BookingResponseSchema = z.object({
  id: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW']),
});
export type BookingResponse = z.infer<typeof BookingResponseSchema>;
