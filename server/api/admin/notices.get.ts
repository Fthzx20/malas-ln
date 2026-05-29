import { siteNotice } from '@@/server/database/schema'
import { withDB } from '@@/server/utils/db'
import { ensureSiteNoticeTable } from '@@/server/utils/site-notice'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'admin') {
    throwApiError(403, 'Unauthorized. Admin access required.')
  }

  return await withDB(async (db) => {
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
})
