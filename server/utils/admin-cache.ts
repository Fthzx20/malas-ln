type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const adminCache = new Map<string, CacheEntry<unknown>>()

export function getAdminCache<T>(key: string): T | null {
  const entry = adminCache.get(key)
  if (!entry) return null

  if (Date.now() >= entry.expiresAt) {
    adminCache.delete(key)
    return null
  }

  return entry.value as T
}

export function setAdminCache<T>(key: string, value: T, ttlMs: number): void {
  adminCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  })
}

export function invalidateAdminCache(key: string): void {
  adminCache.delete(key)
}

export function invalidateAdminCachePrefix(prefix: string): void {
  for (const key of adminCache.keys()) {
    if (key.startsWith(prefix)) {
      adminCache.delete(key)
    }
  }
}
