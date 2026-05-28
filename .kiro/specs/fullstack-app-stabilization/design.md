# Design Document: Fullstack App Stabilization

## Overview

This document describes the technical architecture for stabilizing, optimizing, and enhancing the Rano LN light novel platform. The application is a Nuxt 4 / Vue 3 full-stack app using `@nuxtjs/supabase` for auth, Drizzle ORM + PostgreSQL (Supabase Transaction Pooler) for data, Pinia with `pinia-plugin-persistedstate` for state, Tailwind CSS v4 for styling, Cloudflare R2 for assets, and `@vite-pwa/nuxt` for PWA support.

The stabilization work is sequenced: critical runtime fixes first (auth race condition, DB resilience, hydration), then correctness improvements (cache invalidation, validation, error handling), then UX enhancements (mobile reader, community reliability, performance).

---

## Architecture

### High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Vue 3 + Pinia)                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ supabase-auth    │  │  AuthStore /     │  │  ReaderStore │  │
│  │ .client.ts       │  │  LibraryStore    │  │  (persisted) │  │
│  │ (onAuthState     │  │  (Pinia)         │  │              │  │
│  │  Change)         │  │                  │  │              │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────┘  │
│           │                     │                               │
│  ┌────────▼─────────────────────▼──────────────────────────┐   │
│  │  auth.global.ts middleware  (reactive, no polling)       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          │ $fetch / useFetch
┌─────────────────────────▼───────────────────────────────────────┐
│  Nitro Server                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ server/      │  │ server/utils │  │ Nitro onError hook     │ │
│  │ plugins/     │  │ /db.ts       │  │ (global error handler) │ │
│  │ env-check.ts │  │ (resilient   │  │                        │ │
│  │              │  │  singleton)  │  │                        │ │
│  └──────────────┘  └──────┬───────┘  └────────────────────────┘ │
│                           │ Drizzle ORM                          │
│  ┌────────────────────────▼────────────────────────────────────┐ │
│  │  PostgreSQL via Supabase Transaction Pooler                  │ │
│  │  (prepare: false, max: 3, connect_timeout: 10)              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```


---

## Components and Interfaces

### 1. Supabase Auth Plugin (`app/plugins/supabase-auth.client.ts`)

This is the single authoritative auth state listener. It replaces the `waitForSupabaseSession` polling pattern used in `app.vue`, `auth.global.ts`, `login.vue`, and `register.vue`.

**Responsibilities:**
- Register `supabase.auth.onAuthStateChange` exactly once at app startup
- Dispatch to `AuthStore` based on event type
- Expose a `Promise<void>` via `nuxtApp.provide('authReady', ...)` that resolves when the initial session check completes, allowing `auth.global.ts` to await it instead of polling

**Interface:**

```typescript
// app/plugins/supabase-auth.client.ts
export default defineNuxtPlugin(async (nuxtApp) => {
  const supabase = useSupabaseClient()
  const authStore = useAuthStore()

  // Resolve once the initial session state is known
  let resolveAuthReady!: () => void
  const authReady = new Promise<void>((resolve) => { resolveAuthReady = resolve })

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user && !authStore.isLoading) {
          if (authStore.profile?.authId !== session.user.id) {
            await authStore.fetchProfile().catch(() => authStore.clearProfile())
          }
        } else if (!session) {
          authStore.clearProfile()
        }
        resolveAuthReady()
      } else if (event === 'SIGNED_OUT') {
        authStore.clearProfile()
        // Clear persisted auth-adjacent state
        if (import.meta.client) {
          localStorage.removeItem('pinia-library')
        }
        resolveAuthReady()
      } else if (event === 'TOKEN_REFRESHED') {
        // Session refreshed — no profile re-fetch needed
        resolveAuthReady()
      } else if (event === 'USER_UPDATED') {
        await authStore.fetchProfile().catch(() => authStore.clearProfile())
        resolveAuthReady()
      }
    }
  )

  nuxtApp.provide('authReady', authReady)

  // Cleanup on app unmount
  nuxtApp.hook('app:beforeMount', () => {
    nuxtApp.hook('app:error', () => subscription.unsubscribe())
  })
})
```

**Updated `auth.global.ts`** replaces `waitForSupabaseSession` with:

```typescript
// app/middleware/auth.global.ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.client) {
    const { $authReady } = useNuxtApp()
    await $authReady  // wait for plugin's initial session resolution
  }
  // ... rest of guard logic using useSupabaseUser()
})
```


---

### 2. DB Singleton Resilience (`server/utils/db.ts`)

The current singleton caches the Drizzle client indefinitely. If the underlying postgres connection terminates (e.g., Supabase Transaction Pooler idle timeout), subsequent queries fail without recovery.

**Design:**

```typescript
// server/utils/db.ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'

