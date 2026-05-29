<script setup lang="ts">
</script>

<template>
  <main class="flex-1 min-h-screen bg-paper">
    <div class="container-curated py-6">
      <div class="mb-4">
        <slot name="header" />
      </div>
      <div>
        <slot />
      </div>
    </div>
  </main>
</template>

<style scoped></style>
