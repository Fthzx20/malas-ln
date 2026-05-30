import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config()

const expectedIndexes = [
  'profiles_role_created_idx',
  'novels_updated_at_idx',
  'novels_rating_count_idx',
  'novels_avg_rating_idx',
  'chapters_novel_published_number_idx',
  'ratings_novel_overall_idx',
  'forum_posts_category_flagged_pinned_updated_idx',
  'forum_replies_post_flagged_created_idx',
  'reports_status_created_idx',
  'reading_history_read_at_user_idx',
]

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const client = postgres(dbUrl, { max: 1 })

  try {
    const rows = await client.unsafe<{ indexname: string }[]>(
      `select indexname from pg_indexes
       where schemaname = 'public'
       and indexname = any($1::text[])
       order by indexname`,
      [expectedIndexes],
    )

    const found = new Set(rows.map(r => r.indexname))
    const missing = expectedIndexes.filter(name => !found.has(name))

    console.log('Found indexes:', Array.from(found))
    if (missing.length > 0) {
      console.error('Missing indexes:', missing)
      process.exitCode = 1
      return
    }

    console.log('All performance indexes are present.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