let _db: PostgresJsDatabase<typeof schema> | null = null
let _client: postgres.Sql | null = null

export function useDB(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    const config = useRuntimeConfig()
    if (!config.databaseUrl) {
      throw createError({ statusCode: 503, statusMessage: 'DATABASE_URL is not configured' })
    }
    _client = postgres(config.databaseUrl, {
      prepare: false,       // Required for Supabase Transaction Pooler
      max: 3,               // Stay within free-tier connection limits
      connect_timeout: 10,  // Seconds before giving up on a new connection
      idle_timeout: 20,     // Seconds before closing idle connections
    })
    _db = drizzle(_client, { schema })
  }
  return _db
}

/** Reset the singleton — call after a detected connection failure or env rotation. */
export function resetDB(): void {
  _db = null
  _client?.end({ timeout: 5 }).catch(() => {})
  _client = null
}

/**
 * Wrap a DB operation with automatic reset on terminal connection errors.
 * Use this in API handlers that need resilience without manual try/catch.
 */
export async function withDB<T>(
  fn: (db: ReturnType<typeof useDB>) => Promise<T>
): Promise<T> {
  try {
    return await fn(useDB())
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isConnectionError = /connection|ECONNREFUSED|ETIMEDOUT|terminating/i.test(msg)
    if (isConnectionError) {
      resetDB()
      throw createError({ statusCode: 503, statusMessage: 'Database temporarily unavailable' })
    }
    throw err
  }
}
```

**Key changes from current implementation:**
- Added `connect_timeout: 10` (was missing)
- Added `resetDB()` export for env rotation and error recovery
- Added `withDB()` wrapper that auto-resets on connection errors and returns HTTP 503
- Tracks `_client` separately so it can be gracefully ended on reset


---

### 3. SWR Cache Invalidation Strategy

Nitro's `defineCachedEventHandler` stores responses in the configured storage driver (currently `memory`). Cache keys are derived from the route + a `getKey` function. Invalidation uses `useStorage('cache').removeItem(key)`.

**Cache key scheme for `/api/novels`:**

```typescript
// server/api/novels/index.get.ts
export default defineCachedEventHandler(async (event) => {
  // ... handler body unchanged
}, {
  maxAge: 300,       // 5 minutes (down from 3600)
  staleMaxAge: 60,   // Serve stale immediately, revalidate in background
  swr: true,
  getKey: (event) => {
    const q = getQuery(event)
    // Stable sort of keys ensures equivalent queries share a cache entry
    const parts = ['page', 'limit', 'sort', 'genre', 'search', 'author', 'year', 'status']
      .filter(k => q[k] !== undefined && q[k] !== '')
      .map(k => `${k}=${q[k]}`)
    return `novels:list:${parts.join('|') || 'default'}`
  },
})
```

**Cache purge utility (`server/utils/cache.ts`):**

```typescript
// server/utils/cache.ts
export async function purgeNovelsCache(): Promise<void> {
  const storage = useStorage('cache')
  // Nitro prefixes handler cache keys with "nitro:handlers:"
  const keys = await storage.getKeys('nitro:handlers:')
  const novelKeys = keys.filter(k =>
    k.includes('novels:list') || k.includes('novels:featured')
  )
  await Promise.all(novelKeys.map(k => storage.removeItem(k)))
}

export async function purgeNovelSlugCache(slug: string): Promise<void> {
  const storage = useStorage('cache')
  const keys = await storage.getKeys('nitro:handlers:')
  const slugKeys = keys.filter(k => k.includes(`novels:${slug}`))
  await Promise.all(slugKeys.map(k => storage.removeItem(k)))
}
```

**Integration in mutation handlers:**

```typescript
// server/api/novels/index.post.ts  (after successful insert)
await purgeNovelsCache()
return novel

