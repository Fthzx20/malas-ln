import { reports } from '@@/server/database/schema'
import { eq, sql } from 'drizzle-orm'
import { withDB } from '@@/server/utils/db'
import { getAdminCache, setAdminCache } from '@@/server/utils/admin-cache'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const query = getQuery(event)

  const status = (query.status as string) || 'pending'
  const normalizedStatus = status === 'pending' || status === 'reviewed' || status === 'dismissed'
    ? status
    : 'pending'
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = 20
  const offset = (page - 1) * limit
  const cacheKey = `admin:reports:${normalizedStatus}:page:${page}`

  const cached = getAdminCache<any>(cacheKey)
  if (cached) {
    return cached
  }

  const response = await withDB(async (db) => {
    const [pendingReports, countResult] = await Promise.all([
      db.query.reports.findMany({
        where: (r, { eq }) => eq(r.status, normalizedStatus as any),
        with: {
          reporter: {
            columns: { id: true, displayName: true, username: true },
          },
        },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(eq(reports.status, normalizedStatus as any)),
    ])

    // Batch-fetch target content instead of N+1 individual lookups
    const commentIds = pendingReports
      .filter(r => r.targetType === 'comment')
      .map(r => r.targetId)
    const forumPostIds = pendingReports
      .filter(r => r.targetType === 'forum_post')
      .map(r => r.targetId)

    const [foundComments, foundPosts] = await Promise.all([
      commentIds.length > 0
        ? db.query.comments.findMany({
            where: (c, { inArray }) => inArray(c.id, commentIds),
            columns: { id: true, content: true },
          })
        : Promise.resolve([]),
      forumPostIds.length > 0
        ? db.query.forumPosts.findMany({
            where: (fp, { inArray }) => inArray(fp.id, forumPostIds),
            columns: { id: true, title: true, content: true },
          })
        : Promise.resolve([]),
    ])

    const commentMap = new Map<string, string>()
    for (const c of foundComments) {
      commentMap.set(c.id, c.content)
    }

    const forumPostMap = new Map<string, string>()
    for (const fp of foundPosts) {
      forumPostMap.set(fp.id, `Post: "${fp.title}"\n${fp.content}`)
    }

    const reportsWithDetails = pendingReports.map(report => {
      let targetContent = 'Flagged content'
      if (report.targetType === 'comment') {
        targetContent = commentMap.get(report.targetId) || 'Comment has been deleted'
      } else if (report.targetType === 'forum_post') {
        targetContent = forumPostMap.get(report.targetId) || 'Forum post has been deleted'
      }
      return { ...report, targetContent }
    })

    return {
      data: reportsWithDetails,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
      },
    }
  })

  setAdminCache(cacheKey, response, 10000)

  return response
})
