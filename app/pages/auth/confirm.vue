<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'auth',
})

const authStore = useAuthStore()
const supabaseUser = useSupabaseUser()

const waitForAuthenticatedProfile = async (timeoutMs = 3000) => {
  if (authStore.isAuthenticated) {
    return true
  }

  return await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      stop()
      resolve(authStore.isAuthenticated)
    }, timeoutMs)

    const stop = watch(() => authStore.isAuthenticated, (isAuthenticated) => {
      if (!isAuthenticated) return
      clearTimeout(timer)
      stop()
      resolve(true)
    })
  })
}

onMounted(() => {
  void (async () => {
    const { $authReady } = useNuxtApp()
    await $authReady
    const sessionUser = supabaseUser.value
    if (sessionUser) {
      const isAuthenticated = await waitForAuthenticatedProfile()
      if (isAuthenticated) {
        await navigateTo('/')
      }
      return
    }

    // Stay on this page when registration is pending email verification.
    // The user can return to login manually from the button below.
  })()
})

useHead({
  title: 'Confirm Email',
  meta: [
    { name: 'description', content: 'Confirm your Malaz Scans account email address.' },
  ],
})
</script>

<template>
  <div class="w-full space-y-6 text-center">
    <div class="border-b border-rule pb-3">
      <h2 class="font-heading text-xl font-bold uppercase tracking-tight text-ink">
        Confirming Account
      </h2>
      <p class="font-mono text-[10px] text-ink-muted uppercase">
        Verification Desk
      </p>
    </div>

    <div class="space-y-3 px-2">
      <p class="font-body text-sm text-ink-light leading-relaxed">
        If your email confirmation is complete, you will be sent into the platform automatically.
      </p>
      <p class="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
        Waiting for authentication state
      </p>
    </div>

    <div class="flex items-center justify-center gap-3 pt-2">
      <UiButton variant="primary" @click="navigateTo('/auth/login')">
        Go To Login
      </UiButton>
    </div>
  </div>
</template>