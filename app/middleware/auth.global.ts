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
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token

  if (authRoute && activeUser) {
    return navigateTo('/')
  }

  if (!protectedRoute) {
    return
  }

  if (!activeUser) {
    return navigateTo({ path: '/auth/login', query: { redirect: to.fullPath } })
  }

  if (!authStore.profile || authStore.profile.authId !== activeUser.id) {
    try {
      await authStore.fetchProfile(accessToken)
    } catch (error) {
      if (isAuthError(error)) {
        authStore.clearProfile()
        return navigateTo({ path: '/auth/login', query: { redirect: to.fullPath } })
      }

      return
    }
  }

  if (!authStore.profile) {
    return navigateTo({ path: '/auth/login', query: { redirect: to.fullPath } })
  }

})