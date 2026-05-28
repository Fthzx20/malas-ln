# Implementation Plan: Fullstack App Stabilization

## Overview

Stabilize, optimize, and enhance the Rano LN platform in three sequenced phases: (1) critical runtime fixes — auth race condition, DB resilience, and SSR hydration; (2) correctness improvements — cache invalidation, API validation, and error handling; (3) UX enhancements — mobile reader, community reliability, performance, and refactoring.

The stack is Nuxt 4 / Vue 3 / TypeScript, `@nuxtjs/supabase`, Drizzle ORM + PostgreSQL (Supabase Transaction Pooler), Pinia with `pinia-plugin-persistedstate`, Tailwind CSS v4, and `@vite-pwa/nuxt`.

---

## Tasks

### Phase 1 — Critical Fixes

- [ ] 1. Create the Supabase auth plugin and refactor all polling call sites
  - [x] 1.1 Create `app/plugins/supabase-auth.client.ts`
    - Register `supabase.auth.onAuthStateChange` exactly once at app startup
    - Handle `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, and `USER_UPDATED` events per the design
    - Provide `nuxtApp.provide('authReady', authReady)` — a `Promise<void>` that resolves when the initial session check completes
    - Guard `fetchProfile()` with `!authStore.isLoading` and `authStore.profile?.authId !== session.user.id` to prevent duplicate calls
    - On `SIGNED_OUT`, call `authStore.clearProfile()` and `localStorage.removeItem('pinia-library')`
    - Unsubscribe the listener on app unmount via `nuxtApp.hook('app:error', ...)`
    - _Requirements: 2.3, 2.4, 2.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 1.2 Refactor `app/middleware/auth.global.ts` to await `$authReady`
    - Replace the `waitForSupabaseSession` polling call with `await useNuxtApp().$authReady` (client-side only)
    - Remove the local `isAuthError` inline definition (will be imported from `~/utils/auth-error` in task 7.1)
    - Keep all existing route guard logic (protected routes, auth routes, admin check) intact
    - _Requirements: 2.2, 9.5_

  - [x] 1.3 Refactor `app/app.vue` to remove `waitForSupabaseSession`
    - Delete the `onMounted` block that calls `waitForSupabaseSession` and the `watch(user, ...)` watcher
    - Remove the local `isAuthError` inline definition
    - Keep `useToastProvider()`, `useHead` title template, and the `<UiToast />` portal
    - _Requirements: 2.3, 9.5, 14.1_

  - [-] 1.4 Refactor `app/pages/auth/login.vue` to remove `waitForSupabaseSession`
    - Delete the local `fetchProfileWithRetry` function and the `waitForSupabaseSession` call in `handleLogin`
    - After `signInWithPassword` succeeds, watch `useSupabaseUser()` reactively (or rely on the plugin) and call `authStore.fetchProfileWithRetry()` (added in task 3.1)
    - _Requirements: 2.1, 9.5, 14.2_

  - [-] 1.5 Refactor `app/pages/auth/register.vue` to remove `waitForSupabaseSession`
    - Apply the same changes as 1.4 — remove local `fetchProfileWithRetry` and polling, use `authStore.fetchProfileWithRetry()`
    - _Requirements: 2.1, 9.5, 14.2_

- [x] 2. Harden the DB singleton in `server/utils/db.ts`
  - [x] 2.1 Add `connect_timeout`, `resetDB()`, and `withDB()` to `server/utils/db.ts`
    - Track `_client` separately from `_db` so it can be gracefully ended on reset
    - Add `connect_timeout: 10` to the `postgres()` options (retain `prepare: false`, `max: 3`, `idle_timeout: 20`)
    - Export `resetDB()` that sets `_db` and `_client` to `null` and calls `_client.end({ timeout: 5 })`
    - Export `withDB<T>(fn)` that catches connection errors matching `/connection|ECONNREFUSED|ETIMEDOUT|terminating/i`, calls `resetDB()`, and re-throws as HTTP 503
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 3. Add `fetchProfileWithRetry` action to `AuthStore`
  - [x] 3.1 Add `fetchProfileWithRetry` action to `app/stores/auth.ts`
    - Implement retry loop (default 3 attempts, 150 ms delay between attempts) as a store action
    - Throw the last error if all attempts fail
    - _Requirements: 14.2_

- [ ] 4. Fix Pinia SSR hydration mismatches
  - [x] 4.1 Update `app/stores/library.ts` persist config with `afterHydrate` hook
    - Add `afterHydrate` callback that calls `normalizeReadChapterIds` on `ctx.store.readChapterIds`
    - Update the `serializer.serialize` to only include `localHistory` and `readChapterIds` (not spread all state)
    - Ensure `serializer.deserialize` calls `normalizeReadChapterIds` and returns only the two persisted fields with safe defaults
    - _Requirements: 4.2, 4.4_

  - [-] 4.2 Wrap SSR-sensitive UI in `<ClientOnly>` in chapter list components
    - Find all usages of `libraryStore.isChapterRead(...)` in templates and wrap the read-indicator element in `<ClientOnly>`
    - _Requirements: 4.3_

  - [-] 4.3 Wrap reader theme elements in `<ClientOnly>` in `app/layouts/reader.vue`
    - Wrap the theme/font-dependent `<div>` in `<ClientOnly>` with a plain fallback `<div>` using default CSS variable values
    - _Requirements: 4.1, 4.3_

- [~] 5. Checkpoint — Phase 1 complete
  - Ensure all tests pass, ask the user if questions arise.

---

### Phase 2 — Correctness Improvements

- [ ] 6. Implement SWR cache invalidation
  - [x] 6.1 Create `server/utils/cache.ts` with purge utilities
    - Implement `purgeNovelsCache()` that removes all `nitro:handlers:` keys containing `novels:list` or `novels:featured`
    - Implement `purgeNovelSlugCache(slug)` that removes keys containing `novels:{slug}`
    - _Requirements: 5.1, 5.2_

  - [-] 6.2 Update `server/api/novels/index.get.ts` cache configuration
    - Add `getKey` function incorporating all query params (`page`, `limit`, `sort`, `genre`, `search`, `author`, `year`, `status`) with stable sort
    - Set `maxAge: 300`, `staleMaxAge: 60`, `swr: true`
    - _Requirements: 5.4, 13.5_

  - [~] 6.3 Call `purgeNovelsCache()` in mutation handlers
    - In `server/api/novels/index.post.ts`: call `await purgeNovelsCache()` after successful insert
    - In `server/api/novels/[slug].put.ts`: call `await purgeNovelsCache()` after successful update
    - _Requirements: 5.1_

  - [~] 6.4 Call `purgeNovelSlugCache()` in chapter publish handler
    - In `server/api/chapters/index.post.ts`: call `await purgeNovelSlugCache(novelSlug)` after successful chapter insert
    - _Requirements: 5.2_

  - [~] 6.5 Reduce SWR TTL in `nuxt.config.ts`
    - Change `'/api/novels': { swr: 3600 }` to `{ swr: 300 }`
    - Change `'/api/novels/featured': { swr: 3600 }` to `{ swr: 300 }`
    - _Requirements: 5.3_

- [ ] 7. Extract shared utilities and add API validation
  - [x] 7.1 Create `app/utils/auth-error.ts`
    - Implement `getErrorStatusCode(error)` checking `data.statusCode`, `statusCode`, and `status` fields in that priority order
    - Implement `isAuthError(error)` returning `true` for 401 or 403
    - _Requirements: 14.1_

  - [-] 7.2 Replace inline `isAuthError` definitions with imports from `~/utils/auth-error`
    - Remove the inline `isAuthError` / `getErrorStatusCode` functions from `app/app.vue`, `app/middleware/auth.global.ts`, and `app/stores/auth.ts`
    - Add `import { isAuthError, getErrorStatusCode } from '~/utils/auth-error'` to each file
    - _Requirements: 14.1_

  - [x] 7.3 Create `server/utils/validate.ts` with `requireFields` helper
    - Implement `requireFields<T>(body, fields)` that throws `createError({ statusCode: 400, ... })` for any missing/empty field
    - _Requirements: 8.1_

  - [-] 7.4 Apply `requireFields` and explicit `profileId` guards to API handlers
    - `server/api/user/bookmarks.get.ts`: replace `user.profileId!` non-null assertion with explicit guard throwing HTTP 400
    - `server/api/ratings/index.post.ts`: replace `user.profileId!` non-null assertions with explicit guards
    - `server/api/forum/reply.post.ts`: replace manual field check with `requireFields(body, ['postId', 'content'])`, add post-exists and `isLocked` check before insert
    - _Requirements: 8.2, 8.3, 8.5_

  - [x] 7.5 Add `data: { statusCode }` to all `createError` calls in `server/utils/auth.ts`
    - Update `requireAuth` and `requireRole` to include `data: { statusCode: 401 }` / `data: { statusCode: 403 }` so client-side `isAuthError` can read it
    - _Requirements: 8.4_

- [ ] 8. Implement global error handling
  - [x] 8.1 Create `app/error.vue`
    - Display `error.statusCode`, `error.statusMessage || 'Something went wrong'`, and a "Return home" button that calls `clearError({ redirect: '/' })`
    - Use existing Tailwind utility classes consistent with the app's design system
    - _Requirements: 6.1_

  - [x] 8.2 Create `server/plugins/error-handler.ts`
    - Hook into `nitroApp.hooks.hook('error', ...)` to log unhandled errors with a `requestId` and sanitized stack (first 5 lines)
    - For unhandled events, return HTTP 500 with `{ statusCode: 500, statusMessage: 'Internal server error' }`
    - Never expose raw PostgreSQL error messages or file paths
    - _Requirements: 6.3, 6.4_

  - [x] 8.3 Create `app/plugins/error-handler.client.ts`
    - Register `window.onerror` handler that logs `[client:onerror]` with message, source, lineno, colno
    - Register `window.onunhandledrejection` handler that logs `[client:unhandledrejection]` with `event.reason`
    - Return `false` from `onerror` to preserve default browser behavior
    - _Requirements: 6.5_

- [x] 9. Create `server/plugins/env-check.ts`
  - [x] 9.1 Implement startup environment and connectivity validation
    - Check `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are non-empty
    - If any are missing, log the missing names and hook `request` to return HTTP 503 on all `/api/*` routes
    - Warn if `DATABASE_URL` lacks `sslmode=require` or `ssl=true`
    - Attempt `db.execute(sql\`SELECT 1\`)` and log success or failure with sanitized host
    - _Requirements: 1.1, 1.2, 1.4_