// server/api/chapters/index.post.ts  (after successful insert)
await purgeNovelSlugCache(novelSlug)
```

**`nuxt.config.ts` route rule update:**

```typescript
routeRules: {
  '/api/novels': { swr: 300 },          // was 3600
  '/api/novels/featured': { swr: 300 }, // was 3600
}
```


---

### 4. Global Error Handling Architecture

**4a. `app/error.vue`** — Nuxt-level error page:

```vue
<!-- app/error.vue -->
<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; statusMessage: string } }>()
const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-8">
    <p class="font-mono text-6xl font-bold text-ink">{{ error.statusCode }}</p>
    <p class="mt-2 text-ink-muted">{{ error.statusMessage || 'Something went wrong' }}</p>
    <button @click="handleError" class="mt-6 underline text-accent">Return home</button>
  </div>
</template>
```

**4b. Nitro `onError` hook (`server/plugins/error-handler.ts`):**

```typescript
// server/plugins/error-handler.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    const requestId = event?.context?.requestId ?? crypto.randomUUID()
    // Sanitize stack — never expose file paths or internal details to client
    console.error(`[${requestId}] Unhandled server error:`, {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      url: event?.path,
    })
    // The error response body is set by Nitro; we only need to ensure
    // unhandled errors don't leak raw messages
    if (event && !event.handled) {
      setResponseStatus(event, 500)
      return send(event, JSON.stringify({
        statusCode: 500,
        statusMessage: 'Internal server error',
      }), 'application/json')
    }
  })
})
```

**4c. Client-side error handler (`app/plugins/error-handler.client.ts`):**

```typescript
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
```

**4d. Inline error state pattern for `useFetch` consumers:**

```vue
<script setup lang="ts">
const { data, error, refresh } = await useFetch('/api/novels')
</script>

<template>
  <div v-if="error" role="alert" class="p-4 border border-red-300 rounded">
    <p>{{ error.statusMessage || 'Failed to load data' }}</p>
    <button @click="refresh">Retry</button>
  </div>
  <NovelGrid v-else :novels="data" />
</template>
```


---

### 5. Pinia SSR Hydration Fix Strategy

The root cause of hydration mismatches is that `pinia-plugin-persistedstate` reads `localStorage` during SSR (where it doesn't exist), causing the server to render with default state while the client immediately rehydrates with persisted state — producing a DOM diff.

**Strategy A — `ReaderStore` (theme, font, fontSize):**

The reader page is already `ssr: false` via `routeRules`. However, any component that imports `useReaderStore` in a shared layout will still cause mismatches. The fix is to wrap theme-dependent elements in `<ClientOnly>`:

```vue
<!-- app/layouts/reader.vue -->
<ClientOnly>
  <div :style="readerStore.cssVars" :data-theme="readerStore.theme">
    <slot />
  </div>
  <template #fallback>
    <!-- SSR fallback uses default theme values inline -->
    <div style="--reader-font-size: 18px; --reader-line-height: 1.75">
      <slot />
    </div>
  </template>
</ClientOnly>
```

**Strategy B — `LibraryStore` (readChapterIds, localHistory):**

These fields are persisted but should be empty on SSR. The `pinia-plugin-persistedstate` `afterHydrate` hook is used to defer application:

```typescript
// app/stores/library.ts  — persist config update
persist: {
  pick: ['localHistory', 'readChapterIds'],
  afterHydrate: (ctx) => {
    // Normalize on every deserialization path
    ctx.store.readChapterIds = normalizeReadChapterIds(ctx.store.readChapterIds)
  },
  serializer: {
    serialize: (state) => JSON.stringify({
      localHistory: state.localHistory,
      readChapterIds: normalizeReadChapterIds(state.readChapterIds),
    }),
    deserialize: (value) => {
      const parsed = JSON.parse(value)
      return {
        localHistory: parsed.localHistory ?? [],
        readChapterIds: normalizeReadChapterIds(parsed.readChapterIds),
      }
    },
  },
}
```

Chapter read indicators use `<ClientOnly>` to prevent SSR/CSR mismatch:

```vue
<!-- In chapter list components -->
<ClientOnly>
  <span v-if="libraryStore.isChapterRead(chapter.id)" class="read-badge">✓</span>
</ClientOnly>
```


---

### 6. API Validation Middleware Pattern

Rather than duplicating validation logic in every handler, a shared validation utility is introduced:

```typescript
// server/utils/validate.ts
export function requireFields<T extends Record<string, unknown>>(
  body: T,
  fields: (keyof T)[]
): void {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      throw createError({
        statusCode: 400,
        statusMessage: `${String(field)} is required`,
        data: { statusCode: 400, field: String(field) },
      })
    }
  }
}
```

**Usage in handlers:**

```typescript
// server/api/forum/reply.post.ts
const body = await readBody(event)
requireFields(body, ['postId', 'content'])

