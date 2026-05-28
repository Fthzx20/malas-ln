// app/plugins/error-handler.client.ts
import { clientLogger } from '~/utils/client-logger'

export default defineNuxtPlugin(() => {
  window.onerror = (message, source, lineno, colno, error) => {
    clientLogger.error('[client:onerror]', { message, source, lineno, colno, error })
    // In production, forward to an error tracking service here
    return false // Don't suppress default browser error handling
  }

  window.onunhandledrejection = (event) => {
    clientLogger.error('[client:unhandledrejection]', event.reason)
  }
})
