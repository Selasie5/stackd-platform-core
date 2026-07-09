import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_COOKIE_NAME: z.string().default('spleenet_session'),
  SESSION_TTL_SECONDS: z.coerce.number().default(86400),
  SESSION_REDIS_PREFIX: z.string().default('session:'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_DOMAIN: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@spleenet.com'),
  EMAIL_VERIFY_TTL_SECONDS: z.coerce.number().default(86400),
  EMAIL_VERIFY_REDIS_PREFIX: z.string().default('email_verify:'),
  PASSWORD_RESET_OTP_TTL_SECONDS: z.coerce.number().default(600),
  PASSWORD_RESET_OTP_REDIS_PREFIX: z.string().default('password_reset_otp:'),
  PASSWORD_RESET_OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  NOTIFICATION_QUEUE_NAME: z.string().default('notifications'),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.coerce.boolean().default(true),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(['paystack', 'moolre']).default('paystack'),
  MOOLRE_BASE_URL: z.string().default('https://api.moolre.com'),
  MOOLRE_API_USER: z.string().optional(),
  MOOLRE_API_KEY: z.string().optional(),
  MOOLRE_API_PUBKEY: z.string().optional(),
  MOOLRE_WEBHOOK_SECRET: z.string().optional(),
  MOOLRE_WEBHOOK_URL: z.string().optional(),
  MOOLRE_ACCOUNT_NUMBER: z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = result.data;