// Validate post exists and is not locked
const post = await db.query.forumPosts.findFirst({
  where: (p, { eq }) => eq(p.id, body.postId),
  columns: { id: true, isLocked: true },
})
if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
if (post.isLocked) throw createError({ statusCode: 403, statusMessage: 'This thread is locked' })
```

**Consistent error body shape** — all `createError` calls include `data: { statusCode }` so client-side `isAuthError` can read it regardless of fetch library behavior:

```typescript
// server/utils/auth.ts — updated requireAuth
throw createError({
  statusCode: 401,
  statusMessage: 'Authentication required',
  data: { statusCode: 401 },
})
```

**Explicit `profileId` guards** replacing non-null assertions:

```typescript
// server/api/user/bookmarks.get.ts
const user = await requireAuth(event)
if (!user.profileId) {
  throw createError({ statusCode: 400, statusMessage: 'User profile not found', data: { statusCode: 400 } })
}
const conditions = [eq(bookmarks.userId, user.profileId)]
```


---

### 7. Shared Utility Extraction

**7a. `app/utils/auth-error.ts`** — single source of truth for `isAuthError`:

```typescript
// app/utils/auth-error.ts
export function getErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const c = error as { statusCode?: unknown; status?: unknown; data?: { statusCode?: unknown } }
  // Check body data first (consistent with server-side createError data field)
  if (typeof c.data?.statusCode === 'number') return c.data.statusCode
  if (typeof c.statusCode === 'number') return c.statusCode
  if (typeof c.status === 'number') return c.status
  return null
}

export function isAuthError(error: unknown): boolean {
  const code = getErrorStatusCode(error)
  return code === 401 || code === 403
}
```

Remove inline `isAuthError` definitions from `app/app.vue`, `app/middleware/auth.global.ts`, and `app/stores/auth.ts`. Import from `~/utils/auth-error` instead.

**7b. `fetchProfileWithRetry` moved to `AuthStore`:**

```typescript
// app/stores/auth.ts — new action
async fetchProfileWithRetry(attempts = 3): Promise<UserProfile | null> {
  let lastError: unknown = null
  for (let i = 0; i < attempts; i++) {
    try {
      return await this.fetchProfile()
    } catch (error) {
      lastError = error
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 150))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to load your profile')
},
```

Remove the local `fetchProfileWithRetry` functions from `login.vue` and `register.vue`. Replace with `authStore.fetchProfileWithRetry()`.


---

### 8. Mobile Reader UX Patterns

**8a. Bottom Sheet for Reader Settings Panel:**

The settings panel is conditionally rendered as a bottom sheet on mobile using a CSS class toggle driven by a `useBreakpoints` composable or a media query watcher:

```typescript
// app/composables/useIsMobile.ts
export function useIsMobile() {
  const isMobile = ref(false)
  onMounted(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    isMobile.value = mq.matches
    mq.addEventListener('change', (e) => { isMobile.value = e.matches })
  })
  return { isMobile }
}
```

```vue
<!-- ReaderSettingsPanel.vue -->
<Teleport to="body">
  <div
    v-if="isOpen"
    :class="isMobile
      ? 'fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-paper shadow-2xl p-6 pb-safe'
      : 'absolute top-full right-0 mt-2 w-72 bg-paper shadow-lg rounded-lg p-4'"
  >
    <!-- settings content -->
  </div>
</Teleport>
```

**8b. Floating Navigation Bar:**

```typescript
// app/composables/useScrollProgress.ts
export function useScrollProgress() {
  const scrollPct = ref(0)
  const showFloatingNav = ref(false)

  const onScroll = () => {
    const el = document.documentElement
    const pct = el.scrollTop / (el.scrollHeight - el.clientHeight)
    scrollPct.value = Math.round(pct * 100)
    showFloatingNav.value = pct > 0.10
  }

  onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
  onUnmounted(() => window.removeEventListener('scroll', onScroll))

  return { scrollPct, showFloatingNav }
}
```

**8c. Swipe Gesture Navigation:**

```typescript
// app/composables/useSwipeNav.ts
export function useSwipeNav(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 60
) {
  let startX = 0

  const onTouchStart = (e: TouchEvent) => { startX = e.touches[0]!.clientX }
  const onTouchEnd = (e: TouchEvent) => {
    const delta = e.changedTouches[0]!.clientX - startX
    if (Math.abs(delta) < threshold) return
    if (delta < 0) onSwipeLeft()
    else onSwipeRight()
  }

  onMounted(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
  })
  onUnmounted(() => {
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchend', onTouchEnd)
  })
}
```

Used in `app/pages/read/[chapterId].vue`:

```typescript
useSwipeNav(
  () => nextChapterId && navigateTo(`/read/${nextChapterId}`),
  () => prevChapterId && navigateTo(`/read/${prevChapterId}`)
)
```


---

### 9. Community Optimistic Update Pattern

Forum replies use an optimistic update pattern: the reply is appended to the local list immediately, then reverted if the API call fails.

```typescript
// app/pages/community/post/[id].vue
const replies = ref<Reply[]>([])
const pendingReplyId = ref<string | null>(null)

