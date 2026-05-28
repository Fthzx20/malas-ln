import { bookmarks, chapters, novels } from '@@/server/database/schema'
import { eq, sql } from 'drizzle-orm'
import { purgeNovelSlugCache } from '@@/server/utils/cache'
import { purgeOnWrite } from '@@/server/utils/purge'
import { createNotificationsForUsers } from '@@/server/utils/notifications'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { logger } from '@@/server/utils/logger'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'translator', 'admin')
  const body = await readBody(event)

  if (!body.novelId || !body.title || body.chapterNumber === undefined) {
    throwApiError(400, 'novelId, title, and chapterNumber are required')
  }

  validateUUID(body.novelId, 'novelId')

  // Use withDB wrapper for resilience
  return await withDB(async (db) => {
    // Calculate word count
    const wordCount = body.content
      ? body.content.trim().split(/\s+/).filter(Boolean).length
      : 0

    const [chapter] = await db
      .insert(chapters)
      .values({
        novelId: body.novelId,
        volumeId: body.volumeId || null,
        chapterNumber: body.chapterNumber,
        title: body.title,
        content: body.content || '',
        wordCount,
        translatorId: user.profileId,
        translatorGroup: body.translatorGroup || null,
        isPublished: body.isPublished || false,
        publishAt: body.publishAt ? new Date(body.publishAt) : null,
      })
      .returning()

    if (!chapter) {
      throwApiError(500, 'Failed to create chapter')
    }

    // Update novel chapter/word counts
    if (chapter.isPublished) {
      await db
        .update(novels)
        .set({
          totalChapters: sql`${novels.totalChapters} + 1`,
          totalWords: sql`${novels.totalWords} + ${wordCount}`,
          updatedAt: new Date(),
        })
        .where(eq(novels.id, body.novelId))

      const followers = await db.query.bookmarks.findMany({
        where: (b, { eq }) => eq(b.novelId, body.novelId),
        columns: { userId: true },
      })

      await createNotificationsForUsers(db, followers.map(follower => ({
        recipientId: follower.userId,
        actorId: user.profileId,
        type: 'chapter_update',
        title: 'New chapter published',
        body: `${body.title} is now available to read.`,
        link: `/read/${chapter.id}`,
        entityId: chapter.id,
      })))
    }

    // Purge caches so readers see the new chapter
    try {
      await purgeOnWrite({ type: 'novelById', novelId: body.novelId })
    } catch (e) {
      logger.warn('Failed to purge caches after chapter create', e)
    }

    return chapter
  })
})
