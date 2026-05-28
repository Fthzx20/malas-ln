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
  const counts = {
    novels: await db.$count(novels),
    chapters: await db.$count(chapters),
    comments: await db.$count(comments),
    forumPosts: await db.$count(forumPosts),
    forumReplies: await db.$count(forumReplies),
    notifications: await db.$count(notifications),
    profiles: await db.$count(profiles),
    ratings: await db.$count(ratings),
    bookmarks: await db.$count(bookmarks),
  }

  return { counts }
})
