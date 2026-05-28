<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useToastProvider } from '~/composables/useToast'

// Initialize the toast provider at the application root
useToastProvider()

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} — Rano LN` : 'Rano LN — Light Novel Platform'
  },
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
  ],
})

// Lazy-load the toast component on client only to reduce SSR bundle weight
const AsyncUiToast = defineAsyncComponent(() => import('~/components/ui/UiToast.vue'))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <!-- Global notification portal (client-only, async) -->
  <ClientOnly>
    <Suspense>
      <AsyncUiToast />
    </Suspense>
  </ClientOnly>
</template>
