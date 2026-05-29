<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'auth'
})

const email = ref('')
const username = ref('')
const displayName = ref('')
const password = ref('')
const isLoading = ref(false)
const toast = useToast()
const supabase = useSupabaseClient()
const goToLogin = () => navigateTo('/auth/login')

const handleRegister = async () => {
  if (!email.value || !password.value || !username.value || !displayName.value) {
    toast.warning('All fields are required')
    return
  }

  if (password.value.length < 8) {
    toast.warning('Password must be at least 8 characters')
    return
  }

  // Username validation - lowercase, alphanumeric
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  if (!usernameRegex.test(username.value)) {
    toast.warning('Username must be 3-20 characters, alphanumeric or underscores only')
    return
  }

  isLoading.value = true
  try {
    if (!supabase?.auth) {
      toast.error('Supabase client not configured. Set SUPABASE_URL and SUPABASE_KEY in .env')
      return
    }
    const emailRedirectTo = import.meta.client
      ? `${window.location.origin}/auth/confirm`
      : undefined

    const { data, error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        emailRedirectTo,
        data: {
          username: username.value.toLowerCase(),
          displayName: displayName.value,
        }
      }
    })

    if (error) {
      toast.error(error.message || 'Invalid registration credentials')
      return
    }

    toast.success('Registration successful! Verification email sent.')
    await navigateTo('/auth/confirm')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Registration failed')
  } finally {
    isLoading.value = false
  }
}

useHead({
  title: 'Register Account',
  meta: [
    { name: 'description', content: 'Register for a Malaz Scans account.' }
  ]
})
</script>

<template>
  <div class="w-full space-y-6">
    <div class="border-b border-rule pb-3">
      <h2 class="font-heading text-xl font-bold uppercase tracking-tight text-ink">
        Create Account
      </h2>
      <p class="font-mono text-[10px] text-ink-muted uppercase">
        Registration
      </p>
    </div>

    <form @submit.prevent="handleRegister" class="w-full space-y-4">
      <div class="space-y-2">
        <label for="displayName" class="font-mono text-xs uppercase tracking-wider text-ink-muted block">
          Display Name (Display Name)
        </label>
        <UiInput 
          id="displayName"
          v-model="displayName" 
          type="text" 
          placeholder="e.g. Aceng Karbu"
          required
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <label for="username" class="font-mono text-xs uppercase tracking-wider text-ink-muted block">
          Unique Username
        </label>
        <UiInput 
          id="username"
          v-model="username" 
          type="text" 
          placeholder="e.g. john_titor99"
          required
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <label for="email" class="font-mono text-xs uppercase tracking-wider text-ink-muted block">
          Official Email Address
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
          placeholder="Min. 8 characters"
          required
          class="w-full"
        />
      </div>

      <div class="pt-2">
        <UiButton 
          type="submit" 
          variant="accent" 
          :loading="isLoading"
          class="w-full text-white"
        >
          Register
        </UiButton>
      </div>
    </form>

    <div class="border-t border-rule pt-4 text-center font-mono text-[11px] text-ink-muted">
      Already have a seat? 
      <button @click="goToLogin" type="button" class="text-accent font-bold hover:underline cursor-pointer bg-transparent border-0 p-0">
        Login
      </button>
    </div>
  </div>
</template>
