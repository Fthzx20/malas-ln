<template>
  <span
    :class="[
      'inline-flex items-center rounded-none font-mono text-xs font-medium tracking-wider uppercase leading-none whitespace-nowrap',
      sizeClasses,
      variantClasses,
    ]"
    role="status"
  >
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'info'
type BadgeSize = 'sm' | 'md'

interface Props {
  variant?: BadgeVariant
  size?: BadgeSize
  text?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
})

const variantClasses = computed(() => {
  const map: Record<BadgeVariant, string> = {
    default: 'bg-surface-sunken text-ink-light border border-rule',
    accent: 'bg-accent text-white border border-accent',
    success: 'bg-success text-white border border-success',
    warning: 'bg-warning text-white border border-warning',
    info: 'bg-info text-white border border-info',
  }
  return map[props.variant]
})

const sizeClasses = computed(() => {
  const map: Record<BadgeSize, string> = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  }
  return map[props.size]
})
</script>
