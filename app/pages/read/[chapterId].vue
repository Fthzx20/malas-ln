<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { useReaderStore } from '~/stores/reader'
import { useLibraryStore } from '~/stores/library'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'
import { useScrollProgress } from '~/composables/useScrollProgress'

definePageMeta({
  layout: 'reader'
})

const route = useRoute()
const readerStore = useReaderStore()
const libraryStore = useLibraryStore()
const authStore = useAuthStore()
const toast = useToast()
const chapterId = computed(() => route.params.chapterId as string)

// Fetch chapter details with relations and navigation helpers (reactively watch computed URL ref)
const chapterUrl = computed(() => `/api/chapters/${chapterId.value}`)
const { data: networkChapter, pending: networkPending, error: networkError } = await useFetch(chapterUrl)

// Computed details, pending, and error mapping
const chapterDetails = computed(() => networkChapter.value)
const isPending = computed(() => networkPending.value)
const isError = computed(() => networkError.value && !chapterDetails.value)
const isChapterUnavailable = computed(() => {
  const statusCode = (networkError.value as any)?.statusCode || (networkError.value as any)?.status || 0
  return [403, 404].includes(Number(statusCode))
})

// Customization menu state
const isSettingsOpen = ref(false)

// Convert chapter markdown content to HTML
const chapterHtml = computed(() => {
  if (!chapterDetails.value?.chapter?.content) return ''
  return marked(chapterDetails.value.chapter.content)
})

const getSavedScrollPosition = () => {
  const localEntry = libraryStore.localHistory.find(h => h.chapterId === chapterId.value)
  if (typeof localEntry?.scrollPosition === 'number') {
    return localEntry.scrollPosition
  }

  const dbBookmark = libraryStore.getBookmarkForNovel(chapterDetails.value?.chapter?.novelId || '')
  if (dbBookmark?.currentChapterId === chapterId.value && typeof dbBookmark.scrollPosition === 'number') {
    return dbBookmark.scrollPosition
  }

  return null
}

const restoreScrollPosition = (targetPosition: number, attempt = 0) => {
  if (typeof window === 'undefined') return

  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  if (maxScroll >= targetPosition || attempt >= 20) {
    window.scrollTo(0, Math.min(targetPosition, maxScroll))
    return
  }

  requestAnimationFrame(() => restoreScrollPosition(targetPosition, attempt + 1))
}

// Scroll progress
const { scrollPct } = useScrollProgress()
const textContainerRef = ref<HTMLElement | null>(null)

const blockClipboardShortcut = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v', 'a', 's'].includes(key)) {
    event.preventDefault()
  }
}

// Debounce helper for scroll saving
let saveTimeout: NodeJS.Timeout | null = null
const persistProgress = async () => {
  if (!chapterDetails.value?.chapter) return

  const currentScrollPosition = window.scrollY
  const currentProgressPct = scrollPct.value

  // Save locally so refreshes and cached restores keep the last place.
  libraryStore.addLocalHistory({
    chapterId: chapterId.value,
    novelSlug: chapterDetails.value.chapter.novel.slug,
    novelTitle: chapterDetails.value.chapter.novel.title,
    chapterTitle: chapterDetails.value.chapter.title,
    chapterNumber: chapterDetails.value.chapter.chapterNumber,
    scrollPosition: currentScrollPosition,
    progressPct: currentProgressPct,
  })

  if (!authStore.isAuthenticated) return

  try {
    await libraryStore.updateBookmark(chapterDetails.value.chapter.novelId, {
      currentChapterId: chapterId.value,
      scrollPosition: currentScrollPosition,
      progressPct: currentProgressPct,
    })
  } catch {
    // Silent failure
  }
}

const saveProgress = () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    await persistProgress()
  }, 1000)
}

const flushProgress = () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  void persistProgress()
}

// Watch scroll progress to debounced save
watch(scrollPct, () => {
  saveProgress()
})

// Interactive Footnotes Popover State
const activeFootnote = ref<{ marker: string, content: string } | null>(null)
const isFootnoteOpen = ref(false)

