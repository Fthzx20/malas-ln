import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import * as dotenv from 'dotenv'

dotenv.config()

const client = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(client, { schema })

async function check() {
  const novels = await db.select().from(schema.novels)
  const profiles = await db.select().from(schema.profiles)
  const settings = await db.select().from(schema.siteSettings)
  
  console.log(`Novels count: ${novels.length}`)
  console.log(`Profiles count: ${profiles.length}`)
  console.log(`Settings count: ${settings.length}`)
  process.exit(0)
}

check()
