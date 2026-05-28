import { profiles } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  // Moderate system ban operations, restrict to administrator role
  await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throwApiError(400, 'Profile ID is required')
  }

  const body = await readBody(event)
  const isBanned = typeof body.isBanned === 'boolean' ? body.isBanned : true
  const banReason = (body.banReason as string || '').trim()

  validateUUID(id, 'id')

  return await withDB(async (db) => {
    const existing = await db.query.profiles.findFirst({
      where: (p, { eq }) => eq(p.id, id),
    })

    if (!existing) {
      throwApiError(404, 'Profile not found')
    }

    // Prevent banning oneself or other admins
    if (existing.role === 'admin' && isBanned) {
      throwApiError(400, 'System forbids banning administrator accounts')
    }

    const [updated] = await db
      .update(profiles)
      .set({
        isBanned,
        banReason: isBanned ? banReason || 'Violated community guidelines' : null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, id))
      .returning()

    return {
      success: true,
      data: updated,
      message: isBanned 
        ? 'Profile successfully restricted from community access'
        : 'Profile restriction lifted successfully'
    }
  })
})
