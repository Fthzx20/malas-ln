import { profiles } from '@@/server/database/schema'
import { ilike, or, eq, sql, and, desc } from 'drizzle-orm'
import { sanitizeSqlLike } from '@@/server/utils/auth'
import { sanitizeSearchInput } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'

export default defineEventHandler(async (event) => {
  // Safe staff only database lookup
  await requireRole(event, 'admin')
  
  const query = getQuery(event)
  const search = sanitizeSearchInput((query.search as string) || '')
  const role = query.role as string || ''
  const limit = Math.min(100, parseInt(query.limit as string) || 50)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const offset = (page - 1) * limit
  const normalizedRole = ['user', 'translator', 'admin'].includes(role) ? role : ''

  // Build filter conditions
  const conditions = [] as any[]
  
  if (search) {
    const safeSearch = sanitizeSqlLike(search)
    conditions.push(
      or(
        ilike(profiles.displayName, `%${safeSearch}%`),
        ilike(profiles.username, `%${safeSearch}%`)
      )
    )
  }

  if (normalizedRole) {
    conditions.push(eq(profiles.role, normalizedRole as any))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  return await withDB(async (db) => {
    const [items, countResult] = await Promise.all([
      db
        .select({
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          role: profiles.role,
          isBanned: profiles.isBanned,
          banReason: profiles.banReason,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(whereClause)
        .orderBy(desc(profiles.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(profiles)
        .where(whereClause),
    ])

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
})
