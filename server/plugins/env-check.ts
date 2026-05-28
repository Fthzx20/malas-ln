import { sql } from 'drizzle-orm'
import { useDB } from '../utils/db'
import { logger } from '../utils/logger'

let _appReady = false

export function isAppReady() {
  return _appReady
}

export default defineNitroPlugin(async (nitroApp) => {
  const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  const config = useRuntimeConfig()

  const missing = required.filter(key => {
    const val = key === 'DATABASE_URL'
      ? config.databaseUrl
      : key === 'SUPABASE_SERVICE_ROLE_KEY'
        ? config.supabaseServiceRoleKey
        : process.env[key]
    return !val || (val as string).trim() === ''
  })

  if (missing.length > 0) {
    logger.error(`[env-check] Missing required environment variables: ${missing.join(', ')}`)
    // Block all API routes until fixed
    nitroApp.hooks.hook('request', (event) => {
      if (event.path.startsWith('/api/')) {
        throw createError({
          statusCode: 503,
          statusMessage: `Server misconfigured: missing ${missing.join(', ')}`,
        })
      }
    })
    _appReady = false
    return
  }

  // SSL warning
  const dbUrl = config.databaseUrl as string
  if (dbUrl && !dbUrl.includes('sslmode=require') && !dbUrl.includes('ssl=true')) {
    logger.warn('[env-check] DATABASE_URL does not include SSL configuration. Recommended for production.')
  }

  // Connectivity check
  try {
    const db = useDB()
    await db.execute(sql`SELECT 1`)
    _appReady = true
    logger.info('[env-check] Database connectivity confirmed.')
  } catch (err) {
    const host = (() => {
      try { return new URL(config.databaseUrl as string).host } catch { return 'unknown' }
    })()
    _appReady = false
    logger.error(`[env-check] Database connectivity check failed (host: ${host}):`, err)
    // Block API routes if DB connectivity fails
    nitroApp.hooks.hook('request', (event) => {
      if (event.path.startsWith('/api/')) {
        throw createError({ statusCode: 503, statusMessage: 'Database temporarily unavailable' })
      }
    })
  }
})
