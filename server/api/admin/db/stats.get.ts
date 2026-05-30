import { withDB } from '@@/server/utils/db'
import { requireRole } from '@@/server/utils/auth'
import { getAdminCache, setAdminCache } from '@@/server/utils/admin-cache'
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
  const cacheKey = 'admin:db:stats:v1'
  const cached = getAdminCache<{ counts: Record<string, number> }>(cacheKey)
  if (cached) {
    return cached
  }

  const response = await withDB(async (db) => {
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

    return {
      counts: {
        novels: novelsCount,
        chapters: chaptersCount,
        comments: commentsCount,
        forumPosts: forumPostsCount,
        forumReplies: forumRepliesCount,
        notifications: notificationsCount,
        profiles: profilesCount,
        ratings: ratingsCount,
        bookmarks: bookmarksCount,
      },
    }
  })

  setAdminCache(cacheKey, response, 15000)
  return response
})
