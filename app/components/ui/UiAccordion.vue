<template>
  <div class="border border-rule rounded-none">
    <!-- Trigger -->
    <button
      type="button"
      class="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] text-left font-ui text-sm font-medium text-ink bg-surface hover:bg-surface-raised transition-colors duration-[--duration-fast] ease-[--ease-smooth]"
      :aria-expanded="isOpen"
      :aria-controls="panelId || undefined"
      @click="toggle"
    >
      <span class="flex-1">
        <slot name="title">{{ title }}</slot>
      </span>

      <!-- Chevron icon -->
      <svg
        class="w-4 h-4 text-ink-muted shrink-0 transition-transform duration-[--duration-normal] ease-[--ease-smooth]"
        :class="{ 'rotate-180': isOpen }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="square"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <!-- Content panel with grid-based height transition -->
    <div
      :id="panelId || undefined"
      role="region"
      class="grid transition-[grid-template-rows] duration-[--duration-normal] ease-[--ease-smooth]"
      :class="isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div class="overflow-hidden">
        <div class="px-4 py-3 border-t border-rule font-body text-sm text-ink-light leading-relaxed">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  title?: string
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  defaultOpen: false,
})

const isOpen = ref(props.defaultOpen)
const panelId = computed(() => {
  if (props.title) return `ui-accordion-${String(props.title).trim().toLowerCase().replace(/\s+/g, '-')}`
  return undefined
})

function toggle() {
  isOpen.value = !isOpen.value
}

defineExpose({ isOpen, toggle })
</script>
