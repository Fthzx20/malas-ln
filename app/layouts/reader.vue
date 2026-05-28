<script setup lang="ts">
import { useReaderStore } from '~/stores/reader'

const readerStore = useReaderStore()
</script>

<template>
  <ClientOnly>
    <div
      class="min-h-screen"
      :data-theme="readerStore.theme"
      :style="{
        ...readerStore.cssVars,
        backgroundColor: 'var(--reader-bg)',
        color: 'var(--reader-text)',
      }"
    >
      <slot />
    </div>
    <template #fallback>
      <!-- SSR fallback: default theme values to prevent hydration mismatch -->
      <div
        class="min-h-screen"
        data-theme="day"
        style="--reader-font-size: 18px; --reader-line-height: 1.75; --reader-font-family: 'Lora', Georgia, serif; --reader-max-width: 720px; background-color: var(--reader-bg); color: var(--reader-text);"
      >
        <slot />
      </div>
    </template>
  </ClientOnly>
</template>
