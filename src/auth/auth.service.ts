import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { brandWallets, brands, creators, users } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import { redisClient } from '@/queues/client';
import { hashPassword, verifyPassword } from '@/auth/password';
import {
  buildEmailVerifyKey,
  EMAIL_VERIFY_TTL_SECONDS,
} from '@/auth/constants';
import { authError } from '@/auth/errors';
import { createSession, revokeSession } from '@/auth/session.service';
import { sendVerificationEmail } from '@/services/email/index';
import type { EmailVerificationPayload, SessionData, UserRole } from '@/auth/types';

const registerBrandSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  brandName: z.string().min(1).max(255),
  country: z.string().min(1).max(100),
  contactName: z.string().min(1).max(255),
  currency: z.enum(['NGN', 'GHS', 'USD']).optional(),
});

const registerCreatorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(255),
  country: z.string().min(1).max(100).optional(),
  school: z.string().max(255).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type UserWithProfiles = InferSelectModel<typeof users> & {
  brand: InferSelectModel<typeof brands> | null;
  creator: InferSelectModel<typeof creators> | null;
};

function currencyForCountry(country: string): 'NGN' | 'GHS' | 'USD' {
  const c = country.toLowerCase();
  if (c.includes('nigeria') || c === 'ng') return 'NGN';
  if (c.includes('ghana') || c === 'gh') return 'GHS';
  return 'USD';
}

export function formatUser(user: UserWithProfiles) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    brand: user.brand
      ? {
          id: user.brand.id,
          brandName: user.brand.brandName,
          kycStatus: user.brand.kycStatus,
        }
      : null,
    creator: user.creator
      ? {
          id: user.creator.id,
          fullName: user.creator.fullName,
          kycStatus: user.creator.kycStatus,
        }
      : null,
  };
}

async function findUserByEmail(email: string): Promise<UserWithProfiles | undefined> {
  return db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
    with: { brand: true, creator: true },
  });
}

async function findUserById(id: string): Promise<UserWithProfiles | undefined> {
  return db.query.users.findFirst({
    where: eq(users.id, id),
    with: { brand: true, creator: true },
  });
}

async function createEmailVerificationToken(userId: string, email: string): Promise<string> {
  const token = randomUUID();
  const payload: EmailVerificationPayload = { userId, email };
  await redisClient.set(
    buildEmailVerifyKey(token),
    JSON.stringify(payload),
    'EX',
    EMAIL_VERIFY_TTL_SECONDS,
  );
  return token;
}

async function buildSessionData(user: UserWithProfiles): Promise<SessionData> {
  return {
    userId: user.id,
    role: user.role as UserRole,
    email: user.email,
    emailVerified: user.emailVerified,
    brandId: user.brand?.id,
    creatorId: user.creator?.id,
  };
}

export async function registerBrand(input: unknown) {
  const data = registerBrandSchema.parse(input);
  const email = data.email.toLowerCase();

  const existing = await findUserByEmail(email);
  if (existing) {
    throw authError('USER_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(data.password);
  const currency = data.currency ?? currencyForCountry(data.country);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      role: 'brand',
      status: 'pending',
      emailVerified: false,
    })
    .returning();

  const [brand] = await db
    .insert(brands)
    .values({
      userId: user.id,
      brandName: data.brandName,
      country: data.country,
      contactName: data.contactName,
    })
    .returning();

  await db.insert(brandWallets).values({
    brandId: brand.id,
    currency,
    status: 'frozen',
  });

  const token = await createEmailVerificationToken(user.id, email);
  await sendVerificationEmail(email, token);

  const fullUser = await findUserById(user.id);
  return {
    message: 'Check your email to verify your account before logging in',
    user: formatUser(fullUser!),
  };
}

export async function registerCreator(input: unknown) {
  const data = registerCreatorSchema.parse(input);
  const email = data.email.toLowerCase();

  const existing = await findUserByEmail(email);
  if (existing) {
    throw authError('USER_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(data.password);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      role: 'creator',
      status: 'pending',
      emailVerified: false,
    })
    .returning();

  await db.insert(creators).values({
    userId: user.id,
    fullName: data.fullName,
    country: data.country,
    school: data.school,
  });

  const token = await createEmailVerificationToken(user.id, email);
  await sendVerificationEmail(email, token);

  const fullUser = await findUserById(user.id);
  return {
    message: 'Check your email to verify your account before logging in',
    user: formatUser(fullUser!),
  };
}

export async function login(
  input: unknown,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const data = loginSchema.parse(input);
  const user = await findUserByEmail(data.email);

  if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
    throw authError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!user.emailVerified) {
    throw authError(
      'EMAIL_NOT_VERIFIED',
      'Please verify your email before logging in. Use resendVerificationEmail if needed.',
    );
  }

  if (user.status === 'suspended' || user.status === 'banned') {
    throw authError('ACCOUNT_SUSPENDED', 'Your account has been suspended');
  }

  const sessionData = await buildSessionData(user);
  const token = await createSession(sessionData, meta);

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), status: 'active' })
    .where(eq(users.id, user.id));

  const updatedUser = await findUserById(user.id);
  return { user: formatUser(updatedUser!), token };
}

export async function logout(sessionToken: string | undefined): Promise<boolean> {
  if (sessionToken) {
    await revokeSession(sessionToken);
  }
  return true;
}

export async function verifyEmail(token: string, meta?: { ipAddress?: string; userAgent?: string }) {
  const raw = await redisClient.get(buildEmailVerifyKey(token));
  if (!raw) {
    throw authError('INVALID_TOKEN', 'Verification link is invalid or has expired');
  }

  const payload = JSON.parse(raw) as EmailVerificationPayload;
  await redisClient.del(buildEmailVerifyKey(token));

  await db
    .update(users)
    .set({ emailVerified: true, status: 'active' })
    .where(eq(users.id, payload.userId));

  const user = await findUserById(payload.userId);
  if (!user) {
    throw authError('USER_NOT_FOUND', 'User not found');
  }

  const sessionData = await buildSessionData({ ...user, emailVerified: true, status: 'active' });
  const sessionToken = await createSession(sessionData, meta);

  const updatedUser = await findUserById(user.id);
  return { user: formatUser(updatedUser!), token: sessionToken };
}

export async function resendVerificationEmail(email: string): Promise<boolean> {
  const normalized = email.toLowerCase();
  const rateLimitKey = `resend_verify:${normalized}`;
  const count = await redisClient.incr(rateLimitKey);
  if (count === 1) {
    await redisClient.expire(rateLimitKey, 3600);
  }
  if (count > 3) {
    throw authError('RATE_LIMITED', 'Too many requests. Please try again later.');
  }

  const user = await findUserByEmail(normalized);
  if (!user) {
    return true;
  }

  if (user.emailVerified) {
    return true;
  }

  const token = await createEmailVerificationToken(user.id, normalized);
  await sendVerificationEmail(normalized, token);
  return true;
}

export async function getMe(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw authError('USER_NOT_FOUND', 'User not found');
  }
  return formatUser(user);
}
