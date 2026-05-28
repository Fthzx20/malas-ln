import { sql } from 'drizzle-orm'

export async function ensureSiteNoticeTable(db: ReturnType<typeof useDB>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_notice (
      id text PRIMARY KEY NOT NULL DEFAULT 'homepage-popup',
      message text NOT NULL DEFAULT '',
      is_active boolean NOT NULL DEFAULT false,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `)
}
