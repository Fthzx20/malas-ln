import { forumPosts, forumReplies } from '@@/server/database/schema'
import { eq, sql } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { throwApiError } from '@@/server/utils/errors'
import { logger } from '@@/server/utils/logger'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwApiError(400, 'Post ID is required')
  }
  validateUUID(id, 'Post ID')

  const db = useDB()

  // Get post details
  const post = await db.query.forumPosts.findFirst({
    where: (p, { eq, and }) => and(eq(p.id, id), eq(p.isFlagged, false)),
    with: {
      user: {
        columns: { id: true, displayName: true, username: true, avatarUrl: true, role: true },
      },
      category: true,
    },
  })

  if (!post) {
    throwApiError(404, 'Forum post not found')
  }

  // Increment view count asynchronously
  db.update(forumPosts)
    .set({ viewCount: sql`${forumPosts.viewCount} + 1` })
    .where(eq(forumPosts.id, id))
    .execute()
    .catch((err) => logger.warn('Failed to increment view count:', err))

  // Get replies
  const replies = await db.query.forumReplies.findMany({
    where: (r, { eq, and }) => and(eq(r.postId, id), eq(r.isFlagged, false)),
    with: {
      user: {
        columns: { id: true, displayName: true, username: true, avatarUrl: true, role: true },
      },
    },
    orderBy: (r, { asc }) => [asc(r.createdAt)],
  })

  return { post, replies }
})
