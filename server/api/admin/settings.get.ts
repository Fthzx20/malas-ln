import { siteSettings } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const db = useDB()
  
  // Fetch all settings
  const settings = await db.select().from(siteSettings)
  
  // Group settings by category
  const groupedSettings: Record<string, Record<string, any>> = {
    general: {},
    content: {},
    media: {},
    user: {},
    auth: {},
    system: {},
    notification: {}
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
