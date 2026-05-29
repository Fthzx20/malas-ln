<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { clientLogger } from '~/utils/client-logger'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'
import { useReaderStore } from '~/stores/reader'
import TiptapEditor from '~/components/editor/TiptapEditor.client.vue'

definePageMeta({
  layout: 'admin'
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const readerStore = useReaderStore()
const authStore = useAuthStore()

// read query values directly from `route.query` inside functions so
// the component reacts when the query changes without relying on
// one-time copied values.
const isEditing = computed(() => !!(route.query && route.query.chapterId))
const showPreview = ref(true)

// Form fields
const form = ref({
  title: '',
  chapterNumber: '1',
  content: '',
  translatorGroup: '',
  isPublished: false,
  publishAt: '',
  novelId: ''
})

const isLoading = ref(false)
const isSaving = ref(false)
const isClient = ref(false)

const storageKey = computed(() => {
  const qChapter = route.query.chapterId as string
  return qChapter ? `manuscript-draft:${qChapter}` : 'manuscript-draft:new'
})

// Load existing chapter details if in editing mode
const loadChapterDetails = async () => {
  const id = route.query.chapterId as string
  if (!id) return
  isLoading.value = true
  try {
    const payload = await $fetch<any>(`/api/chapters/${id}`, {
      headers: await authStore.getAuthHeaders(),
    })
    if (payload?.chapter) {
      form.value = {
        title: payload.chapter.title,
        chapterNumber: String(payload.chapter.chapterNumber),
        content: payload.chapter.content,
        translatorGroup: payload.chapter.translatorGroup || '',
        isPublished: payload.chapter.isPublished,
        publishAt: payload.chapter.publishAt ? new Date(payload.chapter.publishAt).toISOString().slice(0, 16) : '',
        novelId: payload.chapter.novelId
      }
    }
  } catch (err) {
    clientLogger.error('[editor] loadChapterDetails error', err)
    toast.error('Failed to load manuscript details')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  const qChapter = route.query.chapterId as string
  const qNovel = route.query.novelId as string
  if (!qChapter) {
    const redirect = qNovel ? `/admin/chapters/new?novelId=${qNovel}` : '/admin/chapters/new'
    navigateTo(redirect)
    return
  }
  isClient.value = true
  if (qChapter) loadChapterDetails()
})

watch(() => route.query.chapterId, (val) => {
  if (val) {
    isClient.value = true
    loadChapterDetails()
  }
})

const previewHtml = computed(() => {
  return form.value.content || ''
})

const previewSurfaceStyle = computed(() => ({
  backgroundColor: 'var(--reader-surface, var(--color-paper))',
  color: 'var(--reader-text, var(--color-ink))',
  '--reader-rule': 'var(--color-rule)',
  '--reader-selection': 'var(--color-accent)',
}))

const previewBodyStyle = computed(() => ({
  fontFamily: readerStore.cssVars['--reader-font-family'],
  fontSize: readerStore.cssVars['--reader-font-size'],
  lineHeight: readerStore.cssVars['--reader-line-height'],
  maxWidth: readerStore.cssVars['--reader-max-width'],
}))

const previewChapterTitle = computed(() => form.value.title || 'Untitled Chapter')
const previewChapterNumber = computed(() => form.value.chapterNumber || '1')

const handleSaveManuscript = async () => {
  if (!route.query.chapterId) {
    toast.warning('Create the chapter shell first')
    return
  }

  if (!form.value.title || form.value.chapterNumber === undefined) {
    toast.warning('Title and Chapter Number are required')
    return
  }

  isSaving.value = true
  try {
    const body = {
      title: form.value.title.trim(),
      chapterNumber: Number(form.value.chapterNumber),
      content: form.value.content,
      translatorGroup: form.value.translatorGroup.trim() || null,
      isPublished: form.value.isPublished,
      publishAt: form.value.publishAt ? new Date(form.value.publishAt).toISOString() : null,
      novelId: form.value.novelId
    }

    const cid = route.query.chapterId as string
    const authStore = useAuthStore()
    await $fetch(`/api/chapters/${cid}`, {
      method: 'PUT',
      body,
      headers: await authStore.getAuthHeaders(),
    })
    toast.success('Manuscript updated successfully!')
  } catch (err) {
    toast.error('Failed to commit manuscript')
  } finally {
    isSaving.value = false
  }
}

// Autosave draft to localStorage (debounced)
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
watch(() => form.value.content, (val) => {
  if (!import.meta.client) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    try {
      const key = (route.query.chapterId as string) ? `manuscript-draft:${route.query.chapterId}` : `manuscript-draft:novel:${form.value.novelId || 'new'}`
      localStorage.setItem(key, val || '')
    } catch (e) {
      // ignore storage failures
    }
  }, 1500)
})

