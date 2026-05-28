const base = process.env.BASE_URL || 'http://localhost:3004'
const endpoints = [
  '/api/novels/featured.get',
  '/api/novels/'
]

async function checkOnce(url) {
  const res = await fetch(url, { method: 'GET' })
  const text = await res.text()
  return { status: res.status, length: text.length, body: text }
}

async function run() {
  console.log('Smoke test base:', base)
  console.log('Node:', process.version, 'global.fetch:', typeof fetch === 'function')

  for (const ep of endpoints) {
    const url = `${base}${ep}`
    try {
      const start = Date.now()
      const result = await checkOnce(url)
      console.log(`${ep} -> ${result.status} (${result.length} chars) ${Date.now() - start}ms`)
    } catch (err) {
      // retry once for transient failures
      console.warn(`${ep} -> first attempt failed:`, err && (err.message || err))
      try {
        const result = await checkOnce(url)
        console.log(`${ep} -> ${result.status} (${result.length} chars) (retry)`)
      } catch (err2) {
        console.error(`${ep} -> ERROR after retry`)
        console.error('Error name:', err2 && err2.name)
        console.error('Error message:', err2 && (err2.message || err2))
        if (err2 && err2.stack) console.error('Stack:', err2.stack)
        try {
          console.error('Full error props:', JSON.stringify(Object.getOwnPropertyNames(err2).reduce((acc, k) => (acc[k]=err2[k], acc), {}), null, 2))
        } catch (_) {}
      }
    }
  }
}

run().catch(err => { console.error('Smoke test failed', err && (err.stack || err)); process.exit(2) })
