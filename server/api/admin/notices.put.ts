import { siteNotice } from '@@/server/database/schema'
import { withDB } from '@@/server/utils/db'
import { throwApiError } from '@@/server/utils/errors'
import { ensureSiteNoticeTable } from '@@/server/utils/site-notice'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readBody(event)
  const message = String(body?.message || '').trim()
  const isActive = Boolean(body?.isActive)

  if (message.length > 1000) {
    throwApiError(400, 'Notice message must be 1,000 characters or fewer')
  }

  return await withDB(async (db) => {
    await ensureSiteNoticeTable(db)

    const [saved] = await db
      .insert(siteNotice)
      .values({
        id: 'homepage-popup',
        message,
        isActive,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteNotice.id,
        set: {
          message,
          isActive,
          updatedAt: new Date(),
        },
      })
      .returning()

    return {
      success: true,
      notice: saved,
    }
  })
})
