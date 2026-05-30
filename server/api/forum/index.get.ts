import { forumPosts, forumCategories } from '@@/server/database/schema'
import { sql } from 'drizzle-orm'

export default defineCachedEventHandler(async () => {
  const db = useDB()

  const [categories, postCounts] = await Promise.all([
    db.query.forumCategories.findMany({
      orderBy: (c, { asc }) => [asc(c.sortOrder)],
    }),
    db
      .select({
        categoryId: forumPosts.categoryId,
        count: sql<number>`count(*)`,
      })
      .from(forumPosts)
      .groupBy(forumPosts.categoryId),
  ])

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
