import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export type UserRole = 'user' | 'translator' | 'admin'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  profileId?: string
}

const AUTH_LOOKUP_TIMEOUT_MS = 2500

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

/**
 * Get the authenticated user from the request.
 * Returns null if not authenticated.
 */
export async function getAuthUser(event: H3Event): Promise<AuthUser | null> {
  try {
    // Prefer serverSupabaseUser (cookie/session) which avoids a network call
    const sessionUser = await serverSupabaseUser(event)
    if (sessionUser) {
      const db = useDB()
      const profile = await db.query.profiles.findFirst({
        where: (profiles, { eq }) => eq(profiles.authId, sessionUser.id),
        columns: { id: true, role: true },
      })

      return {
        id: sessionUser.id,
        email: sessionUser.email || '',
        role: (profile?.role as UserRole) || 'user',
        profileId: profile?.id,
      }
    }

    // Fallback: check Authorization header Bearer token (less common but supported)
    const authorization = getHeader(event, 'authorization') || getHeader(event, 'Authorization')
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim()
      if (token) {
        const supabase = await serverSupabaseClient(event)
        const { data, error } = await supabase.auth.getUser(token)
        const user = data?.user
        if (!error && user) {
          const db = useDB()
          const profile = await db.query.profiles.findFirst({
            where: (profiles, { eq }) => eq(profiles.authId, user.id),
            columns: { id: true, role: true },
          })

          return {
            id: user.id,
            email: user.email || '',
            role: (profile?.role as UserRole) || 'user',
            profileId: profile?.id,
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Require authentication. Throws 401 if not authenticated.
 */
export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const user = await withTimeout(getAuthUser(event), AUTH_LOOKUP_TIMEOUT_MS, null)
  if (!user) {
    // Log helpful context for debugging auth churn (dev only) at info level
    try {
      const url = event.node?.req?.url || '<unknown>'
      const method = event.node?.req?.method || 'GET'
      const ua = event.node?.req?.headers?.['user-agent'] || ''
      const caller = (new Error().stack || '').split('\n')[2]?.trim() || ''
      console.info(`[auth] Authentication required - ${method} ${url} - UA: ${ua} - caller: ${caller}`)
    } catch {}
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
      data: { statusCode: 401 },
    })
  }
  return user
}

/**
 * Require a specific role. Throws 403 if role doesn't match.
 */
export async function requireRole(event: H3Event, ...roles: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth(event)
  if (!roles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden. Required role: ${roles.join(' or ')}`,
      data: { statusCode: 403 },
    })
  }
  return user
}

/**
 * Check if the authenticated user is banned. Throws 403 if banned.
 * Call this after requireAuth() in write endpoints to prevent banned users
 * from creating content (comments, posts, reports, ratings, etc.).
 */
export async function checkBanned(event: H3Event): Promise<AuthUser> {
  const user = await requireAuth(event)
  if (!user.profileId) return user

  const db = useDB()
  const profile = await db.query.profiles.findFirst({
    where: (p, { eq }) => eq(p.id, user.profileId!),
    columns: { isBanned: true, banReason: true },
  })

  if (profile?.isBanned) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Your account has been suspended',
      data: {
        statusCode: 403,
        reason: profile.banReason || 'Violated community guidelines',
      },
    })
  }
  return user
}

/**
 * Escape SQL LIKE/ILIKE wildcard metacharacters in user input.
 * Prevents users from injecting `%` or `_` to craft pathological search patterns.
 */
export function sanitizeSqlLike(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}
