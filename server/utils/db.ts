import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@@/server/database/schema'
import { logger } from './logger'

let _db: PostgresJsDatabase<typeof schema> | null = null
let _client: postgres.Sql | null = null

export function useDB(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    const config = useRuntimeConfig()
    if (!config.databaseUrl) {
      throw createError({ statusCode: 503, statusMessage: 'DATABASE_URL is not configured' })
    }
    logger.info('[db] creating postgres client')
    _client = postgres(config.databaseUrl, {
      prepare: false,       // Required for Supabase Transaction Pooler
      max: 3,               // Stay within free-tier connection limits
      connect_timeout: 10,  // Fail faster on new connection attempts (seconds)
      idle_timeout: 20,     // Seconds before closing idle connections
    })
    logger.info('[db] postgres client created')
    _db = drizzle(_client, { schema })
  }
  return _db
}

/** Reset the singleton — call after a detected connection failure or env rotation. */
export function resetDB(): void {
  _db = null
  _client?.end({ timeout: 5 }).catch(() => {})
  _client = null
}

/**
 * Wrap a DB operation with automatic reset on terminal connection errors.
 * Use this in API handlers that need resilience without manual try/catch.
 */
export async function withDB<T>(
  fn: (db: ReturnType<typeof useDB>) => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn(useDB())
    const ms = Date.now() - start
    if (ms > 200) {
      const caller = (new Error().stack || '').split('\n')[2]?.trim() || ''
      // Warn about slow DB operation so api-timing correlates with handler
      logger.warn(`[db-timing] slow DB operation: ${ms}ms ${caller}`)
    } else {
      logger.info(`[db-timing] ${ms}ms`)
    }
    return result
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isConnectionError = /connection|ECONNREFUSED|ETIMEDOUT|terminating/i.test(msg)
    if (isConnectionError) {
      resetDB()
      throw createError({ statusCode: 503, statusMessage: 'Database temporarily unavailable' })
    }
    throw err
  }
}
