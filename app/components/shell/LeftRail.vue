<script setup lang="ts">
import { defineEmits, defineProps } from 'vue'
const props = defineProps({ collapsed: { type: Boolean, default: false } })
const emit = defineEmits(['toggle'])
</script>

<template>
  <aside :class="['bg-surface border-r border-rule min-h-[calc(100vh-72px)]', props.collapsed ? 'w-16' : 'w-64']">
    <div class="p-4 h-full flex flex-col">
      <button class="mb-4 nav-icon-btn" @click="$emit('toggle')" aria-label="Toggle sidebar">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="square" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <nav class="flex-1 overflow-y-auto">
        <slot />
      </nav>

      <div class="mt-4">
        <slot name="footer" />
      </div>
    </div>
  </aside>
</template>

<style scoped></style>
