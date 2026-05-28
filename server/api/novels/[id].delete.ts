import { novels } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { purgeNovelsCache } from '@@/server/utils/cache'
import { purgeOnWrite } from '@@/server/utils/purge'
import { throwApiError } from '@@/server/utils/errors'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'

export default defineEventHandler(async (event) => {
  // Purging a whole serial catalog item is highly destructive, require admin role
  await requireRole(event, 'admin')
  
  const id = getRouterParam(event, 'id')

  if (!id) {
    throwApiError(400, 'Novel ID is required')
  }

  validateUUID(id, 'id')

  return await withDB(async (db) => {
    // Make sure novel exists
    const existing = await db.query.novels.findFirst({
      where: (n, { eq }) => eq(n.id, id),
    })

    if (!existing) {
      throwApiError(404, 'Novel not found')
    }

    await db
      .delete(novels)
      .where(eq(novels.id, id))

    // Invalidate caches
    try {
      await purgeOnWrite({ type: 'novel' })
    } catch (err) {
      console.warn('purgeNovelsCache failed', err)
    }

    return {
      success: true,
      message: 'Novel serial successfully deleted from archives',
    }
  })
})
