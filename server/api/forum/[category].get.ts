import { forumPosts, forumCategories } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'
import { eq, desc, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const categorySlug = getRouterParam(event, 'category')
  const db = useDB()
  const query = getQuery(event)

  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = 20
  const offset = (page - 1) * limit

  // Get posts for specific category
  const category = await db.query.forumCategories.findFirst({
    where: (c, { eq }) => eq(c.slug, categorySlug as string),
  })

  if (!category) {
    throwApiError(404, 'Forum category not found')
  }

  const posts = await db.query.forumPosts.findMany({
    where: (p, { eq, and }) => and(
      eq(p.categoryId, category.id),
      eq(p.isFlagged, false),
    ),
    with: {
      user: {
        columns: { id: true, displayName: true, username: true, avatarUrl: true },
      },
    },
    orderBy: (p, { desc }) => [desc(p.isPinned), desc(p.updatedAt)],
    limit,
    offset,
  })

  return { category, posts }
})
