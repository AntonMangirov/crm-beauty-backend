import { z } from 'zod';

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.union([z.string(), z.number()]),
  durationMin: z.number().int(),
});

export const PublicProfileResponseSchema = z.object({
  name: z.string(),
  photoUrl: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  services: z.array(ServiceSchema),
});
export type PublicProfileResponse = z.infer<typeof PublicProfileResponseSchema>;

export const BookingRequestSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(5).max(32),
  serviceId: z.string().min(1),
  startAt: z.coerce.date(),
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
