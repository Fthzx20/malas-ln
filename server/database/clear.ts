import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is missing!')
  process.exit(1)
}

const client = postgres(process.env.DATABASE_URL, { max: 1 })
const db = drizzle(client, { schema })

async function clearData() {
  console.log('--- CLEARING ALL DATA ---')
  await db.delete(schema.readingHistory)
  await db.delete(schema.reports)
  await db.delete(schema.forumReplies)
  await db.delete(schema.forumPosts)
  await db.delete(schema.forumCategories)
  await db.delete(schema.comments)
  await db.delete(schema.ratings)
  await db.delete(schema.bookmarks)
  await db.delete(schema.footnotes)
  await db.delete(schema.chapters)
  await db.delete(schema.volumes)
  await db.delete(schema.novels)
  console.log('All novels and related data deleted successfully.')
  process.exit(0)
}

clearData().catch((err) => {
  console.error('Error clearing data:', err)
  process.exit(1)
})
