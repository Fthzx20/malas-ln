import { siteSettings } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throwApiError(400, 'Invalid request body')
  }

  const db = useDB()
  
  // body is expected to be a flat object or grouped by category.
  // We expect body.updates = [ { category, key, value } ]
  const updates = body.updates
  if (!Array.isArray(updates)) {
    throwApiError(400, 'Updates must be an array of { category, key, value } objects')
  }
  
  // Process each update
  for (const update of updates) {
    if (!update.category || !update.key) continue
    
    const serializedValue = typeof update.value === 'object' ? JSON.stringify(update.value) : String(update.value)
    
    // Upsert logic (check if exists, then update or insert)
    const existing = await db.query.siteSettings.findFirst({
      where: (s, { eq, and }) => and(
        eq(s.category, update.category),
        eq(s.key, update.key)
      )
    })
    
    if (existing) {
      await db.update(siteSettings)
        .set({ value: serializedValue, updatedAt: new Date() })
        .where(eq(siteSettings.id, existing.id))
    } else {
      await db.insert(siteSettings).values({
        category: update.category,
        key: update.key,
        value: serializedValue
      })
    }
  }

  return { success: true }
})