async function submitReply(content: string) {
  // Optimistic append
  const tempId = `temp-${Date.now()}`
  pendingReplyId.value = tempId
  replies.value.push({
    id: tempId,
    content,
    userId: authStore.profile!.id,
    createdAt: new Date().toISOString(),
    isPending: true,
  })

  try {
    const saved = await $fetch('/api/forum/reply', {
      method: 'POST',
      body: { postId: route.params.id, content },
    })
    // Replace temp entry with server-confirmed entry
    const idx = replies.value.findIndex(r => r.id === tempId)
    if (idx >= 0) replies.value[idx] = { ...saved, isPending: false }
  } catch (err) {
    // Revert optimistic update
    replies.value = replies.value.filter(r => r.id !== tempId)
    toast.error(err instanceof Error ? err.message : 'Failed to post reply')
  } finally {
    pendingReplyId.value = null
  }
}
```


---

### 10. Performance Optimization Approach

**CLS Prevention — `<NuxtImg>` with explicit dimensions:**

All novel card images use a fixed aspect ratio. The `width` and `height` attributes are set to match the CSS aspect ratio so the browser reserves space before the image loads:

```vue
<!-- components/NovelCard.vue -->
<NuxtImg
  :src="novel.coverUrl ?? '/placeholder-cover.webp'"
  :alt="novel.title"
  width="200"
  height="280"
  loading="lazy"
  class="w-full object-cover"
/>
```

Hero carousel images are above the fold and use `loading="eager"` with a `<link rel="preload">` injected via `useHead`:

```typescript
// app/pages/index.vue
const { data: featured } = await useFetch('/api/novels/featured')
const firstCover = computed(() => featured.value?.[0]?.coverUrl)

useHead(computed(() => ({
  link: firstCover.value ? [{
    rel: 'preload',
    as: 'image',
    href: firstCover.value,
  }] : [],
})))
```

**Lazy secondary data on `/novels` page:**

```typescript
// app/pages/novels/index.vue
// Primary data — blocks render
const { data: novels } = await useFetch('/api/novels', { query: novelQuery })

// Secondary data — non-blocking
const { data: trending } = useFetch('/api/novels', {
  query: { sort: 'popular', limit: 5 },
  lazy: true,
})
```

**`staleMaxAge` in cached handler:**

```typescript
// server/api/novels/index.get.ts
}, {
  maxAge: 300,
  staleMaxAge: 60,  // Serve stale for up to 60s while revalidating
  swr: true,
  getKey: (event) => { /* ... */ },
})
```

---

### 11. Environment Validation (`server/plugins/env-check.ts`)

```typescript
// server/plugins/env-check.ts
export default defineNitroPlugin(async (nitroApp) => {
  const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  const config = useRuntimeConfig()

  const missing = required.filter(key => {
    const val = key === 'DATABASE_URL' ? config.databaseUrl
      : key === 'SUPABASE_SERVICE_ROLE_KEY' ? config.supabaseServiceRoleKey
      : process.env[key]
    return !val || val.trim() === ''
  })

  if (missing.length > 0) {
    console.error(`[env-check] Missing required environment variables: ${missing.join(', ')}`)
    // Block all API routes until fixed
    nitroApp.hooks.hook('request', (event) => {
      if (event.path.startsWith('/api/')) {
        throw createError({
          statusCode: 503,
          statusMessage: `Server misconfigured: missing ${missing.join(', ')}`,
        })
      }
    })
    return
  }

  // SSL warning
  const dbUrl = config.databaseUrl as string
  if (!dbUrl.includes('sslmode=require') && !dbUrl.includes('ssl=true')) {
    console.warn('[env-check] DATABASE_URL does not include SSL configuration. Recommended for production.')
  }

  // Connectivity check
  try {
    const db = useDB()
    await db.execute(sql`SELECT 1`)
    console.info('[env-check] Database connectivity confirmed.')
  } catch (err) {
    const host = (() => {
      try { return new URL(config.databaseUrl as string).host } catch { return 'unknown' }
    })()
    console.error(`[env-check] Database connectivity check failed (host: ${host}):`, err)
  }
})
```


---

## Data Models

No new database tables are introduced. The existing schema in `server/database/schema/tables.ts` is unchanged. The following data flow changes are relevant:

### Auth State Flow (new)

```
Supabase Auth Event
       │
       ▼
