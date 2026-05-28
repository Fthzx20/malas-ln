import { novels } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { purgeNovelsCache } from '@@/server/utils/cache'
import { purgeOnWrite } from '@@/server/utils/purge'
import { throwApiError } from '@@/server/utils/errors'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { logger } from '@@/server/utils/logger'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'translator', 'admin')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throwApiError(400, 'Novel ID is required')
  }

  const body = await readBody(event)

  if (!body.title || !body.synopsis || !body.author) {
    throwApiError(400, 'Title, synopsis, and author are required')
  }

  // Generate slug from title if it changed, otherwise preserve it or allow custom slug
  const slug = body.slug || body.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()

  validateUUID(id, 'id')

  return await withDB(async (db) => {
    // Make sure novel exists
    const existing = await db.query.novels.findFirst({
      where: (n, { eq }) => eq(n.id, id),
    })

    if (!existing) {
      throwApiError(404, 'Novel not found')
    }

    // Compile update values
    const updateValues: any = {
    slug,
    title: body.title,
    originalTitle: body.originalTitle || null,
    synopsis: body.synopsis,
    coverUrl: body.coverUrl || null,
    author: body.author,
    illustrator: body.illustrator || null,
    publisher: body.publisher || null,
    year: body.year ? Number(body.year) : null,
    status: body.status || 'ongoing',
    genreTags: body.genreTags || [],
    taxonomyTags: body.taxonomyTags || [],
    updatedAt: new Date(),
  }

  // Only admins can change isFeatured
  if (user.role === 'admin') {
    updateValues.isFeatured = typeof body.isFeatured === 'boolean' ? body.isFeatured : existing.isFeatured
  }

    const [updatedNovel] = await db
      .update(novels)
      .set(updateValues)
      .where(eq(novels.id, id))
      .returning()

    // Invalidate caches
    try {
      await purgeOnWrite({ type: 'novel' })
    } catch (err) {
      logger.warn('purgeNovelsCache failed', err)
    }

    return updatedNovel
  })
})
