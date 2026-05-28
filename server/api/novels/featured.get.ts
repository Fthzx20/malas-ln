import { novels } from '@@/server/database/schema'
import { eq, desc } from 'drizzle-orm'

export default defineCachedEventHandler(async () => {
  const db = useDB()

  const featured = await db
    .select({
      id: novels.id,
      slug: novels.slug,
      title: novels.title,
      synopsis: novels.synopsis,
      coverUrl: novels.coverUrl,
      author: novels.author,
      illustrator: novels.illustrator,
      status: novels.status,
      genreTags: novels.genreTags,
      avgRating: novels.avgRating,
      ratingCount: novels.ratingCount,
      totalChapters: novels.totalChapters,
      year: novels.year,
    })
    .from(novels)
    .where(eq(novels.isFeatured, true))
    .orderBy(desc(novels.updatedAt))
    .limit(6)

  return featured
}, {
  maxAge: 60 * 60, // Cache for 1 hour
  swr: true,
})
