<script setup lang="ts">
const route = useRoute()

const isLoginPage = computed(() => route.path === '/auth/login')
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-paper text-ink px-4 py-8">
    <div class="w-full max-w-md min-w-75 sm:min-w-100">
      <!-- Logo -->
      <div class="text-center mb-8">
        <NuxtLink to="/" class="inline-block">
          <h1 class="font-heading text-4xl font-black tracking-tight">
            RANO<span class="text-accent">LN</span>
          </h1>
          <p class="font-mono text-[10px] tracking-[0.3em] text-ink-muted uppercase mt-1">
            The Literary Newsroom
          </p>
        </NuxtLink>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-6 p-1 border border-rule bg-surface">
        <NuxtLink
          to="/auth/login"
          class="px-4 py-2 text-sm font-ui font-semibold text-center transition-colors"
          :class="isLoginPage ? 'bg-ink text-paper' : 'text-ink hover:bg-ink hover:text-paper'"
        >
          Login
        </NuxtLink>
        <NuxtLink
          to="/auth/register"
          class="px-4 py-2 text-sm font-ui font-semibold text-center transition-colors"
          :class="isLoginPage ? 'text-ink hover:bg-ink hover:text-paper' : 'bg-accent text-white hover:bg-accent-dark'"
        >
          Register
        </NuxtLink>
      </div>

      <!-- Content Card -->
      <div class="w-full border border-rule border-b-4 border-b-ink bg-surface p-6 sm:p-8">
        <slot />
      </div>

      <!-- Back Link -->
      <div class="text-center mt-6">
        <NuxtLink to="/" class="text-sm font-ui text-ink-muted hover:text-accent transition-colors">
          ← Back to Home
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
