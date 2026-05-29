import * as dotenv from 'dotenv'
dotenv.config()

import fs from 'fs/promises'
import path from 'path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../server/database/schema'
import { sql } from 'drizzle-orm'

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'dumps')

async function ensureOut() {
  try { await fs.mkdir(outDir, { recursive: true }) } catch (_) {}
}

async function connectDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in env to dump DB data')
  }
  const client = postgres(process.env.DATABASE_URL, { max: 1 })
  return drizzle(client, { schema })
}

function olderThanDays(days: number) {
  return sql`${sql.raw('now()')} - interval '${days} days'`
}

async function dumpReports(db: any, days: number) {
  const rows = await db.select().from(schema.reports).where(sql`${schema.reports.createdAt} < now() - interval '${days} days'`)
  const file = path.join(outDir, `reports_older_than_${days}d.json`)
  await fs.writeFile(file, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`Wrote ${rows.length} reports to ${file}`)
  return { rows, file }
}

async function dumpForumPosts(db: any, days: number) {
  const rows = await db.select().from(schema.forumPosts).where(sql`${schema.forumPosts.createdAt} < now() - interval '${days} days'`)
  const file = path.join(outDir, `forum_posts_older_than_${days}d.json`)
  await fs.writeFile(file, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`Wrote ${rows.length} forum posts to ${file}`)
  return { rows, file }
}

async function dumpReadingHistory(db: any, days: number) {
  const rows = await db.select().from(schema.readingHistory).where(sql`${schema.readingHistory.readAt} < now() - interval '${days} days'`)
  const file = path.join(outDir, `reading_history_older_than_${days}d.json`)
  await fs.writeFile(file, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`Wrote ${rows.length} reading history rows to ${file}`)
  return { rows, file }
}

async function run() {
  const days = Number(process.env.DAYS || process.argv[2] || 365)
  const prune = process.argv.includes('--prune') || process.env.PRUNE === '1'

  await ensureOut()
  const db = await connectDb()

  console.log(`Dumping records older than ${days} days`)
  const reports = await dumpReports(db, days)
  const forum = await dumpForumPosts(db, days)
  const reading = await dumpReadingHistory(db, days)

  if (prune) {
    console.log('Prune flag detected — deleting dumped rows from DB')
    // delete in safe order (children first if any)
    await db.delete(schema.reports).where(sql`${schema.reports.createdAt} < now() - interval '${days} days'`)
    await db.delete(schema.forumPosts).where(sql`${schema.forumPosts.createdAt} < now() - interval '${days} days'`)
    await db.delete(schema.readingHistory).where(sql`${schema.readingHistory.readAt} < now() - interval '${days} days'`)
    console.log('Prune complete')
  } else {
    console.log('Prune not enabled. Use --prune to remove dumped rows after verifying the dump.')
  }

  console.log('DB dump completed.')
}

run().catch((err) => {
  console.error('DB dump error:', err)
  process.exitCode = 1
})
