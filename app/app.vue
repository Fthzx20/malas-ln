<script setup lang="ts">
import { useToastProvider } from '~/composables/useToast'

// Initialize the toast provider at the application root
useToastProvider()

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} — Malaz Scans` : 'Malaz Scans'
  },
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  
  <ClientOnly>
    <HomepageNotice />
  </ClientOnly>
  
  <!-- Global notification portal (client-only) -->
  <ClientOnly>
    <UiToast />
  </ClientOnly>
</template>
