// app/plugins/error-handler.client.ts
export default defineNuxtPlugin(() => {
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('[client:onerror]', { message, source, lineno, colno, error })
    // In production, forward to an error tracking service here
    return false // Don't suppress default browser error handling
  }

  window.onunhandledrejection = (event) => {
    console.error('[client:unhandledrejection]', event.reason)
  }
})
