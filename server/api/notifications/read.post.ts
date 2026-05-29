import { inArray, eq, and } from 'drizzle-orm'
import { notifications } from '@@/server/database/schema'
import { withDB } from '@@/server/utils/db'
import { getOptionalUser } from '@@/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getOptionalUser(event)
  if (!user?.profileId) {
    return { ok: false, authenticated: false }
  }

  const body = await readBody(event)

  return await withDB(async (db) => {
    if (body.all === true) {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.recipientId, user.profileId as string))
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
        eq(notifications.recipientId, user.profileId as string),
      ))

    return { ok: true }
  })
})