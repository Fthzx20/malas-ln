import { bookmarks } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { throwApiError } from '@@/server/utils/errors'
import { purgeOnWrite } from '@@/server/utils/purge'
import { logger } from '@@/server/utils/logger'

export default defineEventHandler(async (event) => {
  let user
  try {
    user = await requireAuth(event)
  } catch (_err) {
    throwApiError(401, 'Authentication required')
  }

  if (!user.profileId) {
    throwApiError(400, 'Missing profileId on authenticated user')
  }
  const params = getRouterParams(event) as { novelId?: string }

  if (!params.novelId) {
    throwApiError(400, 'novelId required')
  }

  validateUUID(params.novelId, 'novelId')

  return await withDB(async (db) => {
    // Find existing bookmark
    const existing = await db.query.bookmarks.findFirst({
      where: (b, { eq, and }) => and(
        eq(b.userId, user.profileId),
        eq(b.novelId, params.novelId),
      ),
    })

    if (!existing) {
      return { ok: false }
    }

    await db.delete(bookmarks).where(eq(bookmarks.id, existing.id))

    try { await purgeOnWrite({ type: 'novelById', novelId: params.novelId }) } catch (e) { logger.warn('Failed to purge novel cache after bookmark delete', e) }

    return { ok: true }
  })
})