supabase-auth.client.ts plugin
       │
       ├─ INITIAL_SESSION / SIGNED_IN ──► AuthStore.fetchProfile() (if not loading, if authId changed)
       ├─ SIGNED_OUT ──────────────────► AuthStore.clearProfile() + localStorage.removeItem('pinia-library')
       ├─ TOKEN_REFRESHED ─────────────► (no-op — session updated internally by @nuxtjs/supabase)
       └─ USER_UPDATED ────────────────► AuthStore.fetchProfile()
```

### Cache Key Structure

| Route | Cache Key Pattern | TTL | staleMaxAge |
|---|---|---|---|
| `GET /api/novels` | `novels:list:{params}` | 300s | 60s |
| `GET /api/novels/featured` | `novels:featured` | 300s | 60s |
| `GET /api/novels/[slug]` | `novels:slug:{slug}` | 300s | 60s |

### Error Response Shape (standardized)

All API errors now include `statusCode` in the response body:

```typescript
interface ApiError {
  statusCode: number
  statusMessage: string
  data?: { statusCode: number; [key: string]: unknown }
}
```

---

## File Structure Changes

```
app/
  plugins/
    supabase-auth.client.ts   ← NEW (replaces waitForSupabaseSession pattern)
    error-handler.client.ts   ← NEW (window.onerror + onunhandledrejection)
  utils/
    auth-error.ts             ← NEW (shared isAuthError, getErrorStatusCode)
  composables/
    useIsMobile.ts            ← NEW
    useScrollProgress.ts      ← NEW
    useSwipeNav.ts            ← NEW
    useAuthSession.ts         ← DEPRECATED (kept for backward compat, no new call sites)
  error.vue                   ← NEW (Nuxt error page)
  middleware/
    auth.global.ts            ← MODIFIED (await $authReady, remove waitForSupabaseSession)
  stores/
    auth.ts                   ← MODIFIED (add fetchProfileWithRetry action, import isAuthError)
    library.ts                ← MODIFIED (afterHydrate hook, normalizeReadChapterIds on all paths)
  pages/
    auth/login.vue            ← MODIFIED (remove local fetchProfileWithRetry, use store action)
    auth/register.vue         ← MODIFIED (remove local fetchProfileWithRetry, use store action)
    read/[chapterId].vue      ← MODIFIED (add swipe nav, floating nav, remove isReadingOffline)
  app.vue                     ← MODIFIED (remove waitForSupabaseSession, remove inline isAuthError)

server/
  plugins/
    env-check.ts              ← NEW (startup env + connectivity validation)
    error-handler.ts          ← NEW (Nitro onError hook)
  utils/
    db.ts                     ← MODIFIED (add resetDB, withDB, connect_timeout)
    validate.ts               ← NEW (requireFields helper)
    cache.ts                  ← NEW (purgeNovelsCache, purgeNovelSlugCache)
  api/
    novels/index.get.ts       ← MODIFIED (getKey, staleMaxAge, maxAge: 300)
    novels/index.post.ts      ← MODIFIED (call purgeNovelsCache after insert)
    novels/[slug].put.ts      ← MODIFIED (call purgeNovelsCache after update)
    chapters/index.post.ts    ← MODIFIED (call purgeNovelSlugCache after publish)
    user/bookmarks.get.ts     ← MODIFIED (explicit profileId guard)
    ratings/index.post.ts     ← MODIFIED (explicit profileId guard)
    forum/reply.post.ts       ← MODIFIED (validate postId, check isLocked)
