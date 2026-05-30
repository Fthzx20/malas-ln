import { reports } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { throwApiError } from '@@/server/utils/errors'
import { invalidateAdminCachePrefix } from '@@/server/utils/admin-cache'

const ALLOWED_STATUSES = ['reviewed', 'dismissed'] as const

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'admin')
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throwApiError(400, 'Report ID is required')
  }

  // Validate status is an allowed enum value
  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    throwApiError(400, `Status must be one of: ${ALLOWED_STATUSES.join(', ')}`)
  }

  validateUUID(id, 'id')

  return await withDB(async (db) => {
    // Verify the report exists
    const existing = await db.query.reports.findFirst({
      where: (r, { eq }) => eq(r.id, id),
      columns: { id: true },
    })

    if (!existing) {
      throwApiError(404, 'Report not found')
    }

    const [updated] = await db
      .update(reports)
      .set({
        status: body.status,
        reviewedBy: user.profileId,
      })
      .where(eq(reports.id, id))
      .returning()

    invalidateAdminCachePrefix('admin:reports:')
    return updated
  })
})
