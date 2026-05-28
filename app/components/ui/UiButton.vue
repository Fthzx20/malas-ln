<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading"
    :aria-busy="loading"
    :class="[baseClasses, variantClasses, sizeClasses, { 'opacity-50 cursor-not-allowed': disabled }]"
    class="touch-target relative inline-flex items-center justify-center font-ui transition-all duration-[--duration-fast] ease-[--ease-smooth] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
  >
    <!-- Loading spinner -->
    <span
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <svg
        class="animate-spin"
        :class="spinnerSizeClasses"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="3"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </span>

    <!-- Button content -->
    <span :class="{ invisible: loading }" class="inline-flex items-center gap-2">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
})

const baseClasses = 'rounded-none border-0 font-medium tracking-wide select-none'

const variantClasses = computed(() => {
  const map: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    ghost: 'btn-ghost',
  }
  return map[props.variant]
})

const sizeClasses = computed(() => {
  const map: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs min-h-[44px]',
    md: 'px-5 py-2.5 text-sm min-h-[44px]',
    lg: 'px-7 py-3.5 text-base min-h-[52px]',
  }
  return map[props.size]
})

const spinnerSizeClasses = computed(() => {
  const map: Record<ButtonSize, string> = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }
  return map[props.size]
})
</script>

<style scoped>
.btn-primary {
  background-color: var(--color-ink);
  color: var(--color-paper);
  border: 1px solid var(--color-ink);
}
.btn-primary:hover {
  background-color: var(--color-ink-light);
}
.btn-primary:active {
  background-color: var(--color-ink-muted);
}

.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-ink);
  border: 1px solid var(--color-ink);
}
.btn-secondary:hover {
  background-color: var(--color-ink);
  color: var(--color-paper);
}
.btn-secondary:active {
  background-color: var(--color-ink-light);
}

.btn-accent {
  background-color: var(--color-accent-dark);
  color: #ffffff;
  border: 1px solid var(--color-accent-dark);
}
.btn-accent:hover {
  background-color: var(--color-accent);
}
.btn-accent:active {
  background-color: var(--color-accent-light);
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-ink);
  border: 0;
}
.btn-ghost:hover {
  background-color: var(--color-surface-sunken);
}
.btn-ghost:active {
  background-color: var(--color-surface);
}
</style>
