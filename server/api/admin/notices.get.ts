import { siteNotice } from '@@/server/database/schema'
import { withDB } from '@@/server/utils/db'
import { ensureSiteNoticeTable } from '@@/server/utils/site-notice'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

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
