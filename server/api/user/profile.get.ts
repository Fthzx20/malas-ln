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

function decodeSupabaseJwt(token: string): { id: string; email: string; metadata: Record<string, unknown> } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as {
      sub?: unknown
      aud?: unknown
      email?: unknown
      user_metadata?: unknown
      exp?: unknown
    }

    if (payload.aud !== 'authenticated') return null
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    if (typeof payload.email !== 'string' || !payload.email) return null
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null

    return {
      id: payload.sub,
      email: payload.email,
      metadata: payload.user_metadata && typeof payload.user_metadata === 'object' && !Array.isArray(payload.user_metadata)
        ? payload.user_metadata as Record<string, unknown>
        : {},
    }
  } catch {
    return null
  }
}

async function resolveProfileRequestUser(event: Parameters<typeof defineEventHandler>[0]) {
  const rawAuthorization =
    event.node?.req?.headers?.authorization ||
    event.node?.req?.headers?.Authorization ||
    null

  if (typeof rawAuthorization === 'string' && rawAuthorization.startsWith('Bearer ')) {
    const decoded = decodeSupabaseJwt(rawAuthorization.slice('Bearer '.length).trim())
    if (decoded) {
      return decoded
    }
  }

  return null
}

export default defineEventHandler(async (event) => {
  const user = await resolveProfileRequestUser(event)
  if (!user) {
    return { authenticated: false, user: null }
  }
  const db = useDB()

  const profile = await db.query.profiles.findFirst({
    where: (p, { eq }) => eq(p.authId, user.id),
  })

  if (!profile) {
    const metadata = (user.metadata ?? {}) as Record<string, unknown>
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
