import { z } from 'zod';

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(100),
  phone: z.string().min(3).max(32).optional(),
  recaptchaToken: z.string().min(1).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  slug: z.string(),
  phone: z.string().nullish(),
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
