import { pgTable, pgEnum, uuid, text, integer, timestamp, boolean, real, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/* ============================================================
   ENUMS
   ============================================================ */
export const userRoleEnum = pgEnum('user_role', ['user', 'translator', 'admin'])
export const novelStatusEnum = pgEnum('novel_status', ['ongoing', 'hiatus', 'completed'])
export const bookmarkStatusEnum = pgEnum('bookmark_status', ['reading', 'plan_to_read', 'on_hold', 'completed'])
export const reportTargetEnum = pgEnum('report_target_type', ['comment', 'forum_post', 'review'])
export const reportReasonEnum = pgEnum('report_reason', ['spoiler', 'harassment', 'dead_link', 'spam', 'inappropriate', 'other'])
export const reportStatusEnum = pgEnum('report_status', ['pending', 'reviewed', 'dismissed'])

/* ============================================================
   PROFILES
   ============================================================ */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  authId: uuid('auth_id').notNull().unique(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  role: userRoleEnum('role').notNull().default('user'),
  readingStats: text('reading_stats'), // JSON string: { wordsRead, chaptersRead, novelsCompleted }
  isBanned: boolean('is_banned').notNull().default(false),
  banReason: text('ban_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('profiles_auth_id_idx').on(table.authId),
  uniqueIndex('profiles_username_idx').on(table.username),
  index('profiles_role_created_idx').on(table.role, table.createdAt),
])

/* ============================================================
   NOVELS
   ============================================================ */
export const novels = pgTable('novels', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  synopsis: text('synopsis').notNull(),
  coverUrl: text('cover_url'),
  author: text('author').notNull(),
  illustrator: text('illustrator'),
  publisher: text('publisher'),
  year: integer('year'),
  status: novelStatusEnum('status').notNull().default('ongoing'),
  genreTags: text('genre_tags').array().notNull().default(sql`'{}'::text[]`),
  taxonomyTags: text('taxonomy_tags').array().notNull().default(sql`'{}'::text[]`),
  totalChapters: integer('total_chapters').notNull().default(0),
  totalWords: integer('total_words').notNull().default(0),
  avgRating: real('avg_rating').default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  isFeatured: boolean('is_featured').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('novels_slug_idx').on(table.slug),
  index('novels_status_idx').on(table.status),
  index('novels_featured_idx').on(table.isFeatured),
  index('novels_year_idx').on(table.year),
  index('novels_updated_at_idx').on(table.updatedAt),
  index('novels_rating_count_idx').on(table.ratingCount),
  index('novels_avg_rating_idx').on(table.avgRating),
])

/* ============================================================
   VOLUMES
   ============================================================ */
export const volumes = pgTable('volumes', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  volumeNumber: integer('volume_number').notNull(),
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  synopsis: text('synopsis'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('volumes_novel_id_idx').on(table.novelId),
])

/* ============================================================
   CHAPTERS
   ============================================================ */
export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  volumeId: uuid('volume_id').references(() => volumes.id, { onDelete: 'set null' }),
  chapterNumber: real('chapter_number').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  wordCount: integer('word_count').notNull().default(0),
  translatorId: uuid('translator_id').references(() => profiles.id, { onDelete: 'set null' }),
  translatorGroup: text('translator_group'),
  isPublished: boolean('is_published').notNull().default(false),
  publishAt: timestamp('publish_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('chapters_novel_id_idx').on(table.novelId),
  index('chapters_volume_id_idx').on(table.volumeId),
  index('chapters_published_idx').on(table.isPublished),
  index('chapters_publish_at_idx').on(table.publishAt),
  index('chapters_novel_published_number_idx').on(table.novelId, table.isPublished, table.chapterNumber),
])

/* ============================================================
   FOOTNOTES
   ============================================================ */
export const footnotes = pgTable('footnotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  marker: text('marker').notNull(),
  content: text('content').notNull(),
  positionIndex: integer('position_index').notNull().default(0),
}, (table) => [
  index('footnotes_chapter_id_idx').on(table.chapterId),
])

/* ============================================================
   BOOKMARKS
   ============================================================ */
