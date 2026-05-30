import { siteSettings } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'
import { eq, and, inArray } from 'drizzle-orm'
import { withDB } from '@@/server/utils/db'
import { invalidateAdminCachePrefix } from '@@/server/utils/admin-cache'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throwApiError(400, 'Invalid request body')
  }

  // body is expected to be a flat object or grouped by category.
  // We expect body.updates = [ { category, key, value } ]
  const updates = body.updates
  if (!Array.isArray(updates)) {
    throwApiError(400, 'Updates must be an array of { category, key, value } objects')
  }

  const normalizedUpdates = updates
    .filter((update: any) => update?.category && update?.key)
    .map((update: any) => ({
      category: String(update.category),
      key: String(update.key),
      value: typeof update.value === 'object' ? JSON.stringify(update.value) : String(update.value),
    }))

  if (!normalizedUpdates.length) {
    throwApiError(400, 'No valid updates provided')
  }

  await withDB(async (db) => {
    const categories = Array.from(new Set(normalizedUpdates.map(u => u.category)))
    const keys = Array.from(new Set(normalizedUpdates.map(u => u.key)))

    const existingRows = await db
      .select({
        id: siteSettings.id,
        category: siteSettings.category,
        key: siteSettings.key,
      })
      .from(siteSettings)
      .where(and(
        inArray(siteSettings.category, categories),
        inArray(siteSettings.key, keys),
      ))

    const existingMap = new Map(existingRows.map((row) => [`${row.category}:${row.key}`, row.id]))

    await Promise.all(normalizedUpdates.map(async (update) => {
      const mapKey = `${update.category}:${update.key}`
      const existingId = existingMap.get(mapKey)

      if (existingId) {
        await db
          .update(siteSettings)
          .set({ value: update.value, updatedAt: new Date() })
          .where(eq(siteSettings.id, existingId))
        return
      }

      await db.insert(siteSettings).values({
        category: update.category,
        key: update.key,
        value: update.value,
      })
    }))
  })

  invalidateAdminCachePrefix('admin:settings:')
  invalidateAdminCachePrefix('admin:settings')

  return { success: true }
})
