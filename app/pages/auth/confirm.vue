<script setup lang="ts">
import { onMounted } from 'vue'

definePageMeta({
  layout: 'auth',
})

const supabaseUser = useSupabaseUser()

onMounted(() => {
  void (async () => {
    const { $authReady } = useNuxtApp()
    await $authReady
    const sessionUser = supabaseUser.value
    if (sessionUser) {
      await navigateTo('/')
      return
    }

    await navigateTo('/auth/login')
  })()
})

useHead({
  title: 'Confirm Email',
  meta: [
    { name: 'description', content: 'Confirm your Rano LN account email address.' },
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
        If your email confirmation is complete, you will be sent into the newsroom automatically.
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