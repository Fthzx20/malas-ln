import { useAuthStore } from '~/stores/auth'
import { isAuthError } from '~/utils/auth-error'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.client) {
    const nuxtApp = useNuxtApp()
    try {
      if (nuxtApp?.$authReady) {
        await nuxtApp.$authReady
      }
    } catch (err) {
      // If auth readiness fails, continue — middleware will handle missing session below
      // Avoid blocking navigation on unexpected plugin errors
    }
  }

  const authStore = useAuthStore()
  const supabaseUser = useSupabaseUser()
  const supabase = useSupabaseClient()
  const protectedRoute = /^\/(profile|admin)(\/|$)/.test(to.path)
  const authRoute = /^\/auth\/(login|register|confirm)(\/|$)/.test(to.path)

  const activeUser = supabaseUser?.value
  let accessToken: string | undefined

  if (activeUser) {
    if (!authStore.profile || authStore.profile.authId !== activeUser.id) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        accessToken = session?.access_token
        await authStore.fetchProfile(accessToken)
      } catch (error) {
        // If it's a known auth error, clear the profile
        authStore.clearProfile()
        
        // CRITICAL FIX: If profile doesn't exist but Supabase thinks we are logged in,
        // it means the DB profile was deleted or out of sync. 
        // We MUST force sign out from Supabase so the user isn't trapped in a limbo state.
        if (import.meta.client) {
           await supabase.auth.signOut()
        }
        
        if (protectedRoute) {
          return navigateTo({ path: '/auth/login', query: { redirect: to.fullPath } })
        }
      }
    }
  }

  if (authRoute && activeUser && authStore.profile) {
    return navigateTo('/')
  }

  if (!protectedRoute) {
    return
  }

  if (!activeUser || !authStore.profile) {
    return navigateTo({ path: '/auth/login', query: { redirect: to.fullPath } })
  }

})