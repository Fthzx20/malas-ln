# Requirements Document

## Introduction

This document specifies the requirements for a comprehensive full-stack stabilization, optimization, and enhancement of the Rano LN light novel platform. The application is built on Nuxt 4, Vue 3, TypeScript, @nuxtjs/supabase, Drizzle ORM with PostgreSQL (Supabase Transaction Pooler), Pinia with pinia-plugin-persistedstate, Tailwind CSS v4, Cloudflare R2, and @vite-pwa/nuxt. The platform is currently in a broken production state with critical failures in authentication, session management, API communication, and hydration. Work is sequenced with critical fixes first, followed by enhancements.

## Glossary

- **App**: The Rano LN Nuxt 4 full-stack web application located at `d:\Desktop\Documents\rano-ln`.
- **AuthStore**: The Pinia store defined in `app/stores/auth.ts` that holds the authenticated user's profile state.
- **GlobalMiddleware**: The `app/middleware/auth.global.ts` route middleware that runs on every navigation.
- **waitForSupabaseSession**: The polling composable in `app/composables/useAuthSession.ts` that polls `supabase.auth.getSession()` up to a configurable timeout.
- **SupabaseClient**: The client-side Supabase JS client provided by `@nuxtjs/supabase` via `useSupabaseClient()`.
- **SupabaseUser**: The reactive ref provided by `useSupabaseUser()` from `@nuxtjs/supabase`.
- **DB**: The Drizzle ORM PostgreSQL database client singleton in `server/utils/db.ts`.
- **ProfileAPI**: The server API endpoint at `/api/user/profile` (GET and PUT).
- **NovelsAPI**: The server API endpoint at `/api/novels` and its sub-routes.
- **SWR**: Stale-While-Revalidate caching strategy applied via Nitro `routeRules` and `defineCachedEventHandler`.
- **LibraryStore**: The Pinia store in `app/stores/library.ts` managing bookmarks and local reading history.
- **ReaderStore**: The Pinia store in `app/stores/reader.ts` managing reader typography preferences.
- **PersistedState**: The `pinia-plugin-persistedstate` plugin that serializes selected store slices to `localStorage`.
- **HydrationMismatch**: A Vue SSR error where server-rendered HTML differs from client-rendered virtual DOM on mount.
- **R2**: Cloudflare R2 object storage used for cover images and uploaded assets.
- **PWA**: Progressive Web App configuration via `@vite-pwa/nuxt`.
- **EnvValidation**: The process of verifying that all required environment variables are present and correctly formatted before the application starts.
- **TransactionPooler**: The Supabase Transaction Pooler connection mode required for serverless/edge environments; requires `prepare: false` in the postgres client.

---

## Requirements

### Requirement 1: Environment and Connectivity Validation

**User Story:** As a developer, I want the application to validate all required environment variables and Supabase connectivity at startup, so that misconfiguration is detected immediately rather than causing silent runtime failures.

#### Acceptance Criteria

