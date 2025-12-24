import { z } from 'zod';

// Schema for login
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

// Schema for forgot password
export const forgotPasswordSchema = z.object({
  username: z.string().min(1)
});

// Schema for reset password validation
export const resetPasswordValidationSchema = z.object({
  token: z.string().min(1)
});

// Schema for reset password
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8)
});
