<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { clientLogger } from '~/utils/client-logger'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

const message = ref('')
const isActive = ref(false)
const isLoading = ref(true)
const isSaving = ref(false)
const savedAt = ref<string | null>(null)
const isPreviewOpen = ref(false)
let previewTimer: ReturnType<typeof setTimeout> | null = null

const { success: toastSuccess, error: toastError } = useToast()

const noticeActionLabel = computed(() => {
  return message.value.trim().length > 0 ? 'Update Notice' : 'Create Notice'
})

const previewMessage = computed(() => {
  return message.value.trim() || 'This is a preview of your notice popup.'
})

const closePreview = () => {
  isPreviewOpen.value = false
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
}

const openPreview = () => {
  closePreview()
  isPreviewOpen.value = true
  previewTimer = setTimeout(() => {
    closePreview()
  }, 10000)
}

const loadNotice = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<{ notice: { message: string; isActive: boolean; updatedAt?: string } | null }>('/api/admin/notices', {
      credentials: 'include',
    })
    message.value = data.notice?.message || ''
    isActive.value = Boolean(data.notice?.isActive)
    savedAt.value = data.notice?.updatedAt || null
  } catch (error) {
    clientLogger.error('Failed loading admin notice', error)
    toastError('Failed to load notice settings')
  } finally {
    isLoading.value = false
  }
}

const saveNotice = async () => {
  isSaving.value = true
  try {
    const data = await $fetch<{ notice: { updatedAt: string } }>('/api/admin/notices', {
      method: 'PUT',
      credentials: 'include',
      body: {
        message: message.value,
        isActive: isActive.value,
      },
    })
    savedAt.value = data.notice.updatedAt
    toastSuccess('Homepage notice updated')
  } catch (error) {
    clientLogger.error('Failed saving admin notice', error)
    toastError('Failed to save notice')
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  void loadNotice()
})

onUnmounted(() => {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
})
</script>

<template>
  <div class="space-y-8 font-ui">
    <section class="border-b-4 border-ink pb-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-muted">Admin notice</p>
          <h2 class="font-heading text-3xl font-black uppercase tracking-tight sm:text-4xl">Homepage Notice</h2>
        </div>
        <div class="flex items-center gap-2">
          <UiButton
            variant="accent"
            @click="openPreview"
          >
            Preview Popup
          </UiButton>
          <UiButton
            variant="primary"
            :loading="isSaving"
            :disabled="isSaving"
            @click="saveNotice"
          >
            {{ noticeActionLabel }}
          </UiButton>
        </div>
      </div>
    </section>

    <section class="border border-ink bg-surface p-5 sm:p-6 space-y-5">
      <div v-if="isLoading" class="space-y-3">
        <UiSkeleton class="h-10 w-full" />
        <UiSkeleton class="h-28 w-full" />
      </div>

      <form v-else class="space-y-5" @submit.prevent="saveNotice">
        <label class="block space-y-2">
          <span class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted">Message</span>
          <UiTextarea
            v-model="message"
            :rows="5"
            placeholder="Type the homepage notice"
          />
          <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            {{ message.length }}/1000 chars
          </p>
        </label>

        <label class="inline-flex items-center gap-3">
          <input v-model="isActive" type="checkbox" class="h-4 w-4 accent-accent" />
          <span class="font-body text-sm text-ink">Enable this notice on homepage</span>
        </label>

        <div class="flex flex-wrap items-center gap-3">
          <UiButton type="button" variant="accent" @click="openPreview">
            Preview Popup
          </UiButton>
          <UiButton type="submit" variant="primary" :disabled="isSaving" :loading="isSaving">
            {{ noticeActionLabel }}
          </UiButton>
          <span v-if="savedAt" class="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Last updated {{ new Date(savedAt).toLocaleString() }}
          </span>
        </div>
      </form>
    </section>

    <Teleport to="body">
      <Transition name="preview-fade">
        <div
          v-if="isPreviewOpen"
          class="fixed inset-0 z-60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Notice preview popup"
        >
          <div class="absolute inset-0 bg-ink/45" @click="closePreview" />

          <div class="notice-preview-panel relative z-10 border border-ink bg-paper shadow-xl">
            <header class="flex items-center justify-between border-b border-rule px-5 py-4">
              <h3 class="font-heading text-lg font-black uppercase tracking-tight">Notice Preview</h3>
              <button
                type="button"
                class="h-9 w-9 border border-rule bg-surface text-ink hover:border-ink hover:bg-paper"
                aria-label="Close preview"
                @click="closePreview"
              >
                ×
              </button>
            </header>

            <div class="max-h-[55vh] overflow-y-auto px-5 py-5">
              <p class="font-body text-sm leading-relaxed text-ink-light whitespace-pre-line wrap-break-word">
                {{ previewMessage }}
              </p>
            </div>

            <footer class="flex justify-end border-t border-rule bg-surface-raised px-5 py-4">
              <UiButton type="button" variant="primary" @click="closePreview">
                Exit
              </UiButton>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.18s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}

.notice-preview-panel {
  width: min(92vw, 44rem);
  min-width: 19rem;
}

@media (max-width: 480px) {
  .notice-preview-panel {
    width: calc(100vw - 1rem);
    min-width: 0;
  }
}
</style>
