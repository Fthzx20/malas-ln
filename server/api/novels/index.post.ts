import { novels } from '@@/server/database/schema'
import { purgeNovelsCache } from '@@/server/utils/cache'
import { purgeOnWrite } from '@@/server/utils/purge'
import { withDB } from '@@/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'translator', 'admin')
  const body = await readBody(event)

  if (!body.title || !body.synopsis || !body.author) {
    throwApiError(400, 'title, synopsis, and author are required')
  }

  // Generate slug from title
  const slug = body.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()

  // Use withDB for resilience
  return await withDB(async (db) => {
    const [novel] = await db
      .insert(novels)
      .values({
      slug,
      title: body.title,
      originalTitle: body.originalTitle || null,
      synopsis: body.synopsis,
      coverUrl: body.coverUrl || null,
      author: body.author,
      illustrator: body.illustrator || null,
      publisher: body.publisher || null,
      year: body.year || null,
      status: body.status || 'ongoing',
      genreTags: body.genreTags || [],
      taxonomyTags: body.taxonomyTags || [],
    })
    .returning()

    // Invalidate novels list and featured caches so clients see new entries
    try {
      await purgeOnWrite({ type: 'novel' })
    } catch (err) {
      // Log but don't fail the request on cache purge errors
      console.warn('purgeNovelsCache failed', err)
    }

    return novel
  })

  })


