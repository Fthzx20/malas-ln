import { profiles } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { deleteFromR2, getR2KeyFromPublicUrl } from '../../utils/r2'
import { withDB } from '@@/server/utils/db'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  let user
  try {
    user = await requireAuth(event)
  } catch (_err) {
    throwApiError(401, 'Authentication required')
  }
  const body = await readBody(event)

  // Use withDB for DB resilience
  return await withDB(async (db) => {
    const existingProfile = await db.query.profiles.findFirst({
      where: (p, { eq }) => eq(p.authId, user.id),
      columns: { avatarUrl: true },
    })

  // SECURITY: Whitelist allowed fields — never allow role, isBanned, authId, etc.
  const updateData: Record<string, any> = {}

  if (body.displayName !== undefined) {
    const displayName = String(body.displayName).trim()
    if (displayName.length > 50) {
      throwApiError(400, 'Display name must be 50 characters or fewer')
    }
    updateData.displayName = displayName
  }

  if (body.bio !== undefined) {
    const bio = String(body.bio).trim()
    if (bio.length > 500) {
      throwApiError(400, 'Bio must be 500 characters or fewer')
    }
    updateData.bio = bio
  }

  if (body.avatarUrl !== undefined) {
    updateData.avatarUrl = body.avatarUrl
  }

  updateData.updatedAt = new Date()

  if (Object.keys(updateData).length <= 1) {
    throwApiError(400, 'No fields to update')
  }

    const [updated] = await db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.authId, user.id))
      .returning()

  const previousAvatarUrl = existingProfile?.avatarUrl
  const nextAvatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined
    if (previousAvatarUrl && nextAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
      const previousKey = getR2KeyFromPublicUrl(previousAvatarUrl)
      if (previousKey) {
        await deleteFromR2(previousKey).catch(() => {})
      }
    }

    return updated
  })
})
