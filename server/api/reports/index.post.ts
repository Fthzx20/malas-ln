import { reports } from '@@/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  const user = await checkBanned(event)

  if (!user.profileId) {
    throwApiError(400, 'Missing profileId on authenticated user')
  }
  const body = await readBody(event)

  if (!body.targetType || !body.targetId || !body.reason) {
    throwApiError(400, 'targetType, targetId, and reason are required')
  }

  // Validate UUID format
  validateUUID(body.targetId, 'targetId')

  // Enforce description length limit
    if (body.description && String(body.description).length > 2000) {
    throwApiError(400, 'Description must be 2,000 characters or fewer')
  }

  // Use withDB for resilience
  return await withDB(async (db) => {
    // Prevent duplicate reports from the same user for the same target
    const existingReport = await db.query.reports.findFirst({
      where: (r, { eq, and }) => and(
        eq(r.reporterId, user.profileId!),
        eq(r.targetId, body.targetId),
        eq(r.status, 'pending'),
      ),
      columns: { id: true },
    })

    if (existingReport) {
      throwApiError(409, 'You have already reported this content')
    }

    const [report] = await db
      .insert(reports)
      .values({
        reporterId: user.profileId,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        description: body.description ? String(body.description).trim().slice(0, 2000) : null,
      })
      .returning()

    if (!report) {
      throwApiError(500, 'Failed to submit report')
    }

    return { success: true, reportId: report.id }
  })
})
