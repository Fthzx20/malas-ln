import { withDB } from '@@/server/utils/db'
import { requireRole } from '@@/server/utils/auth'
import {
  novels,
  chapters,
  comments,
  forumPosts,
  forumReplies,
  notifications,
  profiles,
  ratings,
  bookmarks,
} from '@@/server/database/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const db = useDB()

  // Basic counts for quick profiling dashboard
  const [
    novelsCount,
    chaptersCount,
    commentsCount,
    forumPostsCount,
    forumRepliesCount,
    notificationsCount,
    profilesCount,
    ratingsCount,
    bookmarksCount,
  ] = await Promise.all([
    db.$count(novels),
    db.$count(chapters),
    db.$count(comments),
    db.$count(forumPosts),
    db.$count(forumReplies),
    db.$count(notifications),
    db.$count(profiles),
    db.$count(ratings),
    db.$count(bookmarks),
  ])

  const counts = {
    novels: novelsCount,
    chapters: chaptersCount,
    comments: commentsCount,
    forumPosts: forumPostsCount,
    forumReplies: forumRepliesCount,
    notifications: notificationsCount,
    profiles: profilesCount,
    ratings: ratingsCount,
    bookmarks: bookmarksCount,
  }

  return { counts }
})
