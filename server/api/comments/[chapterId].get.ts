import { comments } from '@@/server/database/schema'
import { and, desc, eq, isNull, lt } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { throwApiError } from '@@/server/utils/errors'
import { logger } from '@@/server/utils/logger'

export default defineEventHandler(async (event) => {
  const chapterId = getRouterParam(event, 'chapterId')
  if (!chapterId) {
    throwApiError(400, 'Chapter ID is required')
  }
  validateUUID(chapterId, 'chapterId')

  const db = useDB()
  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50)
  const cursor = typeof query.cursor === 'string' && query.cursor ? new Date(query.cursor) : null

  // Fetch top-level comments with nested replies (2 levels)
  let topLevelComments
  try {
    topLevelComments = await db.query.comments.findMany({
    where: (c, { eq, and, isNull, lt }) => and(
      eq(c.chapterId, chapterId),
      isNull(c.parentId),
      eq(c.isFlagged, false),
      cursor ? lt(c.createdAt, cursor) : undefined,
    ),
    with: {
      user: {
        columns: { id: true, displayName: true, username: true, avatarUrl: true, role: true },
      },
      replies: {
        where: (c, { eq }) => eq(c.isFlagged, false),
        with: {
          user: {
            columns: { id: true, displayName: true, username: true, avatarUrl: true, role: true },
          },
          replies: {
            where: (c, { eq }) => eq(c.isFlagged, false),
            with: {
              user: {
                columns: { id: true, displayName: true, username: true, avatarUrl: true, role: true },
              },
            },
            orderBy: (c, { asc }) => [asc(c.createdAt)],
          },
        },
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      },
    },
    orderBy: (c, { desc }) => [desc(c.createdAt)],
    limit: limit + 1,
    })
  } catch (err) {
    logger.error('[comments] Failed to fetch comments for chapter', chapterId, err)
    throwApiError(503, 'Service temporarily unavailable')
  }

  const hasMore = topLevelComments.length > limit
  const items = hasMore ? topLevelComments.slice(0, limit) : topLevelComments
  const nextCursor = hasMore ? items[items.length - 1]?.createdAt?.toISOString?.() ?? null : null

  return { items, nextCursor, hasMore }
})
