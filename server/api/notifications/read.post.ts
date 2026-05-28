import { inArray, eq, and } from 'drizzle-orm'
import { throwApiError } from '@@/server/utils/errors'
import { notifications } from '@@/server/database/schema'
import { withDB } from '@@/server/utils/db'

export default defineEventHandler(async (event) => {
  let user
  try {
    user = await requireAuth(event)
  } catch (_err) {
    throwApiError(401, 'Authentication required')
  }
  if (!user.profileId) {
    throwApiError(401, 'Authentication required')
  }

  const body = await readBody(event)

  return await withDB(async (db) => {
    if (body.all === true) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.recipientId, user.profileId))
      return { ok: true }
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : []
    if (!ids.length) {
      throwApiError(400, 'ids are required')
    }

    // SECURITY: Only mark notifications belonging to the authenticated user
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        inArray(notifications.id, ids),
        eq(notifications.recipientId, user.profileId),
      ))

    return { ok: true }
  })

})


