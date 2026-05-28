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
    }, 5000)
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
  <UiModal
    v-model:open="isOpen"
    title="Notice"
    size="md"
    :closable="false"
    :close-on-backdrop="false"
    aria-label="Homepage notice"
  >
    <p class="font-body text-sm leading-relaxed text-ink-light whitespace-pre-line">
      {{ notice?.message }}
    </p>

    <template #footer>
      <div class="flex justify-end">
        <UiButton type="button" variant="secondary" @click="closeNow">
          Exit
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>
