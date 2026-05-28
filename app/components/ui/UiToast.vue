<template>
  <Teleport to="body">
    <div
      class="fixed top-4 inset-x-4 z-100 flex flex-col gap-2 pointer-events-none sm:inset-auto sm:right-4 sm:left-auto sm:w-auto sm:max-w-sm sm:items-end"
      aria-live="polite"
      aria-label="Notifications"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'w-full sm:w-auto pointer-events-auto flex items-start gap-3 px-4 py-3 border rounded-none shadow-lg bg-surface transition-all duration-[--duration-normal] ease-[--ease-smooth]',
            variantBorderClasses(toast.variant),
          ]"
          role="alert"
          :aria-label="toast.message"
        >
          <!-- Icon -->
          <div :class="['shrink-0 mt-0.5', variantIconColor(toast.variant)]" aria-hidden="true">
            <!-- Success -->
            <svg v-if="toast.variant === 'success'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <!-- Error -->
            <svg v-else-if="toast.variant === 'error'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <!-- Warning -->
            <svg v-else-if="toast.variant === 'warning'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <!-- Info -->
            <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <p v-if="toast.title" class="font-ui text-sm font-semibold text-ink leading-tight">
              {{ toast.title }}
            </p>
            <p class="font-ui text-sm text-ink-light leading-snug" :class="{ 'mt-0.5': toast.title }">
              {{ toast.message }}
            </p>
          </div>

          <!-- Close button -->
          <button
            type="button"
            class="touch-target shrink-0 flex items-center justify-center min-w-11 min-h-11 -m-2 text-ink-muted hover:text-ink transition-colors"
            aria-label="Dismiss notification"
            @click="removeToast(toast.id)"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { inject, type Ref } from 'vue'
import type { ToastItem } from '~/composables/useToast'

const toasts = inject<Ref<ToastItem[]>>('toast-items', ref([]))
const removeToast = inject<(id: string) => void>('toast-remove', () => {})

function variantBorderClasses(variant: ToastItem['variant']): string {
  const map: Record<ToastItem['variant'], string> = {
    success: 'border-success border-l-4',
    error: 'border-danger border-l-4',
    warning: 'border-warning border-l-4',
    info: 'border-info border-l-4',
  }
  return map[variant]
}

function variantIconColor(variant: ToastItem['variant']): string {
  const map: Record<ToastItem['variant'], string> = {
    success: 'text-success',
    error: 'text-danger',
    warning: 'text-warning',
    info: 'text-info',
  }
  return map[variant]
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all var(--duration-normal) var(--ease-smooth);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.toast-move {
  transition: transform var(--duration-normal) var(--ease-smooth);
}
</style>
