<script setup lang="ts">
const props = defineProps({
  title: { type: String, required: false },
  subtitle: { type: String, required: false },
  meta: { type: String, required: false },
})
</script>

<template>
  <div class="flex items-start justify-between gap-4 py-3">
    <div class="min-w-0">
      <h4 v-if="title" class="truncate font-heading text-lg font-bold">{{ title }}</h4>
      <p v-if="subtitle" class="mt-1 text-sm text-ink-light">{{ subtitle }}</p>
    </div>
    <div class="shrink-0 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted">{{ meta }}</div>
  </div>
</template>

<style scoped></style>