const openFootnote = (marker: string, content: string) => {
  activeFootnote.value = { marker, content }
  isFootnoteOpen.value = true
}

// Immersive full-screen illustration preview states
const isPreviewOpen = ref(false)
const previewImageUrl = ref('')
const previewImageAlt = ref('')

const openIllustrationPreview = (src: string, alt: string) => {
  previewImageUrl.value = src
  previewImageAlt.value = alt
  isPreviewOpen.value = true
}



// Setup intersection observers or intercept click on parsed footnote anchors and illustrations
const interceptReadingClicks = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  
  // Intercept images for full screen illustration previews!
  if (target.tagName === 'IMG') {
    e.preventDefault()
    const src = target.getAttribute('src')
    const alt = target.getAttribute('alt') || 'Illustration'
    if (src) {
      openIllustrationPreview(src, alt)
    }
    return
  }

  // Intercept footnote clicks
  if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#fn-')) {
    e.preventDefault()
    const fnId = target.getAttribute('href')?.substring(1)
    const markerText = target.innerText
    
    // Find footnote in fetched chapter data
    const match = chapterDetails.value?.chapter?.footnotes?.find((f: any) => f.marker === markerText || f.id === fnId)
    if (match) {
      openFootnote(match.marker, match.content)
    }
  }
}

const handleGlobalKeyDown = (event: KeyboardEvent) => {
  blockClipboardShortcut(event)
  if (event.key === 'Escape') {
    if (isPreviewOpen.value) {
      isPreviewOpen.value = false
    }
  }
}

let commentsLoadHandle: number | null = null

const scheduleInitialCommentsLoad = () => {
  if (typeof window === 'undefined') return

  if ('requestIdleCallback' in window) {
    commentsLoadHandle = (window as any).requestIdleCallback(() => {
      commentsLoadHandle = null
      void fetchComments()
    }, { timeout: 1200 })
    return
  }

  commentsLoadHandle = window.setTimeout(() => {
    commentsLoadHandle = null
    void fetchComments()
  }, 0)
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeyDown)
  window.addEventListener('beforeunload', flushProgress)
  window.addEventListener('pagehide', flushProgress)
  
  // Set initial chapter as read
  if (chapterDetails.value?.chapter) {
    libraryStore.markChapterRead(chapterId.value)
  }

  scheduleInitialCommentsLoad()
})

const hasRestoredScroll = ref(false)

watch(chapterDetails, async () => {
  if (import.meta.server) return
  if (!chapterDetails.value?.chapter || hasRestoredScroll.value) return

  const savedScrollPosition = getSavedScrollPosition()
  if (savedScrollPosition === null) return

  hasRestoredScroll.value = true
  await nextTick()
  restoreScrollPosition(savedScrollPosition)
}, { immediate: true })

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown)
  window.removeEventListener('beforeunload', flushProgress)
  window.removeEventListener('pagehide', flushProgress)
  if (commentsLoadHandle !== null) {
    if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      ;(window as any).cancelIdleCallback(commentsLoadHandle)
    } else {
      clearTimeout(commentsLoadHandle)
    }
    commentsLoadHandle = null
  }
  if (saveTimeout) clearTimeout(saveTimeout)
})

// Watch chapter change to restore states
watch(() => route.params.chapterId, () => {
  isSettingsOpen.value = false
  activeFootnote.value = null
  isFootnoteOpen.value = false
  hasRestoredScroll.value = false
})

useHead(() => {
  if (!chapterDetails.value?.chapter) return {}
  return {
    title: `Chapter ${chapterDetails.value.chapter.chapterNumber} — ${chapterDetails.value.chapter.novel.title}`,
    meta: [
      { name: 'description', content: `Read Chapter ${chapterDetails.value.chapter.chapterNumber}: ${chapterDetails.value.chapter.title} of ${chapterDetails.value.chapter.novel.title} on Malaz Scans.` }
    ]
  }
})

