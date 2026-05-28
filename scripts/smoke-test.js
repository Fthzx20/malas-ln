const explicitBase = process.env.BASE_URL?.trim()
const BASE_CANDIDATES = explicitBase
  ? [explicitBase]
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3004']

const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000)
const READY_TIMEOUT_MS = Number(process.env.SMOKE_READY_TIMEOUT_MS || 45000)

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function simplifyError(err) {
  if (!err) return 'Unknown error'
  const causeCode = err?.cause?.code ? ` cause.code=${err.cause.code}` : ''
  const causeName = err?.cause?.name ? ` cause.name=${err.cause.name}` : ''
  return `${err.name || 'Error'}: ${err.message || String(err)}${causeCode}${causeName}`
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function checkOnce(url) {
  const res = await fetchWithTimeout(url)
  const text = await res.text()
  return { status: res.status, length: text.length, body: text }
}

async function waitForReady(base) {
  const start = Date.now()
  while (Date.now() - start < READY_TIMEOUT_MS) {
    try {
      const result = await checkOnce(`${base}/api/novels/`)
      if (result.status < 500) return true
    } catch (_) {
      // keep polling until timeout
    }
    await delay(1000)
  }
  return false
}

async function resolveBase() {
  for (const candidate of BASE_CANDIDATES) {
    const ready = await waitForReady(candidate)
    if (ready) return candidate
  }
  throw new Error(`No reachable base URL. Tried: ${BASE_CANDIDATES.join(', ')}`)
}

async function checkWithRetry(base, ep, failures, retries = 3) {
  const url = `${base}${ep}`
  const retryDelays = [400, 1200, 2500]

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const start = Date.now()
      const result = await checkOnce(url)
      const took = Date.now() - start
      console.log(`${ep} -> ${result.status} (${result.length} chars) ${took}ms`)
      if (result.status >= 500) {
        throw new Error(`HTTP ${result.status}`)
      }
      return result
    } catch (err) {
      if (attempt >= retries) {
        console.error(`${ep} -> ERROR after ${retries} attempts`) 
        console.error(simplifyError(err))
        failures.push({ endpoint: ep, error: simplifyError(err) })
        return null
      }
      console.warn(`${ep} -> attempt ${attempt} failed: ${simplifyError(err)}`)
      await delay(retryDelays[Math.min(attempt - 1, retryDelays.length - 1)])
    }
  }

  return null
}

async function run() {
  const failures = []
  const warnings = []
  const base = await resolveBase()

  console.log('Smoke test base:', base)
  console.log('Node:', process.version, 'global.fetch:', typeof fetch === 'function')

  const staticEndpoints = [
    '/api/novels/featured',
    '/api/novels',
    '/api/novels/search?q=test',
    '/api/novels/search?q=ab',
    '/api/forum',
  ]

  for (const ep of staticEndpoints) {
    await checkWithRetry(base, ep, failures)
  }

  // Dynamic checks: fetch novels list and probe a novel + chapter if available
  const novelsResult = await checkWithRetry(base, '/api/novels', failures)
  if (novelsResult?.status === 200) {
    try {
      const json = JSON.parse(novelsResult.body)
      const first = json?.data?.[0]
      if (first?.slug) {
        const dynamicFailures = []
        const novelResult = await checkWithRetry(base, `/api/novels/${first.slug}`, dynamicFailures)
        if (novelResult?.status === 200) {
          try {
            const detail = JSON.parse(novelResult.body)
            const chapterId = detail?.chapters?.[0]?.id
            if (chapterId) {
              await checkWithRetry(base, `/api/chapters/${chapterId}`, dynamicFailures)
            }
          } catch (err) {
            dynamicFailures.push({ endpoint: `/api/novels/${first.slug}`, error: `JSON parse error: ${simplifyError(err)}` })
          }
        }
        for (const warning of dynamicFailures) {
          warnings.push(warning)
        }
      }
    } catch (err) {
      warnings.push({ endpoint: '/api/novels', error: `Dynamic probe JSON parse error: ${simplifyError(err)}` })
    }
  }

  if (failures.length) {
    console.error(`\nSmoke summary: ${failures.length} failure(s)`)
    for (const failure of failures) {
      console.error(`- ${failure.endpoint}: ${failure.error}`)
    }
    process.exitCode = 1
    return
  }

  if (warnings.length) {
    console.warn(`\nSmoke warnings: ${warnings.length} optional probe issue(s)`)
    for (const warning of warnings) {
      console.warn(`- ${warning.endpoint}: ${warning.error}`)
    }
  }

  console.log('\nSmoke summary: all checks passed')
}

run().catch((err) => {
  console.error('Smoke test failed', err && (err.stack || err))
  process.exit(2)
})
