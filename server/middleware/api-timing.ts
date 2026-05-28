import { logger } from '../utils/logger'

export default defineEventHandler(async (event) => {
  const url = event.node?.req?.url || ''
  if (!url.startsWith('/api/')) return
  const start = Date.now()
  try {
    const result = await event.next?.()
    return result
  } finally {
    const ms = Date.now() - start
    // Keep logs concise — only warn for > 300ms or errors
    const status = (event.node?.res && (event.node.res.statusCode || 200)) || 200
    if (ms > 300 || status >= 500) {
      logger.warn(`[api-timing] ${status} ${ms}ms ${url}`)
    } else {
      logger.info(`[api-timing] ${status} ${ms}ms ${url}`)
    }
  }
})
