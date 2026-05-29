<script setup lang="ts">
</script>

<template>
  <header class="border-b border-rule bg-paper sticky top-0 z-40">
    <div class="container-curated flex items-center justify-between gap-4 py-3">
      <NuxtLink to="/" class="group inline-block">
        <h1 class="font-heading text-2xl font-black tracking-tight leading-none">MALAZ<span class="text-accent">LN</span></h1>
        <p class="font-mono text-[10px] text-ink-muted uppercase mt-0.5">Light Novel Platform</p>
      </NuxtLink>

      <div class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped></style>
