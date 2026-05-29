import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  console.log('--- START SEEDING ---')
  console.log('Dummy data seeding has been removed for production readiness.')
  console.log('Add real initial data logic here if needed (e.g. default site_settings).')
  console.log('--- SEEDING COMPLETED ---')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal Seeding Error:', err)
  process.exit(1)
})
