// server/plugins/error-handler.ts
import { logger } from '../utils/logger'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    const requestId = event?.context?.requestId ?? crypto.randomUUID()
    // Sanitize stack — never expose file paths or internal details to client
    logger.error(`[${requestId}] Unhandled server error:`, {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      url: event?.path,
    })
    // The error response body is set by Nitro; we only need to ensure
    // Normalize error response body and status code for clients.
    if (event) {
      // Determine status code and message from the error when available.
      const statusCode = (error as any)?.statusCode || (error as any)?.status || 500
      const statusMessage = (error as any)?.statusMessage || error.message || (statusCode === 500 ? 'Internal server error' : 'Error')

      // Mark event handled defensively (compat across Nitro/h3 versions)
      try {
        if ((event as any)._handled !== undefined) {
          try { (event as any)._handled = true } catch {}
        } else {
          try {
            Object.defineProperty(event, 'handled', { value: true, writable: true, configurable: true })
          } catch {}
        }
      } catch {}

      setResponseStatus(event, Number(statusCode))
      return send(event, JSON.stringify({
        statusCode: Number(statusCode),
        statusMessage,
      }), 'application/json')
    }
  })
})
