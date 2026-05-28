import { sql } from 'drizzle-orm'
import { useDB } from '../utils/db'
import { pruneNotifications } from '../utils/notifications'

export default defineNitroPlugin((nitroApp) => {
  const runCleanup = async () => {
    try {
      const db = useDB()
      await db.execute(sql`SELECT 1`)
      await pruneNotifications(db)
    } catch (error) {
      console.warn('[notification-cleanup] Cleanup skipped:', error)
    }
  }

  void runCleanup()
  const interval = setInterval(() => {
    void runCleanup()
  }, 6 * 60 * 60 * 1000)

  nitroApp.hooks.hook('close', () => {
    clearInterval(interval)
  })
})
