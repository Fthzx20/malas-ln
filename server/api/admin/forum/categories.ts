import { forumCategories } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'
import { eq } from 'drizzle-orm'

export default defineCachedEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'admin') {
    throwApiError(403, 'Unauthorized. Admin access required.')
  }

  const db = useDB()
  const method = event.method

  if (method === 'GET') {
    const categories = await db.query.forumCategories.findMany({
      orderBy: (c, { asc }) => [asc(c.sortOrder)],
    })
    return { categories }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    if (!body.name || !body.slug) throwApiError(400, 'Name and slug are required')
    
    const [inserted] = await db.insert(forumCategories).values({
      name: body.name,
      slug: body.slug,
      description: body.description || '',
      sortOrder: body.sortOrder || 0
    }).returning()
    
    return { category: inserted }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    if (!body.id) throwApiError(400, 'Category ID is required')
    
    const [updated] = await db.update(forumCategories).set({
      name: body.name,
      slug: body.slug,
      description: body.description,
      sortOrder: body.sortOrder
    }).where(eq(forumCategories.id, body.id)).returning()
    
    return { category: updated }
  }

  if (method === 'DELETE') {
    const body = await readBody(event)
    if (!body.id) throwApiError(400, 'Category ID is required')
    
    await db.delete(forumCategories).where(eq(forumCategories.id, body.id))
    return { success: true }
  }

  throwApiError(405, 'Method not allowed')
}, {
  maxAge: 120,
  staleMaxAge: 60,
  swr: true,
})
