import { profiles } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { throwApiError } from '@@/server/utils/errors'

function normalizeUsername(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'reader'
}

function getEmailPrefix(email: string) {
  const localPart = email.split('@')[0] || 'reader'
  return normalizeUsername(localPart)
}

export default defineEventHandler(async (event) => {
  let user
  try {
    user = await requireAuth(event)
  } catch (_err) {
    throwApiError(401, 'Authentication required')
  }
  const db = useDB()

  const profile = await db.query.profiles.findFirst({
    where: (p, { eq }) => eq(p.authId, user.id),
  })

  if (!profile) {
    let metadata: any = {}
    try {
      if (typeof serverSupabaseUser !== 'undefined') {
        metadata = (await serverSupabaseUser(event))?.user_metadata || {}
      }
    } catch (e) {
      metadata = {}
    }
    const preferredUsername = typeof metadata.username === 'string' ? metadata.username : ''
    const preferredDisplayName = typeof metadata.displayName === 'string'
      ? metadata.displayName
      : typeof metadata.full_name === 'string'
        ? metadata.full_name
        : ''

    const baseUsername = normalizeUsername(preferredUsername || getEmailPrefix(user.email))
    const displayName = preferredDisplayName.trim() || preferredUsername.trim() || user.email.split('@')[0] || 'Reader'

    let username = baseUsername
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await db.query.profiles.findFirst({
        where: (p, { eq }) => eq(p.username, username),
        columns: { id: true },
      })

      if (!existing) {
        break
      }

      username = normalizeUsername(`${baseUsername}_${Math.random().toString(36).slice(2, 6)}`)
    }

    try {
      const [createdProfile] = await db.insert(profiles).values({
        authId: user.id,
        username,
        displayName,
        avatarUrl: typeof metadata.avatarUrl === 'string' ? metadata.avatarUrl : null,
        bio: null,
      }).returning()

      if (createdProfile) {
        return createdProfile
      }
    } catch {
      const fallbackProfile = await db.query.profiles.findFirst({
        where: (p, { eq }) => eq(p.authId, user.id),
      })

      if (fallbackProfile) {
        return fallbackProfile
      }

      throwApiError(409, 'Profile could not be created')
    }
  }

  return profile
})
