import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { creatorSamples, creators } from '@/db/schema/index';
import { authError } from '@/auth/errors';

const sampleCategories = [
  'ugc',
  'lifestyle',
  'comedy',
  'fashion',
  'food',
  'tech',
  'beauty',
  'education',
  'gaming',
  'other',
] as const;

const sampleInputSchema = z
  .object({
    title: z.string().min(1).max(255),
    category: z.enum(sampleCategories),
    videoUrl: z.string().url().max(1024).optional(),
    externalLink: z.string().url().max(1024).optional(),
    note: z.string().max(2000).optional(),
  })
  .refine((data) => Boolean(data.videoUrl || data.externalLink), {
    message: 'Each sample must include a video URL or external link',
  });

const updateCreatorProfileSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  school: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  bio: z.string().max(2000).optional(),
  mainNiche: z.string().max(100).optional(),
  otherNiches: z.array(z.string().max(100)).optional(),
  tiktokHandle: z.string().max(100).optional(),
  instagramHandle: z.string().max(100).optional(),
  youtubeHandle: z.string().max(100).optional(),
  languagesSpoken: z.array(z.string().max(100)).optional(),
  equipment: z.array(z.string().max(100)).optional(),
  availability: z.string().max(100).optional(),
  samples: z.array(sampleInputSchema).optional(),
  completeProfile: z.boolean().optional(),
});

export type UpdateCreatorProfileInput = z.infer<typeof updateCreatorProfileSchema>;

export function formatCreator(creator: typeof creators.$inferSelect) {
  return {
    id: creator.id,
    fullName: creator.fullName,
    school: creator.school,
    country: creator.country,
    city: creator.city,
    phone: creator.phone,
    bio: creator.bio,
    mainNiche: creator.mainNiche,
    otherNiches: creator.otherNiches ?? [],
    tiktokHandle: creator.tiktokHandle,
    instagramHandle: creator.instagramHandle,
    youtubeHandle: creator.youtubeHandle,
    languagesSpoken: creator.languagesSpoken ?? [],
    equipment: creator.equipment ?? [],
    availability: creator.availability,
    kycStatus: creator.kycStatus,
    isProfileComplete: creator.isProfileComplete,
    createdAt: creator.createdAt.toISOString(),
  };
}

export async function getCreatorProfile(userId: string) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, userId),
  });

  if (!creator) return null;
  return formatCreator(creator);
}

export async function updateCreatorProfile(userId: string, input: unknown) {
  const data = updateCreatorProfileSchema.parse(input);

  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, userId),
  });

  if (!creator) {
    throw authError('USER_NOT_FOUND', 'Creator profile not found');
  }

  const { samples, completeProfile, ...profileFields } = data;

  await db.transaction(async (tx) => {
    await tx
      .update(creators)
      .set({
        ...profileFields,
        ...(completeProfile ? { isProfileComplete: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(creators.id, creator.id));

    if (samples) {
      await tx.delete(creatorSamples).where(eq(creatorSamples.creatorId, creator.id));

      if (samples.length > 0) {
        await tx.insert(creatorSamples).values(
          samples.map((sample) => ({
            creatorId: creator.id,
            title: sample.title,
            category: sample.category,
            videoUrl: sample.videoUrl,
            externalLink: sample.externalLink,
            note: sample.note,
          })),
        );
      }
    }
  });

  const updated = await db.query.creators.findFirst({
    where: eq(creators.id, creator.id),
  });

  if (!updated) {
    throw authError('USER_NOT_FOUND', 'Creator profile not found');
  }

  return formatCreator(updated);
}
