import { ratings, novels } from '@@/server/database/schema'
import { eq, sql } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { throwApiError } from '@@/server/utils/errors'
import { purgeNovelSlugCache } from '@@/server/utils/cache'
import { purgeOnWrite } from '@@/server/utils/purge'

export default defineEventHandler(async (event) => {
  const user = await checkBanned(event)
  const body = await readBody(event)

  if (!body.novelId || !body.overall) {
    throwApiError(400, 'novelId and overall rating are required')
  }

  // Validate UUID
  validateUUID(body.novelId, 'novelId')

  // Validate rating ranges
  const overall = Number(body.overall)
  if (!Number.isInteger(overall) || overall < 1 || overall > 5) {
    throwApiError(400, 'Rating must be an integer between 1 and 5')
  }

  const validateSubRating = (val: any, name: string) => {
    if (val !== undefined && val !== null) {
      const n = Number(val)
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throwApiError(400, `${name} rating must be between 1 and 5`)
      }
      return n
    }
    return null
  }

  const story = validateSubRating(body.story, 'Story')
  const translation = validateSubRating(body.translation, 'Translation')
  const characters = validateSubRating(body.characters, 'Characters')

  // Validate review text length
  if (body.reviewText && String(body.reviewText).length > 5000) {
    throwApiError(400, 'Review text must be 5,000 characters or fewer')
  }

  if (!user.profileId) {
    throwApiError(400, 'User profile not found')
  }

  // Use withDB to ensure DB resilience and return 503 on connection issues
  const result = await withDB(async (db) => {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.ratings.findFirst({
        where: (r, { eq, and }) => and(
          eq(r.userId, user.profileId!),
          eq(r.novelId, body.novelId),
        ),
      })

      let ratingResult
      if (existing) {
        [ratingResult] = await tx
          .update(ratings)
          .set({
            overall,
            story,
            translation,
            characters,
            reviewText: body.reviewText ? String(body.reviewText).trim().slice(0, 5000) : null,
            updatedAt: new Date(),
          })
          .where(eq(ratings.id, existing.id))
          .returning()
      } else {
        [ratingResult] = await tx
          .insert(ratings)
          .values({
            userId: user.profileId!,
            novelId: body.novelId,
            overall,
            story,
            translation,
            characters,
            reviewText: body.reviewText ? String(body.reviewText).trim().slice(0, 5000) : null,
          })
          .returning()
      }

      // Recalculate novel average rating atomically within the same transaction
      const avgResult = await tx
        .select({
          avg: sql<number>`round(avg(${ratings.overall})::numeric, 2)`,
          count: sql<number>`count(*)`,
        })
        .from(ratings)
        .where(eq(ratings.novelId, body.novelId))

      await tx
        .update(novels)
        .set({
          avgRating: Number(avgResult[0]?.avg || 0),
          ratingCount: Number(avgResult[0]?.count || 0),
        })
        .where(eq(novels.id, body.novelId))
      return ratingResult
    })
  })

  // Purge novel cache so novel page shows updated rating
  try {
    await purgeOnWrite({ type: 'novelById', novelId: body.novelId })
  } catch (e) {
    console.warn('Failed to purge novel cache after rating', e)
  }

  return result
})
