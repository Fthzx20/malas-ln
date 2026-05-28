import postgres from 'postgres'
import fs from 'fs'
const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))
  .reduce((acc, cur) => {
    const [k, v] = cur.split('=', 2)
    acc[k.trim()] = v.trim()
    return acc
  }, {})

for (const k of Object.keys(env)) process.env[k] = env[k]

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 3, connect_timeout: 10, idle_timeout: 20 })

async function main() {
  try {
    const rows = await sql`select count(*)::int as count from novels`
    console.log('COUNT', rows)
    const one = await sql`select id, slug, title, is_featured from novels limit 1`
    console.log('ONE', one)
  } catch (e) {
    console.error('DBERR', e?.message || e)
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

main()
