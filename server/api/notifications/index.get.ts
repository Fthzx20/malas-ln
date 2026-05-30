import { and, desc, eq, lt } from 'drizzle-orm'
import { notifications } from '@@/server/database/schema'
import { getOptionalUser } from '@@/server/utils/auth'
import { withDB } from '@@/server/utils/db'

export default defineEventHandler(async (event) => {
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

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50)
  const cursor = typeof query.cursor === 'string' && query.cursor ? new Date(query.cursor) : null

  const { items, unreadCount } = await withDB(async (db) => {
    const [itemsResult, unreadCountResult] = await Promise.all([
      db.query.notifications.findMany({
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
      }),
      db.$count(
        notifications,
        and(eq(notifications.recipientId, user.profileId), eq(notifications.isRead, false)),
      ),
    ])

    return {
      items: itemsResult,
      unreadCount: unreadCountResult,
    }
  })

  const hasMore = items.length > limit
  const sliced = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.createdAt?.toISOString?.() ?? null : null

  return {
    authenticated: true,
    items: sliced,
    nextCursor,
    hasMore,
    unreadCount,
  }
})
