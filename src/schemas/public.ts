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
