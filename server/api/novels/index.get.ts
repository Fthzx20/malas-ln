import { novels } from '@@/server/database/schema'
import { eq, desc, sql, and, ilike, inArray, asc } from 'drizzle-orm'
import { sanitizeSqlLike } from '@@/server/utils/auth'
import { sanitizeSearchInput } from '@@/server/utils/validate'
import { throwApiError } from '@@/server/utils/errors'

export default defineCachedEventHandler(async (event) => {
  const db = useDB()
  const query = getQuery(event)

  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 20))
  const offset = (page - 1) * limit

  // Build filters
  const conditions = []

  if (query.status) {
    conditions.push(eq(novels.status, query.status as any))
  }

  if (query.genre) {
    const genres = (query.genre as string).split(',')
    conditions.push(sql`${novels.genreTags} && ARRAY[${sql.join(genres.map(g => sql`${g}`), sql`, `)}]::text[]`)
  }

  if (query.search) {
    const safeSearch = sanitizeSqlLike(sanitizeSearchInput(query.search as string))
    conditions.push(ilike(novels.title, `%${safeSearch}%`))
  }

  if (query.author) {
    const safeAuthor = sanitizeSqlLike(sanitizeSearchInput(query.author as string))
    conditions.push(ilike(novels.author, `%${safeAuthor}%`))
  }

  if (query.year) {
    const year = parseInt(query.year as string)
    if (!Number.isNaN(year) && year >= 1900 && year <= 2100) {
      conditions.push(eq(novels.year, year))
    }
  }

  // Sort
  const sortMap: Record<string, any> = {
    latest: desc(novels.createdAt),
    rating: desc(novels.avgRating),
    title: asc(novels.title),
    popular: desc(novels.ratingCount),
  }
  const sortBy = sortMap[query.sort as string] || desc(novels.updatedAt)

  const where = conditions.length > 0 ? and(...conditions) : undefined

  let data: any[] = []
  let countResult: any[] = []
  try {
    ;[data, countResult] = await Promise.all([
      db
        .select({
          id: novels.id,
          slug: novels.slug,
          title: novels.title,
          synopsis: novels.synopsis,
          coverUrl: novels.coverUrl,
          author: novels.author,
          illustrator: novels.illustrator,
          originalTitle: novels.originalTitle,
          status: novels.status,
          genreTags: novels.genreTags,
          totalChapters: novels.totalChapters,
          avgRating: novels.avgRating,
          ratingCount: novels.ratingCount,
          year: novels.year,
          updatedAt: novels.updatedAt,
        })
        .from(novels)
        .where(where)
        .orderBy(sortBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(novels)
        .where(where),
    ])
  } catch (err: any) {
    console.error('[novels:list] DB query failed:', err?.message || err)
    throwApiError(500, 'Internal server error')
  }

  const total = Number(countResult[0]?.count || 0)

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}, {
  maxAge: 300,       // 5 minutes
  staleMaxAge: 60,   // Serve stale immediately, revalidate in background
  swr: true,
  getKey: (event) => {
    const q = getQuery(event)
    // Stable sort of keys ensures equivalent queries share a cache entry
    const parts = ['page', 'limit', 'sort', 'genre', 'search', 'author', 'year', 'status']
      .filter(k => q[k] !== undefined && q[k] !== '')
      .map(k => `${k}=${q[k]}`)
    return `novels:list:${parts.join('|') || 'default'}`
  },
})