// Restore draft if present
if (import.meta.client) {
  try {
    const key = (route.query.chapterId as string) ? `manuscript-draft:${route.query.chapterId}` : `manuscript-draft:novel:${form.value.novelId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved && !form.value.content) {
      form.value.content = saved
    }
  } catch {}
}

useHead({
  title: isEditing.value ? 'Edit Manuscript' : 'Chapter Editor'
})
</script>

<template>
  <div class="min-h-[calc(100vh-120px)] font-ui flex flex-col bg-surface text-ink">
    <div class="sticky top-0 z-30 border-b border-rule bg-surface/95 backdrop-blur supports-backdrop-filter:bg-surface/85">
      <div class="flex flex-col gap-3 px-4 py-4 sm:px-6">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0 space-y-1">
            <NuxtLink to="/admin/chapters" class="font-mono text-[10px] uppercase font-bold tracking-wider text-ink-muted hover:text-accent block">&larr; Chapters Directory</NuxtLink>
            <h2 class="font-heading text-2xl sm:text-3xl font-black tracking-tight truncate">
              {{ isEditing ? 'Manuscript Editor' : 'Chapter Editor' }}
            </h2>
            <p class="text-sm text-ink-muted">
              {{ previewChapterTitle }}<span class="mx-2">·</span>Chapter {{ previewChapterNumber }}<span class="mx-2">·</span>{{ isSaving ? 'Saving changes' : 'Draft ready' }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UiButton @click="showPreview = !showPreview" variant="secondary">
              {{ showPreview ? 'Hide Preview' : 'Show Preview' }}
            </UiButton>
            <UiButton @click="handleSaveManuscript" variant="primary" :loading="isSaving">
              Save Chapter
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 p-4 sm:p-6">
      <div v-if="isLoading" class="flex h-full items-center justify-center">
        <div class="text-center space-y-2">
          <UiSkeleton class="h-6 w-48 mx-auto" />
          <UiSkeleton class="h-40 w-full max-w-5xl mx-auto" />
        </div>
      </div>

      <div v-else class="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section class="flex min-h-0 flex-col bg-transparent">
          <div class="grid grid-cols-1 gap-3 rounded-none border-b border-rule bg-surface-raised px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_120px_170px_170px]">
            <div class="space-y-1">
              <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Chapter Title</label>
              <UiInput v-model="form.title" placeholder="Untitled chapter" required class="w-full" />
            </div>
            <div class="space-y-1">
              <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">No.</label>
              <UiInput v-model="form.chapterNumber" type="text" required class="w-full" />
            </div>
            <div class="space-y-1">
              <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Group</label>
              <UiInput v-model="form.translatorGroup" placeholder="Optional" class="w-full" />
            </div>
            <div class="space-y-1">
              <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Release Time</label>
              <UiInput v-model="form.publishAt" type="datetime-local" placeholder="Optional" class="w-full" />
            </div>
          </div>

          <div class="flex items-center justify-between gap-4 border-b border-rule px-4 py-4 sm:px-5">
            <div class="min-w-0">
              <p class="font-heading text-base font-bold text-ink">Publish instantly</p>
              <p class="text-sm text-ink-muted">Turn this on only when the chapter is ready for readers.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" v-model="form.isPublished" class="h-5 w-5 cursor-pointer rounded-none border-ink text-accent focus:ring-accent" />
            </label>
          </div>

          <div class="min-h-0 flex-1 overflow-hidden">
            <div class="h-full overflow-y-auto px-0 py-4 sm:py-6">
              <div class="w-full">
                <div class="mb-3 flex items-center justify-between px-4 sm:px-5 text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                  <span>Editor</span>
                  <span>Image upload supported</span>
                </div>
                <div class="min-h-[70vh]">
                  <TiptapEditor v-if="isClient" v-model="form.content" :storageKey="storageKey" />
                  <UiTextarea v-else
                    v-model="form.content"
                    placeholder="# Write your translation manuscript in Markdown...\n\nUse basic formatting like **bold** text, list entries, or *italic annotations*."
                    class="min-h-[70vh] w-full bg-transparent p-0 text-ink"
                    :autoResize="true"
                    :rows="18"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside v-if="showPreview" class="min-h-0 flex flex-col bg-transparent xl:sticky xl:top-24 xl:self-start">
          <div class="border-b border-rule px-0 py-3">
            <p class="font-mono text-[10px] uppercase font-bold tracking-wider text-ink-muted">Preview</p>
            <h3 class="font-heading text-lg font-black uppercase tracking-tight">Reader mirror</h3>
          </div>

          <div class="flex-1 overflow-y-auto pt-4" :style="previewSurfaceStyle">
            <article class="mx-auto w-full" :style="previewBodyStyle">
              <header class="mb-8 border-b-2 pb-5 text-center" :style="{ borderColor: 'var(--reader-rule)' }">
                <h1 class="mb-2 font-heading text-3xl font-black tracking-tight leading-tight sm:text-4xl" :style="{ color: 'var(--reader-text)' }">{{ previewChapterTitle }}</h1>
                <p class="text-xs font-mono uppercase tracking-wider text-ink-muted">Chapter {{ previewChapterNumber }}<span v-if="form.translatorGroup"> · {{ form.translatorGroup }}</span></p>
              </header>

              <div v-if="previewHtml" class="prose max-w-none select-text whitespace-pre-line text-justify" :style="{ color: 'var(--reader-text)' }" v-html="previewHtml"></div>
              <div v-else class="border border-dashed p-8 text-center font-mono text-[10px] uppercase text-ink-muted" :style="{ borderColor: 'var(--reader-rule)', backgroundColor: 'rgba(255,255,255,0.4)' }">
                Write something to see the live preview.
              </div>
            </article>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
