import { siteSettings } from '@@/server/database/schema'
import { withDB } from '@@/server/utils/db'
import { getAdminCache, setAdminCache } from '@@/server/utils/admin-cache'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const cacheKey = 'admin:settings:v1'
  const cached = getAdminCache<{ settings: Record<string, Record<string, any>> }>(cacheKey)
  if (cached) {
    return cached
  }

  const response = await withDB(async (db) => {
    // Fetch only required columns.
    const settings = await db
      .select({
        category: siteSettings.category,
        key: siteSettings.key,
        value: siteSettings.value,
      })
      .from(siteSettings)

    const groupedSettings: Record<string, Record<string, any>> = {
      general: {},
      homepage: {},
      pages: {},
      content: {},
      media: {},
      user: {},
      auth: {},
      system: {},
      notification: {},
    }

    for (const row of settings) {
      if (!groupedSettings[row.category]) {
        groupedSettings[row.category] = {}
      }

      try {
        groupedSettings[row.category][row.key] = JSON.parse(row.value)
      } catch {
        groupedSettings[row.category][row.key] = row.value
      }
    }

    return { settings: groupedSettings }
  })

  setAdminCache(cacheKey, response, 15000)
  return response
})
