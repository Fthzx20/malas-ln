import { profiles } from '@@/server/database/schema'
import { like, or, eq, sql, and } from 'drizzle-orm'
import { sanitizeSqlLike } from '@@/server/utils/auth'
import { sanitizeSearchInput } from '@@/server/utils/validate'

export default defineEventHandler(async (event) => {
  // Safe staff only registry lookup
  await requireRole(event, 'admin')
  
  const query = getQuery(event)
  const search = sanitizeSearchInput((query.search as string) || '')
  const role = query.role as string || ''
  const limit = Math.min(100, parseInt(query.limit as string) || 50)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const offset = (page - 1) * limit

  const db = useDB()

  // Build filter conditions
  const conditions = []
  
  if (search) {
    const safeSearch = sanitizeSqlLike(search)
    conditions.push(
      or(
        like(sql`lower(${profiles.displayName})`, `%${safeSearch}%`),
        like(sql`lower(${profiles.username})`, `%${safeSearch}%`)
      )
    )
  }

  if (role) {
    conditions.push(eq(profiles.role, role as any))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Fetch profiles
  const items = await db.query.profiles.findMany({
    where: whereClause,
    limit,
    offset,
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(profiles)
    .where(whereClause)

  const total = Number(countResult?.[0]?.count || 0)

  return {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  }
})
