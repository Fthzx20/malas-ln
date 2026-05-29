import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { novels } from '../server/database/schema'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL is missing')
  }
  
  const client = postgres(dbUrl)
  const db = drizzle(client)

  console.log('Deleting all novels...')
  await db.delete(novels)
  console.log('All novels deleted successfully.')
  
  await client.end()
}

main().catch(console.error)