- [~] 10. Checkpoint — Phase 2 complete
  - Ensure all tests pass, ask the user if questions arise.

---

### Phase 3 — Enhancements

- [x] 11. Build mobile reader composables
  - [x] 11.1 Create `app/composables/useIsMobile.ts`
    - Use `window.matchMedia('(max-width: 639px)')` with a `change` event listener
    - Initialize `isMobile` to `false` on SSR; set actual value in `onMounted`
    - _Requirements: 11.1, 11.2_

  - [x] 11.2 Create `app/composables/useScrollProgress.ts`
    - Track `scrollPct` (0–100) and `showFloatingNav` (true when `scrollPct > 10`)
    - Attach passive `scroll` listener in `onMounted`, remove in `onUnmounted`
    - _Requirements: 11.3_

  - [x] 11.3 Create `app/composables/useSwipeNav.ts`
    - Accept `onSwipeLeft`, `onSwipeRight` callbacks and a `threshold` (default 60px)
    - Attach passive `touchstart` / `touchend` listeners in `onMounted`, remove in `onUnmounted`
    - _Requirements: 11.4_

- [ ] 12. Enhance `app/pages/read/[chapterId].vue` for mobile
  - [~] 12.1 Integrate swipe navigation and floating nav bar
    - Call `useSwipeNav(goNext, goPrev)` where `goNext`/`goPrev` navigate to `chapterDetails.navigation.next/prev`
    - Call `useScrollProgress()` and render a floating nav bar (prev/next links) that appears when `showFloatingNav` is true
    - _Requirements: 11.3, 11.4_

  - [~] 12.2 Remove dead `isReadingOffline` code
    - Delete the `isReadingOffline` ref, the "Offline" badge in the template, and the `isReadingOffline.value = false` reset in the route watcher
    - _Requirements: 14.5_

  - [~] 12.3 Apply mobile settings panel as bottom sheet
    - Import `useIsMobile` and conditionally apply bottom-sheet CSS classes to the settings panel when `isMobile` is true
    - Wrap the settings panel in `<Teleport to="body">` on mobile
    - _Requirements: 11.2_

