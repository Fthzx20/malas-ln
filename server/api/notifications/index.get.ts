import { and, desc, eq, lt } from 'drizzle-orm'
import { notifications } from '@@/server/database/schema'
import { logger } from '@@/server/utils/logger'
import { getOptionalUser } from '@@/server/utils/auth'

export default defineEventHandler(async (event) => {
  logger.info('[api] notifications GET start')
  const user = await getOptionalUser(event)
  if (!user?.profileId) {
    return {
      authenticated: false,
      items: [],
      nextCursor: null,
      hasMore: false,
      unreadCount: 0,
    }
  }
  logger.info('[api] notifications GET after requireAuth')

  const db = useDB()

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50)
  const cursor = typeof query.cursor === 'string' && query.cursor ? new Date(query.cursor) : null

  const items = await db.query.notifications.findMany({
    where: (n, { and, eq, lt }) => and(
      eq(n.recipientId, user.profileId as string),
      cursor ? lt(n.createdAt, cursor) : undefined,
    ),
    with: {
      actor: {
        columns: { id: true, displayName: true, username: true, avatarUrl: true, role: true },
      },
    },
    orderBy: (n, { desc }) => [desc(n.createdAt)],
    limit: limit + 1,
  })

  const hasMore = items.length > limit
  const sliced = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.createdAt?.toISOString?.() ?? null : null
  const unreadCount = await db.$count(notifications, and(eq(notifications.recipientId, user.profileId), eq(notifications.isRead, false)))

  logger.info('[api] notifications GET DB queries complete')

  return {
    authenticated: true,
    items: sliced,
    nextCursor,
    hasMore,
    unreadCount,
  }
})
