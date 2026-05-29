import { siteSettings } from '@@/server/database/schema'
import { inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = useDB()
  
  // Only fetch safe, public categories
  const allowedCategories = ['general', 'homepage', 'pages']
  const settings = await db.select().from(siteSettings).where(inArray(siteSettings.category, allowedCategories))
  
  const groupedSettings: Record<string, Record<string, any>> = {
    general: {},
    homepage: {},
    pages: {}
  }
  
  for (const row of settings) {
    if (!groupedSettings[row.category]) {
      groupedSettings[row.category] = {}
    }
    const categoryGroup = groupedSettings[row.category]
    if (categoryGroup) {
      try {
        categoryGroup[row.key] = JSON.parse(row.value)
      } catch {
        categoryGroup[row.key] = row.value
      }
    }
  }

  return { settings: groupedSettings }
})
