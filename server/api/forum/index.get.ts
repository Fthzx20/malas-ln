import { forumPosts, forumCategories } from '@@/server/database/schema'
import { sql } from 'drizzle-orm'

export default defineCachedEventHandler(async () => {
  const db = useDB()

  // Get all categories with post counts in a SINGLE aggregation query
  const categories = await db.query.forumCategories.findMany({
    orderBy: (c, { asc }) => [asc(c.sortOrder)],
  })

  // Batch-fetch all category post counts in one query instead of N+1
  const postCounts = await db
    .select({
      categoryId: forumPosts.categoryId,
      count: sql<number>`count(*)`,
    })
    .from(forumPosts)
    .groupBy(forumPosts.categoryId)

  const countMap = new Map(postCounts.map(pc => [pc.categoryId, Number(pc.count)]))

  const categoriesWithCounts = categories.map(cat => ({
    ...cat,
    postCount: countMap.get(cat.id) || 0,
  }))

  return { categories: categoriesWithCounts }
}, {
  maxAge: 300,
  staleMaxAge: 60,
  swr: true,
})