```


---

## Error Handling

### Server-Side Error Hierarchy

| Condition | HTTP Status | Response Body |
|---|---|---|
| Missing env var | 503 | `{ statusCode: 503, statusMessage: 'Server misconfigured: missing X' }` |
| DB connection failure | 503 | `{ statusCode: 503, statusMessage: 'Database temporarily unavailable' }` |
| Unauthenticated | 401 | `{ statusCode: 401, statusMessage: 'Authentication required' }` |
| Insufficient role | 403 | `{ statusCode: 403, statusMessage: 'Forbidden. Required role: X' }` |
| Missing required field | 400 | `{ statusCode: 400, statusMessage: '<field> is required' }` |
| Profile not found | 400 | `{ statusCode: 400, statusMessage: 'User profile not found' }` |
| Locked thread | 403 | `{ statusCode: 403, statusMessage: 'This thread is locked' }` |
| Unhandled exception | 500 | `{ statusCode: 500, statusMessage: 'Internal server error' }` |

### Client-Side Error Handling Decision Tree

```
useFetch/fetch error
       │
       ├─ isAuthError (401/403) ──► clearProfile() + redirect to /auth/login
       │
       ├─ 503 ──────────────────► Show "Service temporarily unavailable" toast
       │
       ├─ 400 ──────────────────► Show inline field error or toast with statusMessage
       │
       └─ Other ────────────────► Show generic error toast + log to console
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Auth event dispatch correctness

*For any* Supabase auth event received by the `supabase-auth.client.ts` plugin, the correct `AuthStore` action is invoked: `SIGNED_IN` and `INITIAL_SESSION` with a session trigger `fetchProfile` (unless `isLoading` is true), `SIGNED_OUT` triggers `clearProfile`, `TOKEN_REFRESHED` triggers no store action, and `USER_UPDATED` triggers `fetchProfile`.

**Validates: Requirements 2.3, 2.4, 9.2, 9.3, 9.4**

### Property 2: Auth error always triggers clearProfile

*For any* error thrown by `AuthStore.fetchProfile()` where the error's `statusCode` is 401 or 403, the `AuthStore.clearProfile()` action is called and the user is redirected to `/auth/login`.

**Validates: Requirements 2.6, 6.1**

### Property 3: Username validation rejects invalid inputs

*For any* string input to the username normalization/validation function, the function accepts only strings matching `/^[a-z0-9_]{3,20}$/` and rejects all others (strings with spaces, special characters, length < 3, length > 20).

**Validates: Requirements 3.4**

### Property 4: Profile creation handles concurrent requests

*For any* `authId`, if two concurrent requests to `GET /api/user/profile` both find no existing profile and attempt to insert, exactly one profile row is created and both requests return the same profile object without a 500 error.

**Validates: Requirements 3.3**

### Property 5: normalizeReadChapterIds always returns string array

*For any* input value (including `Set<string>`, `Array<string>`, `Array<mixed>`, `null`, `undefined`, plain objects), `normalizeReadChapterIds` returns an `Array<string>` with no non-string elements.

**Validates: Requirements 4.4**

### Property 6: Cache keys are unique per query parameter combination

*For any* two distinct combinations of query parameters (`page`, `limit`, `sort`, `genre`, `search`, `author`, `year`, `status`), the `getKey` function in `defineCachedEventHandler` produces different cache key strings.

**Validates: Requirements 5.4**

### Property 7: Novel mutations invalidate the cache

*For any* successful `POST /api/novels` or `PUT /api/novels/[slug]` request, a subsequent `GET /api/novels` request returns data that reflects the mutation (i.e., the stale cache entry has been purged).

**Validates: Requirements 5.1**

### Property 8: Unhandled server exceptions return HTTP 500 with generic body

*For any* unhandled exception thrown in a Nitro API handler (not a `createError` call), the Nitro `onError` hook intercepts it and the client receives HTTP 500 with `{ statusCode: 500, statusMessage: 'Internal server error' }` — never the raw exception message or stack trace.

**Validates: Requirements 6.3**

### Property 9: DB singleton resets and recovers after connection error

*For any* DB connection error detected by `withDB()`, the `_db` singleton is reset to `null` so that the next call to `useDB()` creates a fresh client rather than reusing the broken one.

**Validates: Requirements 7.1, 7.3**

### Property 10: All API handlers return 400 for missing required fields

*For any* API endpoint that accepts a request body, a request omitting any required field returns HTTP 400 with a `statusMessage` identifying the missing field, and the `statusCode` field is present in the response body.

**Validates: Requirements 8.1, 8.4**

