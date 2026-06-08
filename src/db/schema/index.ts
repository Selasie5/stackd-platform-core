import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['admin', 'brand', 'creator']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'pending', 'banned']);

export const kycStatusEnum = pgEnum('kyc_status', [
  'not_started',
  'pending_review',
  'approved',
  'rejected',
  'needs_more_info',
]);

export const kycProfileTypeEnum = pgEnum('kyc_profile_type', ['brand', 'creator']);

export const currencyEnum = pgEnum('currency', ['NGN', 'GHS', 'USD']);
export const walletStatusEnum = pgEnum('wallet_status', ['active', 'frozen', 'closed']);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'credit',
  'debit',
  'reserve',
  'release',
  'payout',
  'refund',
  'adjustment',
]);

export const opportunityStatusEnum = pgEnum('opportunity_status', [
  'draft',
  'pending_approval',
  'live',
  'paused',
  'closed',
  'cancelled',
  'completed',
]);

export const usageRightsPackageEnum = pgEnum('usage_rights_package', ['basic', 'ad', 'full']);

export const videoTypeEnum = pgEnum('video_type', [
  'ugc',
  'testimonial',
  'unboxing',
  'tutorial',
  'lifestyle',
  'trending_audio',
  'skit',
  'review',
  'other',
]);

export const targetPlatformEnum = pgEnum('target_platform', [
  'tiktok',
  'instagram',
  'youtube_shorts',
  'any',
]);

export const submissionStatusEnum = pgEnum('submission_status', [
  'submitted',
  'under_review',
  'shortlisted',
  'revision_requested',
  'resubmitted',
  'winner',
  'approved',
  'rejected',
  'disqualified',
  'paid',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'in_escrow',
  'awaiting_approval',
  'ready_for_payout',
  'paid',
  'disputed',
  'refunded',
]);

export const applicationStatusEnum = pgEnum('application_status', [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
]);

export const disputeStatusEnum = pgEnum('dispute_status', ['open', 'under_review', 'resolved', 'closed']);
export const disputeRaisedByEnum = pgEnum('dispute_raised_by', ['brand', 'creator', 'admin']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'kyc_submitted',
  'kyc_approved',
  'kyc_rejected',
  'kyc_needs_more_info',
  'verification_submitted',
  'verification_approved',
  'verification_rejected',
  'new_contest_launched',
  'new_ugc_order_launched',
  'new_cpm_deal_launched',
  'submission_received',
  'video_approved',
  'revision_requested',
  'shortlisted',
  'winner_selected',
  'payment_ready',
  'payment_paid',
  'wallet_funded',
  'wallet_insufficient',
  'contest_ending_soon',
  'application_accepted',
  'application_rejected',
  'dispute_opened',
  'dispute_resolved',
  'admin_kyc_pending_review',
  'admin_campaign_pending_review',
  'admin_dispute_opened',
]);

export const messageReferenceTypeEnum = pgEnum('message_reference_type', [
  'ugc_order',
  'cpm_deal',
  'contest',
  'dispute',
]);

export const sampleVideoCategoryEnum = pgEnum('sample_video_category', [
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
]);

export const viewVerificationStatusEnum = pgEnum('view_verification_status', [
  'unverified',
  'verified',
  'disputed',
]);

// ─── Auth & Users ───────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').default('pending').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 128 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: varchar('user_agent', { length: 512 }),
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Profiles ───────────────────────────────────────────────────────────────

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  brandName: varchar('brand_name', { length: 255 }).notNull(),
  website: varchar('website', { length: 512 }),
  country: varchar('country', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }),
  industry: varchar('industry', { length: 100 }),
  logoUrl: varchar('logo_url', { length: 1024 }),
  description: text('description'),
  contactName: varchar('contact_name', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  /** Cached from latest kyc_applications row — source of truth for gating */
  kycStatus: kycStatusEnum('kyc_status').default('not_started').notNull(),
  kycApprovedAt: timestamp('kyc_approved_at'),
  isProfileComplete: boolean('is_profile_complete').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const creators = pgTable('creators', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  school: varchar('school', { length: 255 }),
  country: varchar('country', { length: 100 }),
  city: varchar('city', { length: 100 }),
  phone: varchar('phone', { length: 50 }),
  bio: text('bio'),
  mainNiche: varchar('main_niche', { length: 100 }),
  otherNiches: jsonb('other_niches').$type<string[]>().default([]),
  tiktokHandle: varchar('tiktok_handle', { length: 100 }),
  instagramHandle: varchar('instagram_handle', { length: 100 }),
  youtubeHandle: varchar('youtube_handle', { length: 100 }),
  languagesSpoken: jsonb('languages_spoken').$type<string[]>().default([]),
  equipment: jsonb('equipment').$type<string[]>().default([]),
  availability: varchar('availability', { length: 100 }),
  paymentDetails: jsonb('payment_details').$type<{
    method: 'bank_transfer' | 'mobile_money';
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    mobileMoneyNumber?: string;
    mobileMoneyProvider?: string;
  }>(),
  /** Cached from latest kyc_applications row */
  kycStatus: kycStatusEnum('kyc_status').default('not_started').notNull(),
  kycApprovedAt: timestamp('kyc_approved_at'),
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }).default('0'),
  totalEarnings: numeric('total_earnings', { precision: 15, scale: 2 }).default('0'),
  isProfileComplete: boolean('is_profile_complete').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Unified KYC submissions for brands and creators.
 * Reapplications create a new row with incremented attemptNumber; previous rows kept for audit.
 */