// ===== Comments / Social Interaction =====
const comments = ref<any[]>([])
const newComment = ref('')
const replyTo = ref<string | null>(null)
const isPosting = ref(false)
const commentsCursor = ref<string | null>(null)
const commentsHasMore = ref(true)
const commentsLoadingMore = ref(false)
const commentsLoadMoreRef = ref<HTMLElement | null>(null)
const commentsObserver = ref<IntersectionObserver | null>(null)

const fetchComments = async () => {
  try {
    const data = await $fetch<{ items: any[], nextCursor: string | null, hasMore: boolean }>(`/api/comments/${chapterId.value}`, {
      query: { limit: 20 },
    })
    comments.value = Array.isArray(data?.items) ? data.items : []
    commentsCursor.value = data?.nextCursor ?? null
    commentsHasMore.value = Boolean(data?.hasMore)
    if (!comments.value || comments.value.length === 0) {
      comments.value = []
      commentsHasMore.value = false
      commentsCursor.value = null
    }
  } catch (err) {
    // ignore for now
  }
}

const loadMoreComments = async () => {
  if (!commentsHasMore.value || commentsLoadingMore.value || !commentsCursor.value) return
  commentsLoadingMore.value = true
  try {
    const data = await $fetch<{ items: any[], nextCursor: string | null, hasMore: boolean }>(`/api/comments/${chapterId.value}`, {
      query: { limit: 20, cursor: commentsCursor.value },
    })
    const nextItems = Array.isArray(data?.items) ? data.items : []
    comments.value = [...comments.value, ...nextItems]
    commentsCursor.value = data?.nextCursor ?? null
    commentsHasMore.value = Boolean(data?.hasMore)
  } finally {
    commentsLoadingMore.value = false
  }
}

const submitComment = async () => {
  if (!newComment.value || !newComment.value.trim()) return
  if (!authStore.isAuthenticated) {
    toast.info('Please sign in to post comments')
    return
  }
  isPosting.value = true
  try {
    const payload: any = { chapterId: chapterId.value, content: newComment.value.trim() }
    if (replyTo.value) payload.parentId = replyTo.value

    const created = await $fetch('/api/comments', { method: 'POST', body: payload })
    if (!created) throw new Error('No comment returned')

    // Attach optimistically
    if (created.parentId) {
      const parent = comments.value.find(c => c.id === created.parentId)
      if (parent) {
        parent.replies = parent.replies || []
        parent.replies.push(created)
      } else {
        await fetchComments()
      }
    } else {
      comments.value.unshift(created)
    }

    newComment.value = ''
    replyTo.value = null
    toast.success('Komentar terkirim')
  } catch (err) {
    toast.error('Gagal mengirim komentar')
  } finally {
    isPosting.value = false
  }
}

const setReply = (id: string) => {
  replyTo.value = id
  const findCommentById = (items: any[], targetId: string): any | null => {
    for (const item of items) {
      if (item.id === targetId) return item
      if (Array.isArray(item.replies) && item.replies.length > 0) {
        const nested = findCommentById(item.replies, targetId)
        if (nested) return nested
      }
    }
    return null
  }

  const target = findCommentById(comments.value, id)
  const targetName = target?.user?.username || target?.user?.displayName || 'user'
  const prefix = `@${targetName} `
  const stripped = newComment.value.replace(/^@[\w.-]+\s*/, '')
  newComment.value = `${prefix}${stripped}`
}

const isLikedByUser = (item: any) => {
  if (!authStore.profile) return false
  return Array.isArray(item.likedBy) && item.likedBy.includes(authStore.profile.id)
}

const toggleLike = async (item: any, parentId: string | null = null) => {
  if (!authStore.isAuthenticated) {
    toast.info('Silakan masuk untuk menyukai komentar')
    return
  }

  // client-side optimistic toggle (no API yet)
  const userId = authStore.profile!.id
  const arr = item.likedBy ?? []
  const idx = arr.indexOf(userId)
  if (idx === -1) arr.push(userId)
  else arr.splice(idx, 1)
  item.likedBy = arr
}

