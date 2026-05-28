import { novels, volumes, chapters, ratings } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'
import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { withDB } from '@@/server/utils/db'

export default defineCachedEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throwApiError(400, 'Novel slug is required')
  }

  return await withDB(async (db) => {
    // Get novel first to resolve foreign-key scoped queries.
    const novel = await db.query.novels.findFirst({
      where: (n, { eq }) => eq(n.slug, slug),
    })

    if (!novel) {
      throwApiError(404, 'Novel not found')
    }

    // Run independent lookups in parallel to reduce tail latency.
    const [novelVolumes, novelChapters, ratingDistribution, avgSubRatings] = await Promise.all([
      db
        .select({
          id: volumes.id,
          volumeNumber: volumes.volumeNumber,
          title: volumes.title,
          coverUrl: volumes.coverUrl,
          synopsis: volumes.synopsis,
          createdAt: volumes.createdAt,
        })
        .from(volumes)
        .where(eq(volumes.novelId, novel.id))
        .orderBy(asc(volumes.volumeNumber)),
      db
        .select({
          id: chapters.id,
          volumeId: chapters.volumeId,
          chapterNumber: chapters.chapterNumber,
          title: chapters.title,
          wordCount: chapters.wordCount,
          translatorGroup: chapters.translatorGroup,
          isPublished: chapters.isPublished,
          createdAt: chapters.createdAt,
        })
        .from(chapters)
        .where(and(
          eq(chapters.novelId, novel.id),
          eq(chapters.isPublished, true),
        ))
        .orderBy(asc(chapters.chapterNumber)),
      db
        .select({
          rating: ratings.overall,
          count: sql<number>`count(*)`,
        })
        .from(ratings)
        .where(eq(ratings.novelId, novel.id))
        .groupBy(ratings.overall),
      db
        .select({
          avgStory: sql<number>`round(avg(${ratings.story})::numeric, 1)`,
          avgTranslation: sql<number>`round(avg(${ratings.translation})::numeric, 1)`,
          avgCharacters: sql<number>`round(avg(${ratings.characters})::numeric, 1)`,
        })
        .from(ratings)
        .where(eq(ratings.novelId, novel.id)),
    ])

    return {
      novel,
      volumes: novelVolumes,
      chapters: novelChapters,
      ratings: {
        distribution: ratingDistribution,
        subRatings: avgSubRatings[0] || null,
      },
    }
  })
}, {
  maxAge: 60 * 30, // Cache for 30 minutes
  swr: true,
})