export const kycApplications = pgTable(
  'kyc_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileType: kycProfileTypeEnum('profile_type').notNull(),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').default(1).notNull(),
    isCurrent: boolean('is_current').default(true).notNull(),
    status: kycStatusEnum('status').default('pending_review').notNull(),
    /** Flexible document list — supports country-specific business docs and student proofs */
    documents: jsonb('documents')
      .$type<
        Array<{
          documentType: string;
          fileUrl: string;
          fileName?: string;
          note?: string;
        }>
      >()
      .default([])
      .notNull(),
    /** Creator-specific: institutional email for cross-check */
    schoolEmail: varchar('school_email', { length: 255 }),
    applicantNote: text('applicant_note'),
    adminNote: text('admin_note'),
    rejectionReason: text('rejection_reason'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    brandCurrentIdx: index('kyc_brand_current_idx').on(table.brandId, table.isCurrent),
    creatorCurrentIdx: index('kyc_creator_current_idx').on(table.creatorId, table.isCurrent),
    statusIdx: index('kyc_status_idx').on(table.status),
  }),
);

export const creatorSamples = pgTable('creator_samples', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => creators.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  category: sampleVideoCategoryEnum('category').notNull(),
  videoUrl: varchar('video_url', { length: 1024 }),
  externalLink: varchar('external_link', { length: 1024 }),
  thumbnailUrl: varchar('thumbnail_url', { length: 1024 }),
  note: text('note'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Wallets ────────────────────────────────────────────────────────────────

export const brandWallets = pgTable('brand_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .unique()
    .references(() => brands.id, { onDelete: 'cascade' }),
  currency: currencyEnum('currency').notNull(),
  availableBalance: numeric('available_balance', { precision: 15, scale: 2 }).default('0').notNull(),
  reservedBalance: numeric('reserved_balance', { precision: 15, scale: 2 }).default('0').notNull(),
  totalSpent: numeric('total_spent', { precision: 15, scale: 2 }).default('0').notNull(),
  /** frozen until brand KYC approved — prevents funding before verification */
  status: walletStatusEnum('status').default('frozen').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const walletTopUpStatusEnum = pgEnum('wallet_top_up_status', [
  'pending',
  'completed',
  'failed',
]);

export const walletTopUps = pgTable('wallet_top_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  paystackReference: varchar('paystack_reference', { length: 255 }).notNull().unique(),
  status: walletTopUpStatusEnum('status').default('pending').notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const paystackEvents = pgTable('paystack_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  reference: varchar('reference', { length: 255 }),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id')
    .notNull()
    .references(() => brandWallets.id),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id),
  adminId: uuid('admin_id').references(() => users.id),
  transactionType: transactionTypeEnum('transaction_type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  balanceBefore: numeric('balance_before', { precision: 15, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 15, scale: 2 }).notNull(),
  reservedBefore: numeric('reserved_before', { precision: 15, scale: 2 }).notNull(),
  reservedAfter: numeric('reserved_after', { precision: 15, scale: 2 }).notNull(),
  description: text('description'),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Opportunities ────────────────────────────────────────────────────────────

export const ugcOrders = pgTable('ugc_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  shortDescription: varchar('short_description', { length: 500 }).notNull(),
  fullDescription: text('full_description').notNull(),
  externalBriefLink: varchar('external_brief_link', { length: 1024 }),
  videoType: videoTypeEnum('video_type').notNull(),
  videoLengthSeconds: integer('video_length_seconds').notNull(),
  numberOfCreators: integer('number_of_creators').notNull(),
  flatRatePerCreator: numeric('flat_rate_per_creator', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  totalBudget: numeric('total_budget', { precision: 15, scale: 2 }).notNull(),
  requiredShots: text('required_shots'),
  wordsToSay: text('words_to_say'),
  wordsToAvoid: text('words_to_avoid'),
  callToAction: varchar('call_to_action', { length: 255 }),
  usageRightsPackage: usageRightsPackageEnum('usage_rights_package').notNull(),
  postingRequired: boolean('posting_required').default(false).notNull(),
  targetPlatform: targetPlatformEnum('target_platform'),
  productDeliveryDetails: text('product_delivery_details'),
  revisionLimit: integer('revision_limit').default(1).notNull(),
  deadline: timestamp('deadline').notNull(),
  status: opportunityStatusEnum('status').default('draft').notNull(),
  reservedAt: timestamp('reserved_at'),
  completedAt: timestamp('completed_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cpmDeals = pgTable('cpm_deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  shortDescription: varchar('short_description', { length: 500 }).notNull(),
  fullDescription: text('full_description').notNull(),
  externalBriefLink: varchar('external_brief_link', { length: 1024 }),
  targetPlatform: targetPlatformEnum('target_platform').notNull(),
  requiredHashtags: text('required_hashtags'),
  requiredCaption: text('required_caption'),
  requiredBrandTag: varchar('required_brand_tag', { length: 255 }),
  payPer1000Views: numeric('pay_per_1000_views', { precision: 15, scale: 2 }).notNull(),
  maxPayableViewsPerCreator: integer('max_payable_views_per_creator').notNull(),
  numberOfCreators: integer('number_of_creators').notNull(),
  maxCampaignBudget: numeric('max_campaign_budget', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  usageRightsPackage: usageRightsPackageEnum('usage_rights_package').notNull(),
  productDeliveryDetails: text('product_delivery_details'),
  postingDeadline: timestamp('posting_deadline').notNull(),
  finalViewCountDeadline: timestamp('final_view_count_deadline').notNull(),
  status: opportunityStatusEnum('status').default('draft').notNull(),
  reservedAt: timestamp('reserved_at'),
  completedAt: timestamp('completed_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contests = pgTable('contests', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  shortDescription: varchar('short_description', { length: 500 }).notNull(),
  fullDescription: text('full_description').notNull(),
  externalBriefLink: varchar('external_brief_link', { length: 1024 }),
  category: varchar('category', { length: 100 }),
  videoType: videoTypeEnum('video_type'),
  videoLengthSeconds: integer('video_length_seconds'),
  targetPlatform: targetPlatformEnum('target_platform').notNull(),
  requiredHashtags: text('required_hashtags'),
  requiredCaption: text('required_caption'),
  requiredBrandTag: varchar('required_brand_tag', { length: 255 }),
  postingRequired: boolean('posting_required').default(false).notNull(),
  contestRules: text('contest_rules'),
  eligibilityRules: text('eligibility_rules'),
  usageRightsPackage: usageRightsPackageEnum('usage_rights_package').notNull(),
  productDeliveryDetails: text('product_delivery_details'),
  totalContestBudget: numeric('total_contest_budget', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  cpmBudget: numeric('cpm_budget', { precision: 15, scale: 2 }),
  payPer1000Views: numeric('pay_per_1000_views', { precision: 15, scale: 2 }),
  maxPayableViewsPerCreator: integer('max_payable_views_per_creator'),
  minimumWinners: integer('minimum_winners').default(15).notNull(),
  submissionDeadline: timestamp('submission_deadline').notNull(),
  winnerAnnouncementDate: timestamp('winner_announcement_date').notNull(),
  status: opportunityStatusEnum('status').default('draft').notNull(),
  reservedAt: timestamp('reserved_at'),
  completedAt: timestamp('completed_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contestRewards = pgTable('contest_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  placement: integer('placement').notNull(),
  label: varchar('label', { length: 100 }),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ugcOrderReferenceLinks = pgTable('ugc_order_reference_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  ugcOrderId: uuid('ugc_order_id')
    .notNull()
    .references(() => ugcOrders.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 1024 }).notNull(),
  label: varchar('label', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cpmDealReferenceLinks = pgTable('cpm_deal_reference_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  cpmDealId: uuid('cpm_deal_id')
    .notNull()
    .references(() => cpmDeals.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 1024 }).notNull(),
  label: varchar('label', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contestReferenceLinks = pgTable('contest_reference_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 1024 }).notNull(),
  label: varchar('label', { length: 255 }),
  isInspiration: boolean('is_inspiration').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Submissions ────────────────────────────────────────────────────────────

export const ugcSubmissions = pgTable('ugc_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ugcOrderId: uuid('ugc_order_id')
    .notNull()
    .references(() => ugcOrders.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => creators.id),
  videoUrl: varchar('video_url', { length: 1024 }),
  thumbnailUrl: varchar('thumbnail_url', { length: 1024 }),
  watermarkedPreviewUrl: varchar('watermarked_preview_url', { length: 1024 }),
  cleanVideoUrl: varchar('clean_video_url', { length: 1024 }),
  submissionNote: text('submission_note'),
  revisionNumber: integer('revision_number').default(0).notNull(),
  revisionNote: text('revision_note'),
  postingRequired: boolean('posting_required').default(false).notNull(),
  postedVideoLink: varchar('posted_video_link', { length: 1024 }),
  status: submissionStatusEnum('status').default('submitted').notNull(),
  approvedAt: timestamp('approved_at'),
  cleanVideoReleasedAt: timestamp('clean_video_released_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cpmSubmissions = pgTable('cpm_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  cpmDealId: uuid('cpm_deal_id')
    .notNull()
    .references(() => cpmDeals.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => creators.id),
  postedVideoLink: varchar('posted_video_link', { length: 1024 }).notNull(),
  platform: targetPlatformEnum('platform').notNull(),
  submissionNote: text('submission_note'),
  analyticsScreenshotUrl: varchar('analytics_screenshot_url', { length: 1024 }),
  submittedViews: integer('submitted_views').default(0).notNull(),
  autoFetchedViews: integer('auto_fetched_views'),
  approvedViews: integer('approved_views'),
  engagementCount: integer('engagement_count').default(0).notNull(),
  viewVerificationStatus: viewVerificationStatusEnum('view_verification_status')
    .default('unverified')
    .notNull(),
  calculatedPayout: numeric('calculated_payout', { precision: 15, scale: 2 }),
  status: submissionStatusEnum('status').default('submitted').notNull(),
  viewsVerifiedAt: timestamp('views_verified_at'),
  viewsVerifiedBy: uuid('views_verified_by').references(() => users.id),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contestSubmissions = pgTable(
  'contest_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contestId: uuid('contest_id')
      .notNull()
      .references(() => contests.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id),
    videoUrl: varchar('video_url', { length: 1024 }),
    videoLink: varchar('video_link', { length: 1024 }),
    thumbnailUrl: varchar('thumbnail_url', { length: 1024 }),
    watermarkedPreviewUrl: varchar('watermarked_preview_url', { length: 1024 }),
    cleanVideoUrl: varchar('clean_video_url', { length: 1024 }),
    submissionNote: text('submission_note'),
    postingRequired: boolean('posting_required').default(false).notNull(),
    postedVideoLink: varchar('posted_video_link', { length: 1024 }),
    platform: targetPlatformEnum('platform'),
    analyticsScreenshotUrl: varchar('analytics_screenshot_url', { length: 1024 }),
    submittedViews: integer('submitted_views').default(0).notNull(),
    autoFetchedViews: integer('auto_fetched_views'),
    approvedViews: integer('approved_views'),
    engagementCount: integer('engagement_count').default(0).notNull(),
    viewVerificationStatus: viewVerificationStatusEnum('view_verification_status')
      .default('unverified')
      .notNull(),
    leaderboardScore: integer('leaderboard_score').default(0).notNull(),
    placement: integer('placement'),
    rewardAmount: numeric('reward_amount', { precision: 15, scale: 2 }),
    cpmPayout: numeric('cpm_payout', { precision: 15, scale: 2 }),
    confirmedFollowsBrief: boolean('confirmed_follows_brief').default(false).notNull(),
    confirmedOriginal: boolean('confirmed_original').default(false).notNull(),
    confirmedNoFakeEngagement: boolean('confirmed_no_fake_engagement').default(false).notNull(),
    agreedToUsageRights: boolean('agreed_to_usage_rights').default(false).notNull(),
    status: submissionStatusEnum('status').default('submitted').notNull(),
    shortlistedAt: timestamp('shortlisted_at'),
    winnerSelectedAt: timestamp('winner_selected_at'),
    cleanVideoReleasedAt: timestamp('clean_video_released_at'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    contestIdIdx: index('cs_contest_id_idx').on(table.contestId),
    creatorIdIdx: index('cs_creator_id_idx').on(table.creatorId),
    statusIdx: index('cs_status_idx').on(table.status),
    leaderboardIdx: index('cs_leaderboard_idx').on(table.contestId, table.leaderboardScore),
    mostViewedIdx: index('cs_most_viewed_idx').on(table.contestId, table.approvedViews),
    mostEngagedIdx: index('cs_most_engaged_idx').on(table.contestId, table.engagementCount),
  }),
);

// ─── Payments & Disputes ────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => creators.id),
  referenceType: varchar('reference_type', { length: 50 }).notNull(),
  referenceId: uuid('reference_id').notNull(),
  opportunityType: varchar('opportunity_type', { length: 50 }).notNull(),
  opportunityId: uuid('opportunity_id').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  status: paymentStatusEnum('status').default('in_escrow').notNull(),
  processedBy: uuid('processed_by').references(() => users.id),
  processedAt: timestamp('processed_at'),
  paystackReference: varchar('paystack_reference', { length: 255 }),
  paystackStatus: varchar('paystack_status', { length: 100 }),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  raisedBy: disputeRaisedByEnum('raised_by').notNull(),
  raisedByUserId: uuid('raised_by_user_id')
    .notNull()
    .references(() => users.id),
  referenceType: varchar('reference_type', { length: 50 }).notNull(),
  referenceId: uuid('reference_id').notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: disputeStatusEnum('status').default('open').notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id),
  resolution: text('resolution'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Communication ──────────────────────────────────────────────────────────

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => users.id),
  recipientId: uuid('recipient_id')
    .notNull()
    .references(() => users.id),
  referenceType: messageReferenceTypeEnum('reference_type'),
  referenceId: uuid('reference_id'),
  body: text('body').notNull(),
  attachmentUrl: varchar('attachment_url', { length: 1024 }),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 512 }).notNull(),
    platform: varchar('platform', { length: 20 }).notNull(),
    lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userTokenIdx: index('device_tokens_user_token_idx').on(table.userId, table.token),
  }),
);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Relations ──────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  brand: one(brands, { fields: [users.id], references: [brands.userId] }),
  creator: one(creators, { fields: [users.id], references: [creators.userId] }),
  sessions: many(sessions),
  notifications: many(notifications),
  deviceTokens: many(deviceTokens),
  sentMessages: many(messages, { relationName: 'sentMessages' }),
  receivedMessages: many(messages, { relationName: 'receivedMessages' }),
  kycApplications: many(kycApplications),
  reviewedKycApplications: many(kycApplications, { relationName: 'reviewedKycApplications' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  user: one(users, { fields: [brands.userId], references: [users.id] }),
  wallet: one(brandWallets, { fields: [brands.id], references: [brandWallets.brandId] }),
  walletTopUps: many(walletTopUps),
  kycApplications: many(kycApplications),
  ugcOrders: many(ugcOrders),
  cpmDeals: many(cpmDeals),
  contests: many(contests),
}));

export const creatorsRelations = relations(creators, ({ one, many }) => ({
  user: one(users, { fields: [creators.userId], references: [users.id] }),
  kycApplications: many(kycApplications),
  samples: many(creatorSamples),
  contestSubmissions: many(contestSubmissions),
  ugcSubmissions: many(ugcSubmissions),
  cpmSubmissions: many(cpmSubmissions),
  payments: many(payments),
}));

export const kycApplicationsRelations = relations(kycApplications, ({ one }) => ({
  user: one(users, { fields: [kycApplications.userId], references: [users.id] }),
  brand: one(brands, { fields: [kycApplications.brandId], references: [brands.id] }),
  creator: one(creators, { fields: [kycApplications.creatorId], references: [creators.id] }),
  reviewedBy: one(users, {
    fields: [kycApplications.reviewedBy],
    references: [users.id],
    relationName: 'reviewedKycApplications',
  }),
}));

export const creatorSamplesRelations = relations(creatorSamples, ({ one }) => ({
  creator: one(creators, { fields: [creatorSamples.creatorId], references: [creators.id] }),
}));

export const walletTopUpsRelations = relations(walletTopUps, ({ one }) => ({
  brand: one(brands, { fields: [walletTopUps.brandId], references: [brands.id] }),
}));

export const brandWalletsRelations = relations(brandWallets, ({ one, many }) => ({
  brand: one(brands, { fields: [brandWallets.brandId], references: [brands.id] }),
  transactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(brandWallets, {
    fields: [walletTransactions.walletId],
    references: [brandWallets.id],
  }),
  brand: one(brands, { fields: [walletTransactions.brandId], references: [brands.id] }),
  admin: one(users, { fields: [walletTransactions.adminId], references: [users.id] }),
}));

export const ugcOrdersRelations = relations(ugcOrders, ({ one, many }) => ({
  brand: one(brands, { fields: [ugcOrders.brandId], references: [brands.id] }),
  referenceLinks: many(ugcOrderReferenceLinks),
  submissions: many(ugcSubmissions),
}));

export const cpmDealsRelations = relations(cpmDeals, ({ one, many }) => ({
  brand: one(brands, { fields: [cpmDeals.brandId], references: [brands.id] }),
  referenceLinks: many(cpmDealReferenceLinks),
  submissions: many(cpmSubmissions),
}));

export const contestsRelations = relations(contests, ({ one, many }) => ({
  brand: one(brands, { fields: [contests.brandId], references: [brands.id] }),
  referenceLinks: many(contestReferenceLinks),
  rewards: many(contestRewards),
  submissions: many(contestSubmissions),
}));

export const contestRewardsRelations = relations(contestRewards, ({ one }) => ({
  contest: one(contests, { fields: [contestRewards.contestId], references: [contests.id] }),
}));

export const ugcOrderReferenceLinksRelations = relations(ugcOrderReferenceLinks, ({ one }) => ({
  ugcOrder: one(ugcOrders, {
    fields: [ugcOrderReferenceLinks.ugcOrderId],
    references: [ugcOrders.id],
  }),
}));

export const cpmDealReferenceLinksRelations = relations(cpmDealReferenceLinks, ({ one }) => ({
  cpmDeal: one(cpmDeals, {
    fields: [cpmDealReferenceLinks.cpmDealId],
    references: [cpmDeals.id],
  }),
}));

export const contestReferenceLinksRelations = relations(contestReferenceLinks, ({ one }) => ({
  contest: one(contests, {
    fields: [contestReferenceLinks.contestId],
    references: [contests.id],
  }),
}));

export const ugcSubmissionsRelations = relations(ugcSubmissions, ({ one }) => ({
  ugcOrder: one(ugcOrders, { fields: [ugcSubmissions.ugcOrderId], references: [ugcOrders.id] }),
  creator: one(creators, { fields: [ugcSubmissions.creatorId], references: [creators.id] }),
}));

export const cpmSubmissionsRelations = relations(cpmSubmissions, ({ one }) => ({
  cpmDeal: one(cpmDeals, { fields: [cpmSubmissions.cpmDealId], references: [cpmDeals.id] }),
  creator: one(creators, { fields: [cpmSubmissions.creatorId], references: [creators.id] }),
  viewsVerifiedBy: one(users, {
    fields: [cpmSubmissions.viewsVerifiedBy],
    references: [users.id],
  }),
}));

export const contestSubmissionsRelations = relations(contestSubmissions, ({ one }) => ({
  contest: one(contests, {
    fields: [contestSubmissions.contestId],
    references: [contests.id],
  }),
  creator: one(creators, {
    fields: [contestSubmissions.creatorId],
    references: [creators.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  creator: one(creators, { fields: [payments.creatorId], references: [creators.id] }),
  processedBy: one(users, { fields: [payments.processedBy], references: [users.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  raisedByUser: one(users, {
    fields: [disputes.raisedByUserId],
    references: [users.id],
    relationName: 'raisedDisputes',
  }),
  assignedTo: one(users, {
    fields: [disputes.assignedTo],
    references: [users.id],
    relationName: 'assignedDisputes',
  }),
  resolvedBy: one(users, {
    fields: [disputes.resolvedBy],
    references: [users.id],
    relationName: 'resolvedDisputes',
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'sentMessages',
  }),
  recipient: one(users, {
    fields: [messages.recipientId],
    references: [users.id],
    relationName: 'receivedMessages',
  }),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, { fields: [deviceTokens.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