- [ ] 13. Community feature reliability
  - [~] 13.1 Add optimistic update pattern to forum reply submission
    - In the forum post detail page (`app/pages/community/post/[id].vue`), implement the optimistic append → revert-on-failure pattern from the design
    - Show a pending visual state on the temp reply entry
    - Display toast error on failure using the existing toast system
    - _Requirements: 12.3_

  - [-] 13.2 Add locked-thread UI guard to forum reply form
    - If the post's `isLocked` field is true, disable the reply textarea and submit button and display a "This thread is locked" notice
    - _Requirements: 12.6_

- [ ] 14. Performance optimizations
  - [-] 14.1 Add explicit dimensions to `<NuxtImg>` in novel card components
    - Set `width="200"` and `height="280"` (matching the CSS aspect ratio) on all novel card cover images
    - Add `loading="lazy"` to below-the-fold images; use `loading="eager"` for hero carousel images
    - _Requirements: 13.1, 13.3_

  - [-] 14.2 Preload hero carousel cover image on the home page
    - In `app/pages/index.vue`, use `useHead(computed(...))` to inject `<link rel="preload" as="image">` for the first featured novel's cover URL
    - _Requirements: 13.2_

  - [ ] 14.3 Use `lazy: true` for secondary data on the novels list page
    - In `app/pages/novels/index.vue`, change the trending sidebar `useFetch` call to use `lazy: true`
    - _Requirements: 13.4_

