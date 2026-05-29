<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { clientLogger } from '~/utils/client-logger'

interface PublicNotice {
  id: string
  message: string
  isActive: boolean
  updatedAt: string
}

const notice = ref<PublicNotice | null>(null)
const isOpen = ref(false)
let dismissTimer: ReturnType<typeof setTimeout> | null = null
const route = useRoute()

const getDismissKey = (current: PublicNotice) => `homepage-notice-dismissed:${current.id}:${current.updatedAt}`

const closeNow = () => {
  if (!notice.value) {
    isOpen.value = false
    return
  }

  try {
    localStorage.setItem(getDismissKey(notice.value), '1')
  } catch (_error) {
  }

  isOpen.value = false

  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

const loadNotice = async () => {
  if (route.path.startsWith('/admin')) {
    return
  }

  try {
    const result = await $fetch<{ notice: PublicNotice | null }>('/api/notices')
    const current = result.notice

    if (!current || !current.isActive || !current.message?.trim()) {
      return
    }

    notice.value = current

    try {
      const alreadyDismissed = localStorage.getItem(getDismissKey(current))
      if (alreadyDismissed) {
        return
      }
    } catch (_error) {
    }

    isOpen.value = true
    dismissTimer = setTimeout(() => {
      closeNow()
    }, 10000)
  } catch (error) {
    clientLogger.warn('Failed to load homepage notice', error)
  }
}

onMounted(() => {
  loadNotice()
})

onUnmounted(() => {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-60 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Homepage notice"
      >
        <div class="absolute inset-0 bg-ink/45" @click="closeNow" />

        <div class="notice-panel relative z-10 border border-ink bg-paper shadow-xl">
          <header class="flex items-center justify-between border-b border-rule px-5 py-4">
            <h3 class="font-heading text-lg font-black uppercase tracking-tight">Notice</h3>
            <button
              type="button"
              class="h-9 w-9 border border-rule bg-surface text-ink hover:border-ink hover:bg-paper"
              aria-label="Close notice"
              @click="closeNow"
            >
              ×
            </button>
          </header>

          <div class="max-h-[55vh] overflow-y-auto px-5 py-5">
            <p class="font-body text-sm leading-relaxed text-ink-light whitespace-pre-line wrap-break-word">
              {{ notice?.message }}
            </p>
          </div>

          <footer class="flex justify-end border-t border-rule bg-surface-raised px-5 py-4">
            <UiButton type="button" variant="primary" @click="closeNow">
              Exit
            </UiButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.notice-panel {
  width: min(92vw, 44rem);
  min-width: 19rem;
}

@media (max-width: 480px) {
  .notice-panel {
    width: calc(100vw - 1rem);
    min-width: 0;
  }
}
</style>