### Property 11: fetchProfileWithRetry succeeds after transient failures

*For any* sequence of `fetchProfile` calls where the first `k` calls fail (k < 3) and the `(k+1)`th call succeeds, `fetchProfileWithRetry(3)` returns the profile without throwing.

**Validates: Requirements 14.2**

### Property 12: Swipe gesture direction maps to correct navigation

*For any* horizontal swipe on the chapter reader where the swipe delta exceeds the threshold (60px), a leftward swipe navigates to the next chapter (if available) and a rightward swipe navigates to the previous chapter (if available); swipes below the threshold produce no navigation.

**Validates: Requirements 11.4**

### Property 13: Optimistic reply revert on failure

*For any* forum reply submission that fails with an API error, the reply list is reverted to its exact pre-submission state (the optimistically appended entry is removed and no duplicate entries remain).

**Validates: Requirements 12.3**

### Property 14: Report form validation prevents API call on missing fields

*For any* report submission missing one or more of `targetType`, `targetId`, or `reason`, no `$fetch` call to `/api/reports` is made and an inline error is displayed to the user.

**Validates: Requirements 12.4**

### Property 15: NuxtImg components in card grids have non-zero width and height

*For any* `<NuxtImg>` rendered within a novel card grid or hero carousel component, the `width` and `height` props are both non-zero positive integers, preventing layout shift during image load.

**Validates: Requirements 13.1**


---

## Testing Strategy

### Dual Testing Approach

Both unit/example-based tests and property-based tests are used. Unit tests cover specific scenarios, integration points, and edge cases. Property tests cover universal invariants across a wide range of generated inputs.

### Unit / Example Tests

- Auth plugin: verify `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED` each trigger the correct store action with concrete mock events
- `error.vue`: render with a 404 error and verify status code and home link are present
- `bookmarks.get.ts`: verify HTTP 400 when `profileId` is undefined
- `ratings/index.post.ts`: verify HTTP 400 when `profileId` is undefined
- `forum/reply.post.ts`: verify HTTP 403 when post is locked, HTTP 404 when post not found
- `ReaderStore` SSR: verify default values are returned during server-side rendering
- `LibraryStore` SSR: verify `localHistory` and `readChapterIds` are empty arrays during SSR
- Hero carousel: verify `<link rel="preload">` is injected for the first featured novel cover
- Floating nav: verify it appears after scrolling past 10% of chapter content

### Property-Based Tests

Property tests use a framework such as `fast-check` (TypeScript-native). Each test runs a minimum of 100 iterations.

| Property | Generator Strategy |
|---|---|
| P1: Auth event dispatch | Generate random event types from the known set; verify correct store method called |
| P2: Auth error triggers clearProfile | Generate errors with statusCode 401 or 403; verify clearProfile is called |
| P3: Username validation | Generate arbitrary strings; verify accept/reject matches regex `/^[a-z0-9_]{3,20}$/` |
| P4: Concurrent profile creation | Simulate two concurrent inserts for the same authId; verify single row and no 500 |
| P5: normalizeReadChapterIds | Generate Sets, Arrays, mixed arrays, null, undefined; verify always returns `string[]` |
| P6: Cache key uniqueness | Generate pairs of distinct query param objects; verify keys differ |
| P7: Novel mutation invalidates cache | Generate novel payloads; verify GET after POST returns fresh data |
| P8: Unhandled exceptions return 500 | Generate arbitrary Error objects; verify response is 500 with generic body |
| P9: DB singleton resets on error | Simulate connection errors; verify `_db` is null after `withDB` catches them |
| P10: API 400 on missing fields | Generate partial request bodies; verify 400 with field name in statusMessage |
| P11: fetchProfileWithRetry | Generate failure counts 0–2 followed by success; verify eventual success |
| P12: Swipe gesture navigation | Generate swipe deltas; verify threshold behavior and direction mapping |
| P13: Optimistic reply revert | Generate reply lists and failed submissions; verify list is unchanged after revert |
| P14: Report validation prevents API call | Generate reports missing 1+ required fields; verify no fetch is made |
| P15: NuxtImg width/height non-zero | Generate novel card data; verify rendered NuxtImg has positive width and height |

### Tag Format

Each property test is tagged for traceability:

```
Feature: fullstack-app-stabilization, Property {N}: {property_title}
```

Example: `Feature: fullstack-app-stabilization, Property 5: normalizeReadChapterIds always returns string array`
