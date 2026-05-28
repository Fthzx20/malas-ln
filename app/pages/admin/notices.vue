<script setup lang="ts">
import { ref } from 'vue'
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

const { toastSuccess, toastError } = useToast()

const loadNotice = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<{ notice: { message: string; isActive: boolean; updatedAt?: string } | null }>('/api/admin/notices')
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

await loadNotice()
</script>

<template>
  <div class="space-y-8 font-ui">
    <section class="border-b-4 border-ink pb-5">
      <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-muted">Admin notice</p>
      <h2 class="font-heading text-3xl font-black uppercase tracking-tight sm:text-4xl">Homepage Popup Notice</h2>
      <p class="max-w-2xl font-body text-sm text-ink-light sm:text-base">
        Customize the homepage popup text and control whether it is active. Active notices auto-close after 5 seconds, and readers can close immediately with Exit.
      </p>
    </section>

    <section class="border border-ink bg-surface p-5 sm:p-6 space-y-5">
      <div v-if="isLoading" class="space-y-3">
        <UiSkeleton class="h-10 w-full" />
        <UiSkeleton class="h-28 w-full" />
      </div>

      <form v-else class="space-y-5" @submit.prevent="saveNotice">
        <label class="block space-y-2">
          <span class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted">Notice text</span>
          <UiTextarea
            v-model="message"
            :rows="5"
            placeholder="Type the popup notice for homepage readers"
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
          <UiButton type="submit" :disabled="isSaving">
            {{ isSaving ? 'Saving…' : 'Save Notice' }}
          </UiButton>
          <span v-if="savedAt" class="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Last updated {{ new Date(savedAt).toLocaleString() }}
          </span>
        </div>
      </form>
    </section>
  </div>
</template>
