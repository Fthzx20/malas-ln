import { siteSettings } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'

export default defineCachedEventHandler(async (event) => {
  // Ensure user is admin
  const user = event.context.user
  if (!user || user.role !== 'admin') {
    throwApiError(403, 'Unauthorized. Admin access required.')
  }

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
}, {
  maxAge: 60,
  staleMaxAge: 30,
  swr: true,
})
