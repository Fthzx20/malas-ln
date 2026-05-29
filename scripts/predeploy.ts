import fs from 'fs/promises'
import path from 'path'

const root = path.resolve(__dirname, '..')

const cachePaths = [
  'node-compile-cache',
  'lighthouse-temp',
  '.nuxt',
  '.output',
  'chrome-profile',
]

async function removeIfExists(relPath: string) {
  const full = path.join(root, relPath)
  try {
    await fs.rm(full, { recursive: true, force: true })
    console.log(`Removed: ${relPath}`)
  } catch (err: any) {
    console.warn(`Could not remove ${relPath}:`, err?.message || err)
  }
}

async function run() {
  console.log('Predeploy: cleaning local cache folders')
  for (const p of cachePaths) {
    await removeIfExists(p)
  }

  // Also remove ephemeral smoke/test artifacts commonly left in repo root
  const optionalFiles = ['smoke_output.txt', 'smoke_output_after_restart.txt', 'smoke_extended.txt', 'smoke_extended2.txt', 'tmp_novels.json']
  for (const f of optionalFiles) {
    const full = path.join(root, f)
    try {
      await fs.rm(full, { force: true })
      console.log(`Removed artifact: ${f}`)
    } catch (_) {
      // ignore
    }
  }

  console.log('Predeploy: done. To dump DB data run `npm run db:dump-unneeded`')
}

run().catch((err) => {
  console.error('Predeploy error:', err)
  process.exitCode = 1
})
