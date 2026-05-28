<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; statusMessage: string } }>()
const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-8">
    <p class="font-mono text-6xl font-bold text-ink">{{ error.statusCode }}</p>
    <p class="mt-2 text-ink-muted">{{ error.statusMessage || 'Something went wrong' }}</p>
    <button @click="handleError" class="mt-6 underline text-accent">Return home</button>
  </div>
</template>
