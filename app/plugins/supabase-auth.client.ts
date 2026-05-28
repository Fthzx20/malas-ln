import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const supabase = useSupabaseClient()
  const authStore = useAuthStore()

  // Ensure we only register a single listener
  let unsub: (() => void) | null = null

  try {
    unsub = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN') {
          // Only fetch profile if not already loading
          if (!authStore.isLoading) {
            await authStore.fetchProfile(session?.access_token).catch(() => {})
          }
          return
        }

        if (event === 'SIGNED_OUT') {
          authStore.clearProfile()
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          // Update stored token but avoid refetching profile
          if (session?.access_token) authStore.lastAccessToken = session.access_token
          return
        }

        if (event === 'USER_UPDATED') {
          // Re-fetch to reflect metadata changes
          if (!authStore.isLoading) {
            await authStore.fetchProfile(session?.access_token).catch(() => {})
          }
        }
      } catch (e) {
        // swallow plugin errors — auth flows should not crash the app
        console.warn('[supabase-auth] listener error', e)
      }
    })
  } catch (e) {
    console.warn('[supabase-auth] failed to register listener', e)
  }

  nuxtApp.hook('app:unmount', () => {
    try { unsub?.() } catch {}
  })
})
// app/plugins/supabase-auth.client.ts
// Single authoritative auth state listener — replaces the waitForSupabaseSession polling pattern.
// Registers supabase.auth.onAuthStateChange exactly once at app startup and exposes
// `$authReady` (a Promise<void>) that resolves when the initial session check completes.

import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(async (nuxtApp) => {
  const supabase = useSupabaseClient()
  const authStore = useAuthStore()

  // Resolve once the initial session state is known
  let resolveAuthReady!: () => void
  const authReady = new Promise<void>((resolve) => { resolveAuthReady = resolve })
  let unsubscribed = false

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user && !authStore.isLoading) {
          if (authStore.profile?.authId !== session.user.id) {
            await authStore.fetchProfile(session.access_token).catch(() => authStore.clearProfile())
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
        await authStore.fetchProfile(session?.access_token).catch(() => authStore.clearProfile())
        resolveAuthReady()
      }
    }
  )

  nuxtApp.provide('authReady', authReady)

  // Ensure subscription cleanup to avoid leaks. Use a page unload hook
  // and attempt graceful unsubscribe once.
  const cleanup = () => {
    if (unsubscribed) return
    try {
      subscription?.unsubscribe?.()
    } catch {}
    unsubscribed = true
  }

  if (import.meta.client) {
    window.addEventListener('beforeunload', cleanup)
    // Also try to cleanup when the app is destroyed (best-effort)
    try {
      nuxtApp.hook && nuxtApp.hook('app:unmounted', cleanup)
    } catch {}
  }
})
