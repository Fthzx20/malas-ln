import { useAuthStore } from '~/stores/auth'
import { clientLogger } from '~/utils/client-logger'

export default defineNuxtPlugin(async (nuxtApp) => {
  if (!import.meta.client) return

  const supabase = useSupabaseClient()
  const authStore = useAuthStore()

  // Resolve once the initial session state is known
  let resolveAuthReady!: () => void
  const authReady = new Promise<void>((resolve) => { resolveAuthReady = resolve })
  let authReadyResolved = false
  let unsubscribed = false

  const markAuthReady = () => {
    if (authReadyResolved) return
    authReadyResolved = true
    resolveAuthReady()
  }

  try {
    const authListener = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session?.user && !authStore.isLoading) {
              if (authStore.profile?.authId !== session.user.id) {
                await authStore.fetchProfile(session.access_token).catch(() => authStore.clearProfile())
              }
            } else if (!session) {
              authStore.clearProfile()
            }
            markAuthReady()
          } else if (event === 'SIGNED_OUT') {
            authStore.clearProfile()
            // Clear persisted auth-adjacent state
            try { localStorage.removeItem('pinia-library') } catch {}
            markAuthReady()
          } else if (event === 'TOKEN_REFRESHED') {
            // Session refreshed - no profile re-fetch needed
            markAuthReady()
          } else if (event === 'USER_UPDATED') {
            await authStore.fetchProfile(session?.access_token).catch(() => authStore.clearProfile())
            markAuthReady()
          }
        } catch (e) {
          // swallow plugin errors - auth flows should not crash the app
          clientLogger.warn('[supabase-auth] listener error', e)
          markAuthReady()
        }
      }
    )
    const subscription = authListener.data.subscription

    nuxtApp.provide('authReady', authReady)

    // Ensure subscription cleanup to avoid leaks. Use a page unload hook
    // and attempt graceful unsubscribe once.
    const cleanup = () => {
      if (unsubscribed) return
      try { subscription?.unsubscribe?.() } catch {}
      unsubscribed = true
    }

    window.addEventListener('beforeunload', cleanup, { once: true })
    window.addEventListener('pagehide', cleanup, { once: true })
  } catch (e) {
    clientLogger.warn('[supabase-auth] failed to register listener', e)
    // still provide a resolved authReady so consumers don't hang
    markAuthReady()
    nuxtApp.provide('authReady', Promise.resolve())
  }
})
