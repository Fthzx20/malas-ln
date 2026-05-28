import { comments } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { logger } from '@@/server/utils/logger'
import { purgeOnWrite } from '@@/server/utils/purge'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  // Moderate platform comments, restrict to administrator role
  await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throwApiError(400, 'Comment ID is required')
  }

  validateUUID(id, 'id')

  return await withDB(async (db) => {
    const existing = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, id),
    })

    if (!existing) {
      throwApiError(404, 'Comment not found')
    }

    const [deleted] = await db
      .delete(comments)
      .where(eq(comments.id, id))
      .returning()

    // Purge parent novel cache so readers see updated comment counts
    try {
      if (deleted?.chapterId) {
        const chap = await db.query.chapters.findFirst({
          where: (c, { eq }) => eq(c.id, deleted.chapterId),
          columns: { novelId: true },
        })
        if (chap?.novelId) await purgeOnWrite({ type: 'novelById', novelId: chap.novelId })
      }
    } catch (e) {
      logger.warn('Failed to purge novel cache after comment delete', e)
    }

    return {
      success: true,
      message: 'Comment successfully deleted from chapter'
    }
  })
})
