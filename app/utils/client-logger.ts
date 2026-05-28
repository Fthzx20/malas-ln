// Lightweight client-side logger that is silent in production builds
export const clientLogger = {
  log: (...args: any[]) => { if (import.meta.env.DEV) console.log(...args) },
  info: (...args: any[]) => { if (import.meta.env.DEV) console.info(...args) },
  warn: (...args: any[]) => { if (import.meta.env.DEV) console.warn(...args) },
  error: (...args: any[]) => { if (import.meta.env.DEV) console.error(...args) },
}

export default clientLogger
