import { isAppReady } from '../plugins/env-check'

export default defineEventHandler(async (event) => {
  const reqUrl = (event.node?.req && (event.node.req.url || '')) || ''
  if (!reqUrl.startsWith('/api/')) return

  // If startup checks failed, return 503 for API routes to prevent surprises
  if (!isAppReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Service temporarily unavailable' })
  }
})