1. WHEN the Nitro server starts, THE App SHALL verify that `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are all non-empty strings; IF any variable is missing or empty, THEN THE App SHALL log a descriptive error message identifying the missing variable and refuse to serve API requests until the variable is supplied.
2. WHEN the Nitro server starts, THE DB SHALL attempt a lightweight connectivity check (e.g., `SELECT 1`) against the PostgreSQL Transaction Pooler; IF the check fails, THEN THE App SHALL log the connection error with the sanitized DATABASE_URL host and port, and return HTTP 503 on all `/api/*` routes until connectivity is restored.
3. THE App SHALL provide an `.env.example` file that documents every required and optional environment variable with inline comments describing the expected format and where to obtain each value.
4. WHEN `DATABASE_URL` is present but does not include the `?sslmode=require` parameter or equivalent SSL configuration, THE App SHALL log a warning recommending SSL enforcement for production deployments.

---

### Requirement 2: Authentication Session Race Condition Fix

**User Story:** As a user, I want login and page navigation to reliably reflect my authenticated state without flickering or redirect loops, so that I can access protected pages immediately after signing in.

#### Acceptance Criteria

1. WHEN a user successfully completes `supabase.auth.signInWithPassword`, THE App SHALL wait for `SupabaseUser` reactive ref to become non-null before calling `AuthStore.fetchProfile()`, replacing the current `waitForSupabaseSession` polling approach in the login page with a reactive watcher.
2. WHEN `GlobalMiddleware` runs on a protected route and `SupabaseUser.value` is null on the client, THE GlobalMiddleware SHALL wait for the `@nuxtjs/supabase` module's own session initialization event rather than polling `supabase.auth.getSession()` directly, eliminating the 900 ms polling timeout as the sole session-readiness signal.
3. WHEN `app.vue` initializes on the client, THE App SHALL register a single `supabase.auth.onAuthStateChange` listener via a Nuxt plugin in `app/plugins/`, replacing the duplicated `waitForSupabaseSession` calls in `app.vue` and `auth.global.ts`.
4. WHEN the `onAuthStateChange` listener receives a `SIGNED_IN` event, THE App SHALL call `AuthStore.fetchProfile()` exactly once; IF `AuthStore.isLoading` is already `true`, THEN THE App SHALL skip the duplicate call.
5. WHEN the `onAuthStateChange` listener receives a `SIGNED_OUT` event, THE App SHALL call `AuthStore.clearProfile()` and clear all persisted auth-related state from `localStorage`.
6. IF `AuthStore.fetchProfile()` returns a 401 or 403 error, THEN THE App SHALL call `AuthStore.clearProfile()` and redirect the user to `/auth/login` with the current path as the `redirect` query parameter.

---

### Requirement 3: Profile Auto-Creation Reliability

**User Story:** As a new user who just registered, I want my profile to be created automatically and returned without errors, so that I can start using the platform immediately after sign-up.

#### Acceptance Criteria

1. WHEN `ProfileAPI` (GET `/api/user/profile`) is called and no profile exists for the authenticated `authId`, THE ProfileAPI SHALL create a new profile row using metadata from `user_metadata`; IF the INSERT fails due to a unique constraint violation on `username`, THEN THE ProfileAPI SHALL retry with a randomized suffix up to 5 times before returning HTTP 409.
2. WHEN `ProfileAPI` creates a new profile, THE ProfileAPI SHALL return the created profile object with HTTP 200, not HTTP 201, to maintain consistency with the existing client-side `$fetch` usage that does not check status codes.
3. WHEN `ProfileAPI` is called concurrently by two requests for the same `authId` (race condition on first login), THE ProfileAPI SHALL handle the duplicate INSERT gracefully by catching the unique constraint error on `auth_id` and returning the existing profile row.
4. THE ProfileAPI SHALL validate that `username` derived from `user_metadata` or email prefix contains only alphanumeric characters and underscores, and is between 3 and 20 characters, before attempting the INSERT.

---

### Requirement 4: Pinia Persisted State SSR Hydration Fix

**User Story:** As a user, I want the page to load without Vue hydration mismatch warnings or visual flickers caused by persisted Pinia state, so that the reading experience is smooth from the first render.

#### Acceptance Criteria

1. WHEN `ReaderStore` is initialized during SSR, THE App SHALL use the store's default state values for server rendering and defer applying persisted `localStorage` values until the client `onMounted` lifecycle hook, preventing SSR/CSR HTML mismatches.
2. WHEN `LibraryStore` is initialized during SSR, THE App SHALL not attempt to read `localStorage` on the server; the `localHistory` and `readChapterIds` fields SHALL be empty arrays during SSR and populated only on the client after hydration.
3. WHEN `pinia-plugin-persistedstate` rehydrates a store on the client, THE App SHALL wrap state-dependent UI elements that differ between server and client (e.g., read chapter indicators, reader theme) in `<ClientOnly>` components or use `useNuxtApp().$isHydrating` guards to suppress hydration warnings.
4. THE `LibraryStore` serializer SHALL handle the case where `readChapterIds` is deserialized as a `Set` object (from older persisted data) by converting it to an `Array<string>` before storing, which the existing `normalizeReadChapterIds` function already implements; THE App SHALL ensure this function is called on every deserialization path.

---

### Requirement 5: SWR Cache Invalidation for Mutable API Routes

**User Story:** As an admin or translator, I want novel listings and featured novel data to reflect my latest changes immediately after I publish or update content, so that readers see accurate information.

#### Acceptance Criteria

1. WHEN an admin creates or updates a novel via `POST /api/novels` or `PUT /api/novels/[slug]`, THE NovelsAPI SHALL purge the Nitro SWR cache entries for `/api/novels` and `/api/novels/featured` so that subsequent GET requests return fresh data.
2. WHEN a chapter is published or updated via `POST /api/chapters` or `PUT /api/chapters/[id]`, THE App SHALL purge the SWR cache entry for the parent novel's slug endpoint (`/api/novels/[slug]`) so that the chapter list reflects the change.
3. THE `routeRules` SWR TTL for `/api/novels` and `/api/novels/featured` in `nuxt.config.ts` SHALL be reduced from 3600 seconds to 300 seconds (5 minutes) to limit the maximum staleness window for public-facing novel data.
4. WHEN `defineCachedEventHandler` is used in `server/api/novels/index.get.ts`, THE handler SHALL include a `getKey` function that incorporates all query parameters (`page`, `limit`, `sort`, `genre`, `search`, `author`, `year`, `status`) into the cache key, so that different filter combinations are cached independently and do not serve each other's stale results.

---

### Requirement 6: Global Error Handling and Error Boundaries

**User Story:** As a user, I want unhandled errors to display a friendly message instead of a blank page or console stack trace, so that I can understand what went wrong and navigate back to safety.

#### Acceptance Criteria

1. THE App SHALL implement a `app/error.vue` page that catches Nuxt-level errors and displays a user-friendly error message with the HTTP status code, a brief description, and a link to return to the home page.
2. WHEN a `useFetch` or `$fetch` call in a page component fails with a network or server error, THE page SHALL display an inline error state (not a full-page crash) with a retry button, using the existing `error` ref returned by `useFetch`.
3. WHEN a server API handler throws an unhandled exception (not a `createError` call), THE Nitro server SHALL catch the exception via a global `onError` hook, log the error with a request ID and sanitized stack trace, and return HTTP 500 with a generic `{ statusMessage: 'Internal server error' }` body.
4. WHEN the DB connection fails during an API request, THE App SHALL return HTTP 503 with `{ statusMessage: 'Database temporarily unavailable' }` rather than exposing the raw PostgreSQL error message to the client.
5. THE App SHALL add a `app/plugins/error-handler.client.ts` plugin that registers a `window.onerror` and `window.onunhandledrejection` handler to capture and log client-side errors, preventing silent failures in production.

---

### Requirement 7: Database Connection Resilience

**User Story:** As a platform operator, I want the database connection to recover automatically from transient failures, so that brief network interruptions do not require a server restart.

#### Acceptance Criteria

1. WHEN the DB singleton in `server/utils/db.ts` encounters a connection error on a query, THE DB SHALL not cache the broken client instance; IF `_db` is non-null but the underlying postgres client has terminated, THEN THE DB SHALL reset `_db` to `null` and re-initialize on the next `useDB()` call.
2. THE `postgres` client in `server/utils/db.ts` SHALL be configured with `connect_timeout: 10` (seconds) and `idle_timeout: 20` (seconds) to prevent indefinitely hanging connections on the Supabase Transaction Pooler.
3. WHEN `DATABASE_URL` changes at runtime (e.g., environment variable rotation), THE App SHALL expose a server-side utility function `resetDB()` that sets `_db` to `null`, allowing the next request to re-initialize with the updated URL.
4. THE `postgres` client SHALL retain `prepare: false` as required by the Supabase Transaction Pooler, and `max: 3` to stay within free-tier connection limits.

---

### Requirement 8: API Input Validation and Consistent Error Responses

**User Story:** As a developer integrating with the API, I want all endpoints to validate input and return consistent, structured error responses, so that client-side error handling is predictable.

#### Acceptance Criteria

1. THE App SHALL ensure every server API handler that accepts a request body validates required fields and returns HTTP 400 with `{ statusCode: 400, statusMessage: '<field> is required' }` for missing fields, consistent with the pattern already used in `comments/index.post.ts` and `forum/post.post.ts`.
2. WHEN `bookmarks.get.ts` calls `user.profileId!` with a non-null assertion, THE App SHALL add an explicit guard: IF `user.profileId` is undefined, THEN THE handler SHALL throw `createError({ statusCode: 400, statusMessage: 'User profile not found' })` instead of relying on the non-null assertion operator.
3. WHEN `ratings/index.post.ts` calls `user.profileId!` with a non-null assertion, THE App SHALL apply the same explicit guard as described in criterion 8.2.
4. THE App SHALL ensure all API error responses include a `statusCode` field in the response body (not only in the HTTP status line) so that client-side `isAuthError` helpers can reliably detect 401/403 responses regardless of fetch library behavior.
5. WHEN a forum reply is submitted to `POST /api/forum/reply`, THE handler SHALL validate that the referenced `postId` exists and that the post is not locked (`isLocked: false`) before inserting the reply; IF the post is locked, THEN THE handler SHALL return HTTP 403 with `{ statusMessage: 'This thread is locked' }`.

---

### Requirement 9: Supabase Auth Plugin and Session Listener

**User Story:** As a developer, I want a single, authoritative Supabase auth state listener registered at application startup, so that auth state changes are handled consistently without duplicate fetches or missed events.

#### Acceptance Criteria

1. THE App SHALL create `app/plugins/supabase-auth.client.ts` as a Nuxt client plugin that calls `supabase.auth.onAuthStateChange` once at application startup.
2. WHEN the plugin is registered, THE plugin SHALL use `addRouteMiddleware` or direct store calls to synchronize `AuthStore` state with Supabase auth events (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`).
3. WHEN a `TOKEN_REFRESHED` event is received, THE plugin SHALL update the session without calling `AuthStore.fetchProfile()` again, since the profile data has not changed.
4. WHEN a `USER_UPDATED` event is received, THE plugin SHALL call `AuthStore.fetchProfile()` to refresh the profile in case email or metadata changed.
5. THE `waitForSupabaseSession` composable in `app/composables/useAuthSession.ts` SHALL be deprecated in favor of the plugin-based approach; existing call sites in `app/app.vue`, `app/middleware/auth.global.ts`, `app/pages/auth/login.vue`, and `app/pages/auth/register.vue` SHALL be refactored to remove the polling calls.

---

### Requirement 10: Frontend UI Polish and Accessibility

**User Story:** As a reader, I want the interface to be visually consistent, accessible, and responsive across all screen sizes, so that I can comfortably use the platform on any device.

#### Acceptance Criteria

1. THE App SHALL ensure all interactive elements (buttons, links, form inputs) have a minimum touch target size of 44×44 CSS pixels on mobile viewports, consistent with the existing `.touch-target` utility class already applied in some components.
2. WHEN a form submission fails validation, THE App SHALL display inline error messages adjacent to the invalid field using `aria-describedby` and `role="alert"` attributes so that screen readers announce the error.
3. THE App SHALL ensure the navigation header remains accessible at all zoom levels up to 200% without horizontal overflow or overlapping elements.
4. WHEN the mobile menu is open, THE App SHALL trap focus within the menu overlay and restore focus to the menu toggle button when the menu is closed.
5. THE App SHALL ensure all `<NuxtImg>` and `<img>` elements have non-empty `alt` attributes; decorative images SHALL use `alt=""` and `aria-hidden="true"`.
6. THE App SHALL ensure color contrast ratios for body text meet WCAG 2.1 AA standards (minimum 4.5:1 for normal text, 3:1 for large text) across all four reader themes (day, night, sepia, editorial).

---

### Requirement 11: Mobile Reading Experience

**User Story:** As a mobile reader, I want the chapter reader to be optimized for small screens with comfortable typography and easy navigation, so that I can read without zooming or horizontal scrolling.

#### Acceptance Criteria

1. WHEN the reader page is viewed on a viewport narrower than 640px, THE App SHALL apply a minimum font size of 16px to prevent iOS Safari from auto-zooming on text input focus within the reader settings panel.
2. WHEN the reader settings panel is open on mobile, THE App SHALL display the panel as a bottom sheet overlay rather than an inline dropdown, so that it does not push the chapter content out of view.
3. THE reader navigation bar (previous/next chapter links) SHALL be visible and tappable without scrolling to the bottom of the chapter on mobile; THE App SHALL add a floating navigation bar that appears after the user scrolls past 10% of the chapter.
4. WHEN a user swipes horizontally on the chapter content area on a touch device, THE App SHALL navigate to the previous chapter (swipe right) or next chapter (swipe left) if navigation links are available.
5. THE App SHALL ensure the scroll progress bar in the reader header is at least 4px tall on mobile for visibility.

---

### Requirement 12: Community Feature Reliability

**User Story:** As a community member, I want to post forum threads, submit comments, and report content without encountering silent failures or inconsistent UI states, so that my contributions are reliably saved.

#### Acceptance Criteria

1. WHEN a user submits a comment via the chapter comment form, THE App SHALL display a loading indicator on the submit button and disable the form during submission; IF the submission fails, THE App SHALL display the error message from the API response using the toast system.
2. WHEN a forum post is successfully created, THE App SHALL redirect the user to the new post's detail page (`/community/post/[id]`) and display a success toast notification.
3. WHEN a forum reply is successfully submitted, THE App SHALL optimistically append the reply to the local reply list and revert the optimistic update IF the API call fails.
4. WHEN a user submits a report via `POST /api/reports`, THE App SHALL validate that `targetType`, `targetId`, and `reason` are all present before sending the request; IF validation fails, THE App SHALL display an inline error without making the API call.
5. WHEN the forum category page (`/community/[category]`) loads, THE App SHALL display a paginated list of posts with at least the post title, author display name, reply count, and creation date visible without requiring additional API calls.
6. IF a user attempts to post in a locked thread, THE App SHALL disable the reply form and display a "This thread is locked" notice before the user submits, preventing a round-trip API error.

---

### Requirement 13: Performance Optimization

**User Story:** As a reader, I want pages to load quickly and images to display without layout shift, so that I can start reading without waiting.

#### Acceptance Criteria

1. THE App SHALL configure `@nuxt/image` with explicit `width` and `height` attributes on all `<NuxtImg>` components used in novel card grids and the hero carousel to prevent Cumulative Layout Shift (CLS).
2. WHEN the home page hero carousel loads, THE App SHALL preload the first featured novel's cover image using a `<link rel="preload">` tag injected via `useHead`, so that the largest contentful paint element loads without delay.
3. THE App SHALL add `loading="lazy"` to all `<NuxtImg>` components that are below the fold (novel cards in the "Latest Dispatches" grid, volume covers, chapter list thumbnails).
4. WHEN the novels list page (`/novels`) is rendered, THE App SHALL use `useFetch` with `lazy: true` for secondary data (trending sidebar) so that the primary novel grid is not blocked by parallel requests.
5. THE `defineCachedEventHandler` in `server/api/novels/index.get.ts` SHALL set `staleMaxAge: 60` in addition to `maxAge: 300` so that stale responses are served immediately while revalidation happens in the background, reducing perceived latency.

---

### Requirement 14: Codebase Refactoring and Maintainability

**User Story:** As a developer, I want the codebase to follow consistent patterns with no duplicated logic, so that future changes can be made confidently without introducing regressions.

#### Acceptance Criteria

1. THE App SHALL extract the `isAuthError` helper function (currently duplicated in `app/app.vue`, `app/middleware/auth.global.ts`, and `app/stores/auth.ts`) into a single shared utility at `app/utils/auth-error.ts` and replace all three inline definitions with imports.
2. THE App SHALL extract the `fetchProfileWithRetry` function (currently duplicated in `app/pages/auth/login.vue` and `app/pages/auth/register.vue`) into `AuthStore` as a store action, and replace both page-level implementations with a single `authStore.fetchProfileWithRetry()` call.
3. THE App SHALL ensure all server API handlers import schema tables from `@@/server/database/schema` (the alias already in use) consistently, with no direct relative path imports (`../../database/schema`).
4. THE App SHALL add TypeScript return type annotations to all exported server API handler functions and all Pinia store actions that currently lack them, reducing implicit `any` usage.
5. THE App SHALL remove the `isReadingOffline` ref and all associated offline-reading code from `app/pages/read/[chapterId].vue` since the offline download feature was removed; dead code references to this variable SHALL be cleaned up.
6. THE App SHALL ensure `app/plugins/` contains at minimum the `supabase-auth.client.ts` plugin (from Requirement 9) and that the directory is no longer empty, resolving the identified gap where no global Supabase session listener existed.
