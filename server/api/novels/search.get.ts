import { novels } from '@@/server/database/schema'
import { ilike, or, sql, desc } from 'drizzle-orm'
import { sanitizeSqlLike } from '@@/server/utils/auth'
import { sanitizeSearchInput } from '@@/server/utils/validate'

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const q = (query.q as string || '').trim()

  if (!q || q.length < 2) {
    return { results: [] }
  }

  const safeQ = sanitizeSqlLike(sanitizeSearchInput(q))

  const db = useDB()

  const results = await db
    .select({
      id: novels.id,
      slug: novels.slug,
      title: novels.title,
      author: novels.author,
      coverUrl: novels.coverUrl,
      status: novels.status,
      avgRating: novels.avgRating,
      genreTags: novels.genreTags,
    })
    .from(novels)
    .where(
      or(
        ilike(novels.title, `%${safeQ}%`),
        ilike(novels.author, `%${safeQ}%`),
        ilike(novels.illustrator, `%${safeQ}%`),
        ilike(novels.originalTitle, `%${safeQ}%`),
      ),
    )
    .orderBy(desc(novels.avgRating))
    .limit(20)

  return { results }
}, {
  maxAge: 60, // Cache for 1 minute
  swr: true,
})
