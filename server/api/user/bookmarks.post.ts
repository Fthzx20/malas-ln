import { bookmarks } from '@@/server/database/schema'
import { eq, and } from 'drizzle-orm'
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
  const body = await readBody(event)

  if (!body.novelId) {
    throwApiError(400, 'novelId is required')
  }

  // Use withDB for resilience
  return await withDB(async (db) => {
    // Upsert bookmark
    const profileId = user.profileId as string
    const existing = await db.query.bookmarks.findFirst({
      where: (b, { eq, and }) => and(
        eq(b.userId, profileId),
        eq(b.novelId, body.novelId),
      ),
    })

    if (existing) {
      const [updated] = await db
        .update(bookmarks)
        .set({
          status: body.status || existing.status,
          currentChapterId: body.currentChapterId ?? existing.currentChapterId,
          scrollPosition: body.scrollPosition ?? existing.scrollPosition,
          progressPct: body.progressPct ?? existing.progressPct,
          updatedAt: new Date(),
        })
        .where(eq(bookmarks.id, existing.id))
        .returning()

      // Best-effort purge novel cache so readers see updated bookmark counts
      try { await purgeOnWrite({ type: 'novelById', novelId: body.novelId }) } catch (e) { logger.warn('Failed to purge novel cache after bookmark update', e) }
      return updated
    }

    const [created] = await db
      .insert(bookmarks)
      .values({
        userId: profileId,
        novelId: body.novelId,
        status: body.status || 'plan_to_read',
        currentChapterId: body.currentChapterId || null,
        scrollPosition: body.scrollPosition || 0,
        progressPct: body.progressPct || 0,
      })
      .returning()

    try { await purgeOnWrite({ type: 'novelById', novelId: body.novelId }) } catch (e) { logger.warn('Failed to purge novel cache after bookmark create', e) }
    return created
  })
})
