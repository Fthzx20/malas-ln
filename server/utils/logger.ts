const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const envLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug')).toLowerCase() as keyof typeof LEVELS
const MIN_LEVEL = LEVELS[envLevel] ?? 1

function formatPrefix(level: string) {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}]`
}

export const logger = {
  debug: (...args: any[]) => { if (MIN_LEVEL <= LEVELS.debug) console.debug(formatPrefix('debug'), ...args) },
  info: (...args: any[]) => { if (MIN_LEVEL <= LEVELS.info) console.info(formatPrefix('info'), ...args) },
  warn: (...args: any[]) => { if (MIN_LEVEL <= LEVELS.warn) console.warn(formatPrefix('warn'), ...args) },
  error: (...args: any[]) => { if (MIN_LEVEL <= LEVELS.error) console.error(formatPrefix('error'), ...args) },
}

export default logger
