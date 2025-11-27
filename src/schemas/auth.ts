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

// Схемы для восстановления пароля
export const PasswordResetRequestSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(3).max(32).optional(),
    recaptchaToken: z.string().min(1).optional(),
  })
  .refine(data => data.email || data.phone, {
    message: 'Необходимо указать email или телефон',
  });
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetRequestResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  resetToken: z.string(), // Токен для следующего шага верификации кода
  code: z.string().optional(), // Код только в режиме разработки для тестирования
});
export type PasswordResetRequestResponse = z.infer<
  typeof PasswordResetRequestResponseSchema
>;

export const PasswordResetVerifySchema = z.object({
  resetToken: z.string().min(1),
  code: z.string().length(6).regex(/^\d+$/, 'Код должен состоять из 6 цифр'),
});
export type PasswordResetVerify = z.infer<typeof PasswordResetVerifySchema>;

export const PasswordResetVerifyResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  verifiedToken: z.string(), // Токен для сброса пароля
});
export type PasswordResetVerifyResponse = z.infer<
  typeof PasswordResetVerifyResponseSchema
>;

export const PasswordResetSchema = z.object({
  verifiedToken: z.string().min(1),
  newPassword: z.string().min(6).max(128),
});
export type PasswordReset = z.infer<typeof PasswordResetSchema>;

export const PasswordResetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type PasswordResetResponse = z.infer<typeof PasswordResetResponseSchema>;
