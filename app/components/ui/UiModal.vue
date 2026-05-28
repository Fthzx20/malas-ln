<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="open"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel"
          @keydown.escape="close"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-ink/40 ui-modal-backdrop"
            aria-hidden="true"
            @click="closeOnBackdrop && close()"
          />

          <!-- Dialog panel -->
          <div
            ref="panelRef"
            :class="[
              'relative z-10 w-full bg-surface border border-rule rounded-none shadow-lg flex flex-col overflow-hidden',
              sizeClasses,
            ]"
            tabindex="-1"
            @click.stop
          >
            <!-- Header -->
            <header
              v-if="$slots.title || title || closable"
              class="flex items-center justify-between px-5 py-4 border-b border-rule"
            >
              <h2 class="font-heading text-lg font-bold text-ink leading-tight">
                <slot name="title">{{ title }}</slot>
              </h2>
              <button
                v-if="closable"
                type="button"
                class="touch-target flex items-center justify-center text-ink-muted hover:text-ink transition-colors min-w-11 min-h-11 -mr-2"
                aria-label="Close dialog"
                @click="close"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto px-5 py-5">
              <slot />
            </div>

            <!-- Footer -->
            <footer
              v-if="$slots.footer"
              class="px-5 py-4 border-t border-rule bg-surface-raised"
            >
              <slot name="footer" />
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface Props {
  open?: boolean
  title?: string
  ariaLabel?: string
  size?: ModalSize
  closable?: boolean
  closeOnBackdrop?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  size: 'md',
  closable: true,
  closeOnBackdrop: true,
  ariaLabel: 'Dialog',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const panelRef = ref<HTMLElement | null>(null)
let _prevBodyOverflow: string | null = null

const sizeClasses = computed(() => {
  const map: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
  }
  return map[props.size]
})

function close() {
  emit('update:open', false)
}

// Focus panel when opened
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
        await nextTick()
        panelRef.value?.focus()
        // preserve previous overflow and set hidden
        try {
          _prevBodyOverflow = document.body.style.overflow || null
          document.body.style.overflow = 'hidden'
        } catch (e) {
          _prevBodyOverflow = null
        }
      } else {
        // restore previous overflow value if we changed it
        try {
          if (_prevBodyOverflow !== null) document.body.style.overflow = _prevBodyOverflow
          else document.body.style.overflow = ''
        } catch (e) {
          document.body.style.overflow = ''
        }
        _prevBodyOverflow = null
      }
  },
)
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-normal) var(--ease-smooth);
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform var(--duration-normal) var(--ease-smooth),
    opacity var(--duration-normal) var(--ease-smooth);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(16px) scale(0.97);
  opacity: 0;
}

/* Only apply backdrop blur on larger viewports to reduce mobile paint cost */
.ui-modal-backdrop {
  background-color: rgba(0,0,0,0.4);
}

@media (min-width: 640px) {
  .ui-modal-backdrop {
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
}
</style>
