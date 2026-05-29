import { defineStore } from 'pinia'
import { getErrorStatusCode, isAuthError } from '~/utils/auth-error'

interface UserProfile {
  id: string
  authId: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  role: 'user' | 'translator' | 'admin'
}

interface AuthState {
  profile: UserProfile | null
  isLoading: boolean
  lastAccessToken: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    profile: null,
    isLoading: false,
    lastAccessToken: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.profile,
    isAdmin: (state) => state.profile?.role === 'admin',
    isTranslator: (state) => state.profile?.role === 'translator' || state.profile?.role === 'admin',
    userRole: (state) => state.profile?.role || 'user',
    displayName: (state) => state.profile?.displayName || 'Guest',
    avatarUrl: (state) => state.profile?.avatarUrl,
  },

  actions: {
    async getAuthHeaders(accessToken?: string): Promise<Record<string, string> | undefined> {
      if (accessToken) {
        this.lastAccessToken = accessToken
        return { Authorization: `Bearer ${accessToken}` }
      }

      if (this.lastAccessToken) {
        return { Authorization: `Bearer ${this.lastAccessToken}` }
      }

      const supabase = useSupabaseClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) this.lastAccessToken = token
      return token ? { Authorization: `Bearer ${token}` } : undefined
    },

    async fetchProfile(accessToken?: string) {
      if (this.isLoading) {
        const deadline = Date.now() + 3000
        while (this.isLoading && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 75))
        }

        if (this.profile) {
          return this.profile
        }
      }

      this.isLoading = true
      try {
        const headers = await this.getAuthHeaders(accessToken)
        // If there is no auth header available, avoid calling the protected endpoint
        if (!headers || Object.keys(headers).length === 0) {
          this.profile = null
          return null
        }

        const data = await $fetch('/api/user/profile', {
          headers,
          credentials: 'include',
        })
        if ((data as any)?.authenticated === false) {
          this.profile = null
          return null
        }
        this.profile = data as UserProfile
        return this.profile
      } catch (error) {
        if (isAuthError(error)) {
          this.profile = null
          return null
        }

        throw error
      } finally {
        this.isLoading = false
      }
    },

    async fetchProfileWithRetry(attempts = 3, accessToken?: string): Promise<UserProfile | null> {
      let lastError: unknown = null
      for (let i = 0; i < attempts; i++) {
        try {
          return await this.fetchProfile(accessToken)
        } catch (error) {
          lastError = error
          if (i < attempts - 1) await new Promise(r => setTimeout(r, 150))
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Unable to load your profile')
    },

    async updateProfile(updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'avatarUrl'>>, accessToken?: string) {
      const data = await $fetch('/api/user/profile', {
        method: 'PUT',
        body: updates,
        headers: await this.getAuthHeaders(accessToken),
        credentials: 'include',
      })
      this.profile = data as UserProfile
      return this.profile
    },

    async signOut() {
      const supabase = useSupabaseClient()

      try {
        await supabase?.auth?.signOut()
      } finally {
        this.clearProfile()
        this.lastAccessToken = null
      }
    },

    clearProfile() {
      this.profile = null
      this.isLoading = false
    },
  },
})
