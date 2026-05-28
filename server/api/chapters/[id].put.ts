import { bookmarks, chapters, novels } from '@@/server/database/schema'
import { eq, sql } from 'drizzle-orm'
import { createNotificationsForUsers } from '@@/server/utils/notifications'
import { purgeNovelSlugCache } from '@@/server/utils/cache'
import { throwApiError } from '@@/server/utils/errors'
import { purgeOnWrite } from '@@/server/utils/purge'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { logger } from '@@/server/utils/logger'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'translator', 'admin')
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throwApiError(400, 'Chapter ID is required')
  }

  validateUUID(id, 'id')

  return await withDB(async (db) => {
    // Verify chapter exists
    const existing = await db.query.chapters.findFirst({
      where: (c, { eq }) => eq(c.id, id),
    })

    if (!existing) {
      throwApiError(404, 'Chapter not found')
    }

  const updateData: Record<string, any> = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.chapterNumber !== undefined) updateData.chapterNumber = body.chapterNumber
  if (body.content !== undefined) {
    updateData.content = body.content
    // Recalculate word count
    updateData.wordCount = body.content.trim().split(/\s+/).filter(Boolean).length
  }
  if (body.translatorGroup !== undefined) updateData.translatorGroup = body.translatorGroup
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished
  if (body.publishAt !== undefined) updateData.publishAt = body.publishAt ? new Date(body.publishAt) : null
  
  updateData.updatedAt = new Date()

    // Update in a transaction
    const updatedChapter = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(chapters)
      .set(updateData)
      .where(eq(chapters.id, id))
      .returning()

    if (!updated) {
      throwApiError(500, 'Failed to update chapter')
    }

    // If changing publication status, update novel word count / chapter counts
    if (body.isPublished !== undefined && body.isPublished !== existing.isPublished) {
      const isNowPublished = body.isPublished
      const wordDiff = updated.wordCount - (isNowPublished ? 0 : existing.wordCount)
      
      await tx
        .update(novels)
        .set({
          totalChapters: sql`${novels.totalChapters} + ${isNowPublished ? 1 : -1}`,
          totalWords: sql`${novels.totalWords} + ${wordDiff}`,
          updatedAt: new Date(),
        })
        .where(eq(novels.id, existing.novelId))

      if (isNowPublished) {
        const followers = await tx.query.bookmarks.findMany({
          where: (b, { eq }) => eq(b.novelId, existing.novelId),
          columns: { userId: true },
        })

        await createNotificationsForUsers(tx, followers.map(follower => ({
          recipientId: follower.userId,
          actorId: user.profileId,
          type: 'chapter_update',
          title: 'Chapter updated',
          body: `${updated.title} is now published.`,
          link: `/read/${updated.id}`,
          entityId: updated.id,
        })))
      }
    }

        return updated
      })

      // Purge novel caches so readers see updated chapter changes
      try {
        await purgeOnWrite({ type: 'novelById', novelId: existing.novelId })
      } catch (e) {
        logger.warn('Failed to purge novel cache after chapter update', e)
      }

      return updatedChapter
    })
})
