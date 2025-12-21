import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10).default('testsecret123456'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  MAINTENANCE_MODE: z.enum(['true', 'false']).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.format());
  throw new Error('Invalid environment variables');
}

const env = parsed.data;

if (env.NODE_ENV !== 'production') {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
    console.warn('Warning: SMTP settings are missing; email notifications will be disabled in this environment.');
  }
  if (!env.FRONTEND_URL) {
    console.warn('Warning: FRONTEND_URL not set, defaulting to http://localhost:5173');
  }
}

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT ? parseInt(env.PORT, 10) : 9000,
  jwtSecret: env.JWT_SECRET,
  smtpHost: env.SMTP_HOST,
  smtpPort: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : undefined,
  smtpUser: env.SMTP_USER,
  smtpPass: env.SMTP_PASS,
  smtpFrom: env.SMTP_FROM,
  frontendUrl: env.FRONTEND_URL || 'http://localhost:5173',
  maintenanceMode: env.MAINTENANCE_MODE === 'true',
};

export default config;
