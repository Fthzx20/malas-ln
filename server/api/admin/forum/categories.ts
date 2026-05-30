import { forumCategories } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'
import { eq } from 'drizzle-orm'
import { withDB } from '@@/server/utils/db'
import { getAdminCache, setAdminCache, invalidateAdminCachePrefix } from '@@/server/utils/admin-cache'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const method = event.method

  if (method === 'GET') {
    const cacheKey = 'admin:forum:categories:v1'
    const cached = getAdminCache<{ categories: any[] }>(cacheKey)
    if (cached) {
      return cached
    }

    const response = await withDB(async (db) => {
      const categories = await db.query.forumCategories.findMany({
        orderBy: (c, { asc }) => [asc(c.sortOrder)],
      })
      return { categories }
    })

    setAdminCache(cacheKey, response, 15000)
    return response
  }

  if (method === 'POST') {
    const body = await readBody(event)
    if (!body.name || !body.slug) throwApiError(400, 'Name and slug are required')
    const inserted = await withDB(async (db) => {
      const [row] = await db.insert(forumCategories).values({
        name: body.name,
        slug: body.slug,
        description: body.description || '',
        sortOrder: body.sortOrder || 0
      }).returning()
      return row
    })
    invalidateAdminCachePrefix('admin:forum:categories')
    
    return { category: inserted }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    if (!body.id) throwApiError(400, 'Category ID is required')
    const updated = await withDB(async (db) => {
      const [row] = await db.update(forumCategories).set({
        name: body.name,
        slug: body.slug,
        description: body.description,
        sortOrder: body.sortOrder
      }).where(eq(forumCategories.id, body.id)).returning()
      return row
    })
    invalidateAdminCachePrefix('admin:forum:categories')
    
    return { category: updated }
  }

  if (method === 'DELETE') {
    const body = await readBody(event)
    if (!body.id) throwApiError(400, 'Category ID is required')

    await withDB(async (db) => {
      await db.delete(forumCategories).where(eq(forumCategories.id, body.id))
      return true
    })
    invalidateAdminCachePrefix('admin:forum:categories')
    return { success: true }
  }

  throwApiError(405, 'Method not allowed')
})