onMounted(async () => {
  await fetchComments()

  // Only create an observer if there are more comments to load
  if (!commentsHasMore.value) return

  const observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      void loadMoreComments()
    }
  }, { rootMargin: '200px' })

  commentsObserver.value = observer

  if (commentsLoadMoreRef.value) {
    observer.observe(commentsLoadMoreRef.value)
  }
})

onUnmounted(() => {
  commentsObserver.value?.disconnect()
  commentsObserver.value = null
})

const loginUrl = computed(() => `/auth/login?redirect=${encodeURIComponent(route.fullPath)}`)
const registerUrl = computed(() => `/auth/register?redirect=${encodeURIComponent(route.fullPath)}`)
</script>

<template>
  <div class="min-h-screen flex flex-col font-ui transition-colors duration-300">
    
    <!-- ===== MINIMAL CUSTOMIZER HEADER (SLIDE DRAWER TOGGLE) ===== -->
    <header 
      class="sticky top-0 z-40 border-b transition-colors duration-300 px-4"
      :style="{
        backgroundColor: 'var(--reader-surface)',
        borderColor: 'var(--reader-rule)',
        color: 'var(--reader-text)'
      }"
    >
      <div class="max-w-225 mx-auto h-14 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <NuxtLink 
            :to="chapterDetails?.chapter ? `/novels/${chapterDetails.chapter.novel.slug}` : '/novels'"
            class="touch-target p-2 hover:text-accent transition-colors font-mono text-xs uppercase font-bold flex items-center gap-1"
          >
            <span>&larr;</span>
            <span class="hidden sm:inline">Inspect Novel</span>
          </NuxtLink>

        </div>

        <!-- Center Title details -->
        <div v-if="chapterDetails?.chapter" class="text-center max-w-[50%] hidden md:block">
          <h2 class="font-heading text-sm font-bold truncate leading-tight">
            {{ chapterDetails.chapter.novel.title }}
          </h2>
          <p class="font-mono text-[9px] text-ink-muted uppercase">
            Chapter {{ chapterDetails.chapter.chapterNumber }}
          </p>
        </div>

        <div class="flex items-center gap-1">
          <!-- Customize typography trigger -->
          <button 
            @click="isSettingsOpen = !isSettingsOpen"
            class="touch-target p-2 hover:text-accent transition-colors flex items-center gap-1 font-mono text-xs uppercase font-bold"
            aria-label="Format controls"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="square" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="square" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="hidden sm:inline">Aksara</span>
          </button>
        </div>
      </div>

      <!-- Settings Panel Dropdown (client-only to avoid SSR hydration differences) -->
      <ClientOnly>
        <Transition name="slide-up">
          <div 
            v-if="isSettingsOpen" 
            class="border-t max-w-225 mx-auto py-4 space-y-4 text-xs font-mono"
            :style="{ borderColor: 'var(--reader-rule)' }"
          >
          <!-- Theme selections -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <span class="text-ink-muted uppercase font-bold">Ambient Theme</span>
              <div class="grid grid-cols-4 gap-1.5">
                <button 
                  v-for="t in ['day', 'night', 'sepia', 'curated'] as const" 
                  :key="t"
                  @click="readerStore.setTheme(t)"
                  class="py-2 text-center uppercase tracking-wider font-semibold border border-ink transition-all"
                  :style="{
                    backgroundColor: t === 'day' ? '#F9F9F7' : t === 'night' ? '#121212' : t === 'sepia' ? '#F4ECD8' : '#EAE6DF',
                    color: t === 'night' ? '#D4D4D4' : '#111111',
                    borderColor: readerStore.theme === t ? 'var(--color-accent)' : 'var(--reader-rule)'
                  }"
                >
                  {{ t }}
                </button>
              </div>
            </div>

            <!-- Font Selector -->
            <div class="space-y-1.5">
              <span class="text-ink-muted uppercase font-bold">Aksara (Fonts)</span>
              <div class="grid grid-cols-3 gap-1.5">
                <button 
                  v-for="f in ['Lora', 'Inter', 'JetBrains Mono'] as const" 
                  :key="f"
                  @click="readerStore.setFontFamily(f)"
                  class="py-2 text-center border font-semibold transition-all"
                  :class="readerStore.fontFamily === f ? 'bg-ink text-paper border-ink font-bold' : 'border-rule'"
                  :style="{ fontFamily: f === 'Lora' ? 'Lora' : f === 'Inter' ? 'Inter' : 'JetBrains Mono' }"
                >
                  {{ f.split(' ')[0] }}
                </button>
              </div>
            </div>
          </div>

          <!-- Adjusters Slider -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t" :style="{ borderColor: 'var(--reader-rule)' }">
            <div class="flex items-center justify-between">
              <span class="text-ink-muted uppercase font-bold">Aksara Size</span>
              <div class="flex items-center gap-2">
                <button @click="readerStore.decreaseFontSize" class="w-8 h-8 border border-rule hover:border-ink flex items-center justify-center font-bold text-base select-none">&minus;</button>
                <span class="w-8 text-center font-bold text-sm">{{ readerStore.fontSize }}px</span>
                <button @click="readerStore.increaseFontSize" class="w-8 h-8 border border-rule hover:border-ink flex items-center justify-center font-bold text-base select-none">&#x2b;</button>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-ink-muted uppercase font-bold">Line Height</span>
              <div class="flex items-center gap-2">
                <button @click="readerStore.setLineHeight(readerStore.lineHeight - 0.1)" class="w-8 h-8 border border-rule hover:border-ink flex items-center justify-center font-bold text-base select-none">&minus;</button>
                <span class="w-12 text-center font-bold text-sm">{{ readerStore.lineHeight.toFixed(1) }}</span>
                <button @click="readerStore.setLineHeight(readerStore.lineHeight + 0.1)" class="w-8 h-8 border border-rule hover:border-ink flex items-center justify-center font-bold text-base select-none">&#x2b;</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
      </ClientOnly>

      <!-- Scroll Progress Bar Indicator -->
      <div 
        class="absolute bottom-0 left-0 h-1 bg-accent transition-all duration-150" 
        :style="{ width: `${scrollPct}%` }"
      ></div>
    </header>

    <!-- ===== MAIN READER AREA ===== -->
    <main v-if="isPending" class="flex-1 flex items-center justify-center py-24">
      <div class="text-center space-y-4">
        <UiSkeleton class="h-10 w-64 mx-auto" />
        <UiSkeleton class="h-6 w-32 mx-auto" />
        <div class="space-y-2 max-w-150 px-4 pt-12 mx-auto">
          <UiSkeleton class="h-4 w-full" />
          <UiSkeleton class="h-4 w-full" />
          <UiSkeleton class="h-4 w-5/6" />
        </div>
      </div>
    </main>

    <main v-else-if="isError || !chapterDetails?.chapter" class="flex-1 flex items-center justify-center py-24 px-4 text-center">
      <div class="border border-dashed border-accent p-12 max-w-md bg-paper text-ink">
        <h3 class="font-heading text-2xl font-black text-accent mb-2">{{ isChapterUnavailable ? 'Chapter not available yet' : 'Failed to load Manuscript' }}</h3>
        <p class="text-sm text-ink-muted mb-6">
          {{ isChapterUnavailable ? 'This chapter is not published for public reading yet. Return to the novel page and choose a published chapter.' : 'We could not pull the requested text. Check your connections or catalog.' }}
        </p>
        <NuxtLink to="/novels" class="px-5 py-2 bg-ink text-paper hover:bg-accent font-ui font-semibold text-sm transition-colors">
          Browse Catalog
        </NuxtLink>
      </div>
    </main>

    <!-- Normal Chapter Text Flow -->
    <article 
      v-else 
      class="flex-1 py-12 px-6 sm:px-8"
      @click="interceptReadingClicks"
      @copy.prevent
      @cut.prevent
      @paste.prevent
      @contextmenu.prevent
      @selectstart.prevent
    >
      <div 
        class="mx-auto select-none selection:bg-(--reader-selection)"
        :style="readerStore.cssVars"
      >
        <!-- Chapter Metadata Header -->
        <header class="text-center mb-12 border-b-2 border-ink pb-6" :style="{ borderColor: 'var(--reader-rule)' }">
          <span class="font-mono text-xs uppercase tracking-widest text-ink-muted">
            {{ chapterDetails.chapter.novel.title }} &bull; Volume {{ chapterDetails.chapter.volume?.volumeNumber || 'I' }}
          </span>
          <h1 class="font-heading text-3xl sm:text-4xl lg:text-5xl font-black mt-2 mb-4 tracking-tight leading-tight" :style="{ color: 'var(--reader-text)' }">
            Chapter {{ chapterDetails.chapter.chapterNumber }}: {{ chapterDetails.chapter.title }}
          </h1>
          <div class="flex items-center justify-center gap-4 text-xs font-mono text-ink-muted">
            <span>By <strong class="text-ink font-semibold" :style="{ color: 'var(--reader-text)' }">{{ chapterDetails.chapter.novel.author }}</strong></span>
            <span>Uploader &bull; <strong class="text-ink font-semibold" :style="{ color: 'var(--reader-text)' }">{{ chapterDetails.chapter.translator?.displayName || chapterDetails.chapter.translatorGroup }}</strong></span>
          </div>
        </header>

        <!-- Pure HTML Chapter Body Content -->
        <section 
          ref="textContainerRef"
          class="malaz-rich-text malaz-rich-text--reading text-justify select-none"
          v-html="chapterHtml"
        ></section>

        <!-- Chapter Footnotes at Bottom -->
        <footer 
          v-if="chapterDetails.chapter.footnotes && chapterDetails.chapter.footnotes.length > 0"
          class="max-w-180 mx-auto mt-16 pt-8 border-t"
          :style="{ borderColor: 'var(--reader-rule)', color: 'var(--reader-muted)' }"
        >
          <h3 class="font-heading text-lg font-black uppercase mb-4 tracking-tight" :style="{ color: 'var(--reader-text)' }">Footnotes Critique</h3>
          <ul class="space-y-2.5 font-mono text-xs">
            <li 
              v-for="fn in chapterDetails.chapter.footnotes" 
              :key="fn.id" 
              :id="`fn-${fn.id}`"
              class="flex gap-2"
            >
              <span class="font-bold text-accent">[{{ fn.marker }}]</span>
              <span class="leading-relaxed">{{ fn.content }}</span>
            </li>
          </ul>
        </footer>

        <!-- Prev/Next Navigation Action Bar -->
        <nav 
          class="max-w-180 mx-auto mt-12 pt-6 border-t-2 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs uppercase"
          :style="{ borderColor: 'var(--reader-rule)' }"
        >
          <div>
            <NuxtLink 
              v-if="chapterDetails.navigation.prev" 
              :to="`/read/${chapterDetails.navigation.prev.id}`"
              :prefetch="true"
              class="touch-target px-4 py-2 border hover:bg-accent hover:text-white transition-colors flex items-center gap-1"
              :style="{ borderColor: 'var(--reader-rule)', color: 'var(--reader-text)' }"
            >
              &larr; Bab {{ chapterDetails.navigation.prev.chapterNumber }}
            </NuxtLink>
            <span v-else class="text-ink-faint select-none">Start of Manuscript</span>
          </div>

          <NuxtLink 
            :to="`/novels/${chapterDetails.chapter.novel.slug}`"
            class="touch-target p-2 hover:underline select-none"
            :style="{ color: 'var(--reader-text)' }"
          >
            Index
          </NuxtLink>

          <div>
            <NuxtLink 
              v-if="chapterDetails.navigation.next" 
              :to="`/read/${chapterDetails.navigation.next.id}`"
              :prefetch="true"
              class="touch-target px-4 py-2 border hover:bg-accent hover:text-white transition-colors flex items-center gap-1"
              :style="{ borderColor: 'var(--reader-rule)', color: 'var(--reader-text)' }"
            >
              Bab {{ chapterDetails.navigation.next.chapterNumber }} &rarr;
            </NuxtLink>
            <span v-else class="text-ink-faint select-none">End of Manuscript</span>
          </div>
        </nav>

        <!-- ===== COMMENTS / SOCIAL THREAD ===== -->
        <section class="max-w-180 mx-auto mt-12 pt-6 border-t" :style="{ borderColor: 'var(--reader-rule)' }">
          <h3 class="font-heading text-lg font-black mb-4 uppercase" :style="{ color: 'var(--reader-text)' }">Komentar Pembaca</h3>

          <div v-if="!authStore.isAuthenticated" class="border border-dashed p-4 bg-paper text-center mb-4">
            <p class="mb-3">Anda harus <strong>masuk</strong> atau <strong>daftar</strong> untuk meninggalkan komentar.</p>
            <div class="flex items-center justify-center gap-3">
              <NuxtLink :to="loginUrl" class="px-4 py-2 bg-accent text-paper">Masuk</NuxtLink>
              <NuxtLink :to="registerUrl" class="px-4 py-2 border">Daftar</NuxtLink>
            </div>
          </div>

          <div v-if="comments.length === 0 && authStore.isAuthenticated" class="text-sm text-ink-muted mb-4">Belum ada komentar — jadilah yang pertama.</div>

          <div class="space-y-4">
            <div v-for="comment in comments" :key="comment.id" class="border border-rule bg-surface p-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full overflow-hidden shrink-0">
                  <UiAvatar v-if="comment.user" :src="comment.user.avatarUrl || ''" :name="comment.user.displayName || comment.user.username" size="sm" />
                  <div v-else class="w-8 h-8 bg-ink-faint flex items-center justify-center text-xs font-bold text-paper">{{ (comment.user?.displayName || comment.user?.username || 'U').charAt(0).toUpperCase() }}</div>
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <div>
                      <strong :style="{ color: 'var(--reader-text)' }">{{ comment.user?.displayName || comment.user?.username || 'Pengguna' }}</strong>
                      <span class="text-xs text-ink-muted ml-2">{{ new Date(comment.createdAt).toLocaleString() }}</span>
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <button @click="setReply(comment.id)" class="text-xs font-mono text-accent" :disabled="!authStore.isAuthenticated">Reply</button>
                        <button @click="() => toggleLike(comment, null)" :disabled="!authStore.isAuthenticated" class="text-xs font-mono" :class="isLikedByUser(comment) ? 'bg-accent text-paper px-2 py-1 rounded' : 'text-ink-muted'">
                          ♥ {{ (comment.likedBy || []).length }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p class="mt-2 text-sm" v-html="comment.content"></p>

                  <div v-if="comment.replies?.length" class="mt-3 pl-4 border-l border-rule space-y-3">
                    <div v-for="r in comment.replies" :key="r.id" class="text-sm flex gap-3 items-start">
                      <div class="w-7 h-7 rounded-full overflow-hidden shrink-0">
                        <UiAvatar v-if="r.user" :src="r.user.avatarUrl || ''" :name="r.user.displayName || r.user.username" size="sm" />
                        <div v-else class="w-7 h-7 bg-ink-faint flex items-center justify-center text-xs font-bold text-paper">{{ (r.user?.displayName || r.user?.username || 'U').charAt(0).toUpperCase() }}</div>
                      </div>
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <div>
                            <strong :style="{ color: 'var(--reader-text)' }">{{ r.user?.displayName || r.user?.username }}</strong>
                            <span class="text-xs text-ink-muted ml-2">{{ new Date(r.createdAt).toLocaleString() }}</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <button @click="setReply(r.id)" class="text-xs font-mono text-accent" :disabled="!authStore.isAuthenticated">Reply</button>
                            <button @click="() => toggleLike(r, comment.id)" :disabled="!authStore.isAuthenticated" class="text-xs font-mono" :class="isLikedByUser(r) ? 'bg-accent text-paper px-2 py-1 rounded' : 'text-ink-muted'">
                              ♥ {{ (r.likedBy || []).length }}
                            </button>
                          </div>
                        </div>
                        <p class="mt-1" v-html="r.content"></p>
                      </div>
                    </div>
                  </div>

                  <div v-if="replyTo === comment.id" class="mt-3">
                    <div v-if="authStore.isAuthenticated">
                      <textarea v-model="newComment" class="w-full p-2 border border-rule" rows="3" placeholder="Balas komentar ini..."></textarea>
                      <div class="flex gap-2 mt-2">
                        <button @click="submitComment" :disabled="isPosting" class="px-3 py-1 bg-accent text-paper">Kirim</button>
                        <button @click="() => { replyTo = null; newComment = '' }" class="px-3 py-1 border">Batal</button>
                      </div>
                    </div>
                    <div v-else class="text-sm text-ink-muted">Anda harus <NuxtLink :to="loginUrl">masuk</NuxtLink> untuk membalas.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div ref="commentsLoadMoreRef" class="py-4 text-center text-xs font-mono text-ink-muted">
            <span v-if="commentsLoadingMore">Loading more comments...</span>
            <span v-else-if="commentsHasMore">Scroll to load more comments</span>
            <span v-else>End of comments</span>
          </div>

          <!-- Root comment form -->
          <div class="mt-6">
            <div v-if="authStore.isAuthenticated">
              <textarea v-model="newComment" class="w-full p-3 border border-rule" rows="4" placeholder="Tinggalkan komentar..."></textarea>
              <div class="flex gap-2 mt-3">
                <button @click="submitComment" :disabled="isPosting" class="px-4 py-2 bg-accent text-paper">Kirim</button>
                <button @click="() => { newComment = ''; replyTo = null }" class="px-4 py-2 border">Batal</button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </article>

    <!-- ===== FOOTNOTE DRAWER OVERLAY (POPUP TOOLTIP) ===== -->
    <UiModal v-model:open="isFootnoteOpen" :title="`Footnote Reference`">
      <div v-if="activeFootnote" class="font-mono text-xs space-y-3">
        <p class="font-bold text-accent text-sm">Annotation [{{ activeFootnote.marker }}]:</p>
        <p class="leading-relaxed font-body text-sm text-ink-light">
          {{ activeFootnote.content }}
        </p>
        <div class="pt-4 flex justify-end">
          <UiButton variant="primary" @click="isFootnoteOpen = false">Resume Reading</UiButton>
        </div>
      </div>
    </UiModal>

    <!-- ===== IMMERSIVE FULL-SCREEN ILLUSTRATION PREVIEW OVERLAY ===== -->
    <Transition name="fade">
      <div 
        v-if="isPreviewOpen" 
        class="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer"
        @click="isPreviewOpen = false"
        role="dialog"
        aria-modal="true"
        aria-label="Illustration Preview"
      >
        <!-- Close Button -->
        <button 
          @click="isPreviewOpen = false"
          class="absolute top-4 right-4 text-white hover:text-accent font-mono text-xs uppercase tracking-wider bg-black/50 border border-white/20 px-3 py-1.5 transition-colors"
        >
          Close [Esc]
        </button>

        <!-- Illustration Image -->
        <div class="relative max-w-full max-h-[85vh] overflow-hidden flex flex-col justify-center items-center">
          <img 
            :src="previewImageUrl" 
            :alt="previewImageAlt"
            class="max-w-full max-h-[80vh] object-contain border border-white/10 shadow-2xl transition-transform duration-300 hover:scale-102"
            @click.stop
          />
          <p v-if="previewImageAlt && previewImageAlt !== 'Illustration'" class="mt-4 text-xs font-mono text-white/70 uppercase tracking-widest text-center max-w-md">
            {{ previewImageAlt }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Footnote anchor highlight */
:deep(a[href^="#fn-"]) {
  color: var(--color-accent);
  font-weight: 700;
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: 0.8em;
  vertical-align: super;
  padding: 0 2px;
  transition: all var(--duration-fast);
}

:deep(a[href^="#fn-"]:hover) {
  background-color: var(--color-accent);
  color: white !important;
}

/* Ensure prose content headings and text follow reader theme variables (fix night mode) */
:deep(.prose h1, .prose h2, .prose h3, .prose h4, .prose p, .prose li) {
  color: var(--reader-text) !important;
}
</style>
