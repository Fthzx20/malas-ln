<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'auth'
})

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const toast = useToast()
const supabase = useSupabaseClient()
const authStore = useAuthStore()
const route = useRoute()
const goToRegister = () => navigateTo('/auth/register')

const getRedirectTarget = () => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  return redirect.startsWith('/') ? redirect : '/'
}

const handleLogin = async () => {
  if (!email.value || !password.value) {
    toast.warning('Please enter both email and password')
    return
  }

  isLoading.value = true
  try {
    if (!supabase?.auth) {
      toast.error('Supabase client not configured. Set SUPABASE_URL and SUPABASE_KEY in .env')
      return
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (error) {
      toast.error(error.message || 'Invalid login credentials')
      return
    }

    const accessToken = data.session?.access_token
    if (data?.session) {
      await authStore.fetchProfileWithRetry(5, accessToken)

      if (!authStore.profile) {
        throw new Error('Login succeeded, but your account profile could not be loaded.')
      }

      toast.success('Login successful')
      await navigateTo(getRedirectTarget())
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Authentication failed')
  } finally {
    isLoading.value = false
  }
}

useHead({
  title: 'Login',
  meta: [
    { name: 'description', content: 'Sign in to your Malaz Scans account.' }
  ]
})
</script>

<template>
  <div class="w-full space-y-6">
    <div class="border-b border-rule pb-3">
      <h2 class="font-heading text-xl font-bold uppercase tracking-tight text-ink">
        Reader Credentials
      </h2>
      <p class="font-mono text-[10px] text-ink-muted uppercase">
        Login
      </p>
    </div>

    <form @submit.prevent="handleLogin" class="w-full space-y-4">
      <div class="space-y-2">
        <label for="email" class="font-mono text-xs uppercase tracking-wider text-ink-muted block">
          Email Address
        </label>
        <UiInput 
          id="email"
          v-model="email" 
          type="email" 
          placeholder="your.email@domain.com"
          required
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <label for="password" class="font-mono text-xs uppercase tracking-wider text-ink-muted block">
          Secret Password
        </label>
        <UiInput 
          id="password"
          v-model="password" 
          type="password" 
          placeholder="••••••••"
          required
          class="w-full"
        />
      </div>

      <div class="pt-2">
        <UiButton 
          type="submit" 
          variant="primary" 
          :loading="isLoading"
          class="w-full"
        >
          Login
        </UiButton>
      </div>
    </form>

    <div class="border-t border-rule pt-4 text-center font-mono text-[11px] text-ink-muted">
      New to the platform? 
      <button @click="goToRegister" type="button" class="text-accent font-bold hover:underline cursor-pointer bg-transparent border-0 p-0">
        Register
      </button>
    </div>
  </div>
</template>
