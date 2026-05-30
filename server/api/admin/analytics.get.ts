import { novels, profiles, readingHistory, bookmarks, chapters, comments, reports } from '@@/server/database/schema'
import { sql, desc, eq } from 'drizzle-orm'
import { getAdminCache, setAdminCache } from '@@/server/utils/admin-cache'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const cacheKey = 'admin:analytics:v1'
  const cached = getAdminCache<any>(cacheKey)
  if (cached) {
    return cached
  }

  const response = await withDB(async (db) => {
    // 1. Basic counts using optimized count queries (parallel)
    const [
      [novelCount],
      [userCount],
      [chapterCount],
      [commentCount],
      [pendingReportCount],
      [activeReaders],
      coverCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(novels),
      db.select({ count: sql<number>`count(*)` }).from(profiles),
      db.select({ count: sql<number>`count(*)` }).from(chapters),
      db.select({ count: sql<number>`count(*)` }).from(comments),
      db.select({ count: sql<number>`count(*)` }).from(reports).where(eq(reports.status, 'pending')),
      db.select({ count: sql<number>`count(distinct user_id)` }).from(readingHistory).where(sql`read_at > now() - interval '7 days'`),
      db.select({ count: sql<number>`count(*)` }).from(novels).where(sql`cover_url is not null`),
    ])

    // 2. Storage estimate: 350KB per cover and 50KB per chapter content
    const estimatedStorageBytes = (Number(coverCount?.[0]?.count || 0) * 350 * 1024) + (Number(chapterCount?.count || 0) * 50 * 1024)
    const storageMb = (estimatedStorageBytes / (1024 * 1024)).toFixed(2)

    // 3. Popular novels by bookmark count — batch fetch details in a single query
    const popularNovels = await db
      .select({
        novelId: bookmarks.novelId,
        count: sql<number>`count(*)`,
      })
      .from(bookmarks)
      .groupBy(bookmarks.novelId)
      .orderBy(desc(sql`count(*)`))
      .limit(5)

    let popularWithDetails: any[] = []
    if (popularNovels.length > 0) {
      const novelIds = popularNovels.map(p => p.novelId)
      const novelDetails = await db.query.novels.findMany({
        where: (n, { inArray }) => inArray(n.id, novelIds),
        columns: { id: true, title: true, slug: true, coverUrl: true, author: true },
      })
      const detailsMap = new Map(novelDetails.map(n => [n.id, n]))
      popularWithDetails = popularNovels.map(p => ({
        ...p,
        novel: detailsMap.get(p.novelId) || null,
      }))
    }

    // 4. Recent uploads (latest chapters created)
    const recentChapters = await db.query.chapters.findMany({
      orderBy: [desc(chapters.createdAt)],
      limit: 5,
      with: {
        novel: {
          columns: { title: true, slug: true },
        },
      },
    })

    // 5. Recent pending reports
    const recentReports = await db.query.reports.findMany({
      where: (r, { eq }) => eq(r.status, 'pending'),
      orderBy: [desc(reports.createdAt)],
      limit: 5,
      with: {
        reporter: {
          columns: { displayName: true, username: true },
        },
      },
    })

    return {
      stats: {
        totalNovels: Number(novelCount?.count || 0),
        totalUsers: Number(userCount?.count || 0),
        totalChapters: Number(chapterCount?.count || 0),
        totalComments: Number(commentCount?.count || 0),
        pendingReports: Number(pendingReportCount?.count || 0),
        activeReaders7d: Number(activeReaders?.count || 0),
        storageUsageMb: storageMb,
      },
      popularNovels: popularWithDetails,
      recentUploads: recentChapters,
      recentReports,
    }
  })

  setAdminCache(cacheKey, response, 10000)
  return response
})
