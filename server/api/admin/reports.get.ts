import { reports, profiles, comments, forumPosts } from '@@/server/database/schema'
import { eq, desc, sql, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const db = useDB()
  const query = getQuery(event)

  const status = (query.status as string) || 'pending'
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = 20
  const offset = (page - 1) * limit

  const pendingReports = await db.query.reports.findMany({
    where: (r, { eq }) => eq(r.status, status as any),
    with: {
      reporter: {
        columns: { id: true, displayName: true, username: true },
      },
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
    limit,
    offset,
  })

  // Batch-fetch target content instead of N+1 individual lookups
  const commentIds = pendingReports
    .filter(r => r.targetType === 'comment')
    .map(r => r.targetId)
  const forumPostIds = pendingReports
    .filter(r => r.targetType === 'forum_post')
    .map(r => r.targetId)

  // Fetch all referenced comments in one query
  const commentMap = new Map<string, string>()
  if (commentIds.length > 0) {
    const foundComments = await db.query.comments.findMany({
      where: (c, { inArray }) => inArray(c.id, commentIds),
      columns: { id: true, content: true },
    })
    for (const c of foundComments) {
      commentMap.set(c.id, c.content)
    }
  }

  // Fetch all referenced forum posts in one query
  const forumPostMap = new Map<string, string>()
  if (forumPostIds.length > 0) {
    const foundPosts = await db.query.forumPosts.findMany({
      where: (fp, { inArray }) => inArray(fp.id, forumPostIds),
      columns: { id: true, title: true, content: true },
    })
    for (const fp of foundPosts) {
      forumPostMap.set(fp.id, `Post: "${fp.title}"\n${fp.content}`)
    }
  }

  // Assemble reports with target content
  const reportsWithDetails = pendingReports.map(report => {
    let targetContent = 'Flagged content'
    if (report.targetType === 'comment') {
      targetContent = commentMap.get(report.targetId) || 'Comment has been deleted'
    } else if (report.targetType === 'forum_post') {
      targetContent = forumPostMap.get(report.targetId) || 'Forum post has been deleted'
    }
    return { ...report, targetContent }
  })

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reports)
    .where(eq(reports.status, status as any))

  return {
    data: reportsWithDetails,
    pagination: {
      page,
      limit,
      total: Number(countResult?.count || 0),
    },
  }
})
