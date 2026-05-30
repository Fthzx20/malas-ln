import { siteNotice } from '@@/server/database/schema'
import { withDB } from '@@/server/utils/db'
import { ensureSiteNoticeTable } from '@@/server/utils/site-notice'
import { throwApiError } from '@@/server/utils/errors'
import { getAdminCache, setAdminCache } from '@@/server/utils/admin-cache'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const cacheKey = 'admin:notices:homepage-popup:v1'

  const cached = getAdminCache<{ notice: any }>(cacheKey)
  if (cached) {
    return cached
  }

  const response = await withDB(async (db) => {
    await ensureSiteNoticeTable(db)

    const existing = await db.query.siteNotice.findFirst({
      where: (n, { eq }) => eq(n.id, 'homepage-popup'),
    })

    if (existing) {
      return { notice: existing }
    }

    const [created] = await db
      .insert(siteNotice)
      .values({
        id: 'homepage-popup',
        message: '',
        isActive: false,
        updatedAt: new Date(),
      })
      .returning()

    return { notice: created }
  })

  setAdminCache(cacheKey, response, 15000)
  return response
})
