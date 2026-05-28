import { relations } from 'drizzle-orm'
import {
  profiles,
  novels,
  volumes,
  chapters,
  footnotes,
  bookmarks,
  ratings,
  comments,
  notifications,
  forumCategories,
  forumPosts,
  forumReplies,
  reports,
  readingHistory,
} from './tables'

/* ============================================================
   RELATIONS
   ============================================================ */

export const profilesRelations = relations(profiles, ({ many }) => ({
  chapters: many(chapters),
  bookmarks: many(bookmarks),
  ratings: many(ratings),
  comments: many(comments),
  forumPosts: many(forumPosts),
  forumReplies: many(forumReplies),
  reports: many(reports),
  readingHistory: many(readingHistory),
  receivedNotifications: many(notifications, { relationName: 'notificationRecipient' }),
  sentNotifications: many(notifications, { relationName: 'notificationActor' }),
}))

export const novelsRelations = relations(novels, ({ many }) => ({
  volumes: many(volumes),
  chapters: many(chapters),
  bookmarks: many(bookmarks),
  ratings: many(ratings),
  readingHistory: many(readingHistory),
}))

export const volumesRelations = relations(volumes, ({ one, many }) => ({
  novel: one(novels, {
    fields: [volumes.novelId],
    references: [novels.id],
  }),
  chapters: many(chapters),
}))

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  novel: one(novels, {
    fields: [chapters.novelId],
    references: [novels.id],
  }),
  volume: one(volumes, {
    fields: [chapters.volumeId],
    references: [volumes.id],
  }),
  translator: one(profiles, {
    fields: [chapters.translatorId],
    references: [profiles.id],
  }),
  footnotes: many(footnotes),
  comments: many(comments),
  readingHistory: many(readingHistory),
}))

export const footnotesRelations = relations(footnotes, ({ one }) => ({
  chapter: one(chapters, {
    fields: [footnotes.chapterId],
    references: [chapters.id],
  }),
}))

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(profiles, {
    fields: [bookmarks.userId],
    references: [profiles.id],
  }),
  novel: one(novels, {
    fields: [bookmarks.novelId],
    references: [novels.id],
  }),
  currentChapter: one(chapters, {
    fields: [bookmarks.currentChapterId],
    references: [chapters.id],
  }),
}))

export const ratingsRelations = relations(ratings, ({ one }) => ({
  user: one(profiles, {
    fields: [ratings.userId],
    references: [profiles.id],
  }),
  novel: one(novels, {
    fields: [ratings.novelId],
    references: [novels.id],
  }),
}))

export const commentsRelations = relations(comments, ({ one, many }) => ({
  user: one(profiles, {
    fields: [comments.userId],
    references: [profiles.id],
  }),
  chapter: one(chapters, {
    fields: [comments.chapterId],
    references: [chapters.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'commentThread',
  }),
  replies: many(comments, {
    relationName: 'commentThread',
  }),
}))

export const forumCategoriesRelations = relations(forumCategories, ({ many }) => ({
  posts: many(forumPosts),
}))

export const forumPostsRelations = relations(forumPosts, ({ one, many }) => ({
  category: one(forumCategories, {
    fields: [forumPosts.categoryId],
    references: [forumCategories.id],
  }),
  user: one(profiles, {
    fields: [forumPosts.userId],
    references: [profiles.id],
  }),
  replies: many(forumReplies),
}))

export const forumRepliesRelations = relations(forumReplies, ({ one }) => ({
  post: one(forumPosts, {
    fields: [forumReplies.postId],
    references: [forumPosts.id],
  }),
  user: one(profiles, {
    fields: [forumReplies.userId],
    references: [profiles.id],
  }),
}))

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(profiles, {
    fields: [reports.reporterId],
    references: [profiles.id],
    relationName: 'reporterReports',
  }),
  reviewer: one(profiles, {
    fields: [reports.reviewedBy],
    references: [profiles.id],
    relationName: 'reviewerReports',
  }),
}))

export const readingHistoryRelations = relations(readingHistory, ({ one }) => ({
  user: one(profiles, {
    fields: [readingHistory.userId],
    references: [profiles.id],
  }),
  chapter: one(chapters, {
    fields: [readingHistory.chapterId],
    references: [chapters.id],
  }),
  novel: one(novels, {
    fields: [readingHistory.novelId],
    references: [novels.id],
  }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(profiles, {
    fields: [notifications.recipientId],
    references: [profiles.id],
    relationName: 'notificationRecipient',
  }),
  actor: one(profiles, {
    fields: [notifications.actorId],
    references: [profiles.id],
    relationName: 'notificationActor',
  }),
}))