export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  status: bookmarkStatusEnum('status').notNull().default('plan_to_read'),
  currentChapterId: uuid('current_chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  scrollPosition: real('scroll_position').default(0),
  progressPct: real('progress_pct').default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('bookmarks_user_novel_idx').on(table.userId, table.novelId),
  index('bookmarks_user_id_idx').on(table.userId),
  index('bookmarks_status_idx').on(table.status),
])

/* ============================================================
   RATINGS
   ============================================================ */
export const ratings = pgTable('ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  overall: integer('overall').notNull(),
  story: integer('story'),
  translation: integer('translation'),
  characters: integer('characters'),
  reviewText: text('review_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ratings_user_novel_idx').on(table.userId, table.novelId),
  index('ratings_novel_id_idx').on(table.novelId),
  index('ratings_novel_overall_idx').on(table.novelId, table.overall),
])

/* ============================================================
   COMMENTS (Self-referencing for threading)
   ============================================================ */
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  isFlagged: boolean('is_flagged').notNull().default(false),
  flagReason: text('flag_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('comments_chapter_id_idx').on(table.chapterId),
  index('comments_parent_id_idx').on(table.parentId),
  index('comments_user_id_idx').on(table.userId),
])

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: uuid('recipient_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'),
  entityId: text('entity_id'),
  isRead: boolean('is_read').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notifications_recipient_idx').on(table.recipientId),
  index('notifications_recipient_read_idx').on(table.recipientId, table.isRead),
  index('notifications_recipient_created_idx').on(table.recipientId, table.createdAt),
  index('notifications_read_idx').on(table.isRead),
  index('notifications_created_idx').on(table.createdAt),
  index('notifications_expires_idx').on(table.expiresAt),
])

/* ============================================================
   SITE NOTICE (GLOBAL HOMEPAGE POPUP)
   ============================================================ */
export const siteNotice = pgTable('site_notice', {
  id: text('id').primaryKey().default('homepage-popup'),
  message: text('message').notNull().default(''),
  isActive: boolean('is_active').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/* ============================================================
   SITE SETTINGS (GLOBAL CONFIGURATION)
   ============================================================ */
export const siteSettings = pgTable('site_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // stored as JSON string
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('site_settings_category_idx').on(table.category),
])

/* ============================================================
   FORUM
   ============================================================ */
export const forumCategories = pgTable('forum_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const forumPosts = pgTable('forum_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => forumCategories.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').notNull().default(false),
  isLocked: boolean('is_locked').notNull().default(false),
  isFlagged: boolean('is_flagged').notNull().default(false),
  viewCount: integer('view_count').notNull().default(0),
  replyCount: integer('reply_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('forum_posts_category_idx').on(table.categoryId),
  index('forum_posts_user_idx').on(table.userId),
  index('forum_posts_pinned_idx').on(table.isPinned),
  index('forum_posts_category_flagged_pinned_updated_idx').on(table.categoryId, table.isFlagged, table.isPinned, table.updatedAt),
])

export const forumReplies = pgTable('forum_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isFlagged: boolean('is_flagged').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('forum_replies_post_idx').on(table.postId),
  index('forum_replies_user_idx').on(table.userId),
  index('forum_replies_post_flagged_created_idx').on(table.postId, table.isFlagged, table.createdAt),
])

/* ============================================================
   REPORTS
   ============================================================ */
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  targetType: reportTargetEnum('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  reason: reportReasonEnum('reason').notNull(),
  description: text('description'),
  status: reportStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('reports_status_idx').on(table.status),
  index('reports_reporter_idx').on(table.reporterId),
  index('reports_status_created_idx').on(table.status, table.createdAt),
])

/* ============================================================
   READING HISTORY
   ============================================================ */
export const readingHistory = pgTable('reading_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull(),
  timeSpentSeconds: integer('time_spent_seconds').default(0),
}, (table) => [
  index('reading_history_user_idx').on(table.userId),
  index('reading_history_novel_idx').on(table.novelId),
  index('reading_history_read_at_user_idx').on(table.readAt, table.userId),
])