- [ ] 15. Codebase refactoring
  - [x] 15.1 Ensure consistent schema import paths across all server API handlers
    - Search for any `../../database/schema` relative imports and replace with `@@/server/database/schema`
    - _Requirements: 14.3_

  - [~] 15.2 Add TypeScript return type annotations to store actions and API handlers
    - Add explicit return types to all Pinia store actions in `auth.ts`, `library.ts` that currently lack them
    - Add `Promise<...>` return types to exported `defineEventHandler` functions in the modified API files
    - _Requirements: 14.4_

- [~] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks are sequenced: Phase 1 (critical) → Phase 2 (correctness) → Phase 3 (enhancements). Do not start Phase 2 tasks until Phase 1 is complete.
- The `waitForSupabaseSession` composable in `app/composables/useAuthSession.ts` is deprecated after Phase 1 — keep the file for backward compatibility but add a `@deprecated` JSDoc comment.
- The design document contains exact TypeScript implementations for every new file; use them as the authoritative reference during implementation.
- No new database migrations are required — the schema in `server/database/schema/tables.ts` is unchanged.
- All `createError` calls must include `data: { statusCode }` so the client-side `isAuthError` utility works reliably.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "7.1", "7.3", "9.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.1", "4.1", "6.1", "7.5", "8.1", "8.2", "8.3", "11.1", "11.2", "11.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "4.2", "4.3", "6.2", "7.2", "7.4", "13.2", "14.1", "14.2", "14.3", "15.1"] },
    { "id": 3, "tasks": ["6.3", "6.4", "6.5", "12.1", "12.2", "12.3", "13.1", "15.2"] }
  ]
}
```
