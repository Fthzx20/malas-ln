import { siteNotice } from '@@/server/database/schema'
import { withDB } from '@@/server/utils/db'
import { ensureSiteNoticeTable } from '@@/server/utils/site-notice'

export default defineEventHandler(async () => {
  return await withDB(async (db) => {
    await ensureSiteNoticeTable(db)

    const notice = await db.query.siteNotice.findFirst({
      where: (n, { eq, and }) => and(eq(n.id, 'homepage-popup'), eq(n.isActive, true)),
      columns: {
        id: true,
        message: true,
        isActive: true,
        updatedAt: true,
      },
    })

    if (!notice || !notice.message.trim()) {
      return { notice: null }
    }

    return { notice }
  })
})
