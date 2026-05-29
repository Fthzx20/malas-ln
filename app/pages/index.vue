<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, defineAsyncComponent } from 'vue'
import { useLibraryStore } from '~/stores/library'

useHead({
  title: 'Malaz Scans — Premium Light Novel Platform',
  meta: [
    { name: 'description', content: 'Explore premium Light Novels in a gorgeous, minimalist-inspired interface. Curated translations, seamless typography controls, and offline reading.' }
  ]
})

// Fetch featured novels for the auto-flip page-turner without blocking first paint
const { data: featuredNovels } = useFetch('/api/novels/featured')

// Fetch public settings for homepage texts
const { data: publicSettingsRaw } = useFetch('/api/settings/public')
const siteSettings = computed(() => (publicSettingsRaw.value as any)?.settings)
const hpSettings = computed(() => siteSettings.value?.homepage || {})

// Preload the first featured novel's cover image to improve LCP
const firstCover = computed(() => (featuredNovels.value as any)?.[0]?.coverUrl ?? null)
useHead(computed(() => ({
  link: firstCover.value ? [{
    rel: 'preload',
    as: 'image',
    href: firstCover.value,
  }] : [],
})))

// Fetch latest releases (latest novels/chapters) — lazy, client-only
const { data: latestNovels, refresh: refreshLatest } = useFetch('/api/novels', {
  query: { sort: 'latest', limit: 8 },
  lazy: true,
})

// Fetch trending novels — lazy, client-only (load when sidebar appears)
const { data: trendingNovels, refresh: refreshTrending } = useFetch('/api/novels', {
  query: { sort: 'popular', limit: 5 },
  lazy: true,
})

const { data: topContribData, refresh: refreshTopContrib } = useFetch('/api/profiles/top-contributor', {
  lazy: true,
})

const sidebarRef = ref<HTMLElement | null>(null)
let _sidebarObserver: IntersectionObserver | null = null

const contributorsList = computed(() => {
  const remote = topContribData.value as any
  if (remote && (Array.isArray(remote) || Array.isArray(remote?.contributors) || Array.isArray(remote?.data))) {
    if (Array.isArray(remote)) return remote
    return remote.contributors ?? remote.data ?? []
  }
  return []
})

const libraryStore = useLibraryStore()
const isClientReady = ref(false)

// Lazy-load small avatar in sidebar contributors list
const AsyncAvatar = defineAsyncComponent(() => import('~/components/ui/UiAvatar.vue'))

const resumeReading = computed(() => {
  const localEntry = libraryStore.localHistory[0] ?? null
  const latestBookmark = libraryStore.bookmarks
    .filter(bookmark => bookmark.currentChapterId)
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null

  if (localEntry && latestBookmark) {
    const localTime = new Date(localEntry.readAt).getTime()
    const bookmarkTime = new Date(latestBookmark.updatedAt).getTime()
    return localTime >= bookmarkTime
      ? {
          title: localEntry.novelTitle,
          chapterTitle: localEntry.chapterTitle,
          chapterNumber: localEntry.chapterNumber,
          chapterId: localEntry.chapterId,
          progressPct: localEntry.progressPct ?? 0,
          source: 'local',
        }
      : {
          title: latestBookmark.novel.title,
          chapterTitle: latestBookmark.currentChapter?.title ?? 'Resume Reading',
          chapterNumber: latestBookmark.currentChapter?.chapterNumber ?? 1,
          chapterId: latestBookmark.currentChapterId,
          progressPct: latestBookmark.progressPct ?? 0,
          source: 'bookmark',
        }
  }

  if (localEntry) {
    return {
      title: localEntry.novelTitle,
      chapterTitle: localEntry.chapterTitle,
      chapterNumber: localEntry.chapterNumber,
      chapterId: localEntry.chapterId,
      progressPct: localEntry.progressPct ?? 0,
      source: 'local',
    }
  }

  if (latestBookmark) {
    return {
      title: latestBookmark.novel.title,
      chapterTitle: latestBookmark.currentChapter?.title ?? 'Resume Reading',
      chapterNumber: latestBookmark.currentChapter?.chapterNumber ?? 1,
      chapterId: latestBookmark.currentChapterId,
      progressPct: latestBookmark.progressPct ?? 0,
      source: 'bookmark',
    }
  }

  return null
})

const resumeProgressLabel = computed(() => {
  if (!resumeReading.value) return 'No saved position yet'
  return `${Math.max(0, Math.min(100, resumeReading.value.progressPct ?? 0))}% captured`
})

// Auto-flip Featured Hero State
const currentHeroIndex = ref(0)
const previousHeroIndex = ref(-1)
const isTransitioning = ref(false)
let heroTimer: ReturnType<typeof setInterval> | null = null
const isHoveringHero = ref(false)

const activeHeroNovel = computed(() => {
  if (!featuredNovels.value || !featuredNovels.value.length) return null
  return featuredNovels.value[currentHeroIndex.value] as any
})

const transitionToSlide = (newIndex: number) => {
  if (isTransitioning.value || !featuredNovels.value?.length) return
  if (newIndex === currentHeroIndex.value) return

  isTransitioning.value = true
  previousHeroIndex.value = currentHeroIndex.value
  
  // Small delay to allow exit animation, then switch
  setTimeout(() => {
    currentHeroIndex.value = newIndex
    // Allow enter animation to complete
    setTimeout(() => {
      isTransitioning.value = false
      previousHeroIndex.value = -1
    }, 400)
  }, 50)
}

const startHeroTimer = () => {
  if (heroTimer) clearInterval(heroTimer)
  heroTimer = setInterval(() => {
    if (!isHoveringHero.value && featuredNovels.value?.length) {
      const nextIndex = (currentHeroIndex.value + 1) % featuredNovels.value.length
      transitionToSlide(nextIndex)
    }
  }, 5000)
}

const stopHeroTimer = () => {
  if (heroTimer) clearInterval(heroTimer)
}

const setHeroIndex = (index: number) => {
  transitionToSlide(index)
  // Reset the timer when manually switching
  startHeroTimer()
}
let _visibilityHandler: (() => void) | null = null

onMounted(() => {
  isClientReady.value = true
  // Defer starting the auto-flip to idle time to reduce main-thread startup work
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(() => startHeroTimer(), { timeout: 1000 })
  } else {
    startHeroTimer()
  }

  // Observe sidebar and only load non-critical widgets when they come into view
  try {
    _sidebarObserver = new IntersectionObserver((entries) => {
      if (!entries || entries.length === 0) return
      const entry = entries[0] ?? null
      if (!entry) return
      if (entry.isIntersecting) {
        // load trending and contributors once
        try { refreshTrending() } catch (_) {}
        try { refreshTopContrib() } catch (_) {}
        _sidebarObserver?.disconnect()
        _sidebarObserver = null
      }
    }, { rootMargin: '400px' })

    if (sidebarRef.value) _sidebarObserver.observe(sidebarRef.value)
  } catch (e) {
    // ignore if IntersectionObserver not available
    try { refreshTrending() } catch (_) {}
    try { refreshTopContrib() } catch (_) {}
  }

  // Pause hero auto-flip while tab is hidden to save CPU/battery
  _visibilityHandler = () => {
    if (typeof document === 'undefined') return
    if (document.hidden) stopHeroTimer()
    else startHeroTimer()
  }
  document.addEventListener('visibilitychange', _visibilityHandler)
})

onUnmounted(() => {
  stopHeroTimer()
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler)
    _visibilityHandler = null
  }
    if (_sidebarObserver) {
      _sidebarObserver.disconnect()
      _sidebarObserver = null
    }
})

const genres = computed(() => {
  const gStr = hpSettings.value?.genres
  if (gStr) {
    return gStr.split(',').map((g: string) => g.trim()).filter(Boolean)
  }
  return ['Action', 'Fantasy', 'Adventure', 'Sci-Fi', 'Romance', 'Mystery', 'Slice of Life', 'Drama']
})
</script>

<template>
  <div class="container-curated py-6">
    <!-- ===== curated LEAD (HERO SECTION) ===== -->
    <section 
      class="border border-ink mb-12 bg-surface hero-section mx-auto max-w-270 overflow-hidden"
      @mouseenter="isHoveringHero = true"
      @mouseleave="isHoveringHero = false"
      aria-label="Editor's Choice Featured Novels"
    >
      <!-- curated Section Header -->
      <div class="px-4 py-2 border-b border-ink flex items-center justify-between bg-surface-raised font-mono text-xs tracking-wider uppercase text-ink-muted">
        <span>{{ hpSettings.heroLeft || 'Recommended by Admin' }}</span>
        <span>{{ hpSettings.heroRight || 'Issue No. 104 &bull; Vol. I' }}</span>
      </div>

      <div v-if="activeHeroNovel" class="relative overflow-hidden">
        <!-- Hero Slides Carousel -->
        <div class="grid grid-cols-1 lg:grid-cols-12 min-h-120 sm:min-h-120 lg:min-h-135">
          <!-- Metadata / News Section (Left Column) -->
          <div class="order-2 lg:order-1 lg:col-span-7 p-5 sm:p-8 md:p-10 flex flex-col justify-between border-b-0 lg:border-r border-ink bg-paper">
            <div :key="currentHeroIndex" class="hero-content-enter">
              <div class="flex flex-wrap gap-2 mb-4">
                <span 
                  v-for="tag in activeHeroNovel.genreTags.slice(0, 3)" 
                  :key="tag"
                  class="font-mono text-[10px] tracking-widest uppercase border border-ink px-2 py-0.5"
                >
                  {{ tag }}
                </span>
                <span class="font-mono text-[10px] bg-accent text-white px-2 py-0.5 uppercase tracking-widest">
                  Featured
                </span>
              </div>

              <!-- Main Title with newsprint typography -->
              <NuxtLink :to="`/novels/${activeHeroNovel.slug}`" class="group block">
                <h2 class="font-heading text-2xl sm:text-4xl lg:text-5xl font-black mb-4 tracking-tight leading-tight group-hover:text-accent transition-colors">
                  {{ activeHeroNovel.title }}
                </h2>
              </NuxtLink>

              <!-- Newspaper dateline and author details -->
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-ink-muted mb-6 border-y border-rule py-2">
                <span>By <strong class="text-ink font-semibold">{{ activeHeroNovel.author }}</strong></span>
                <span v-if="activeHeroNovel.illustrator">Illustrations &bull; <strong class="text-ink font-semibold">{{ activeHeroNovel.illustrator }}</strong></span>
                <span>Rating &bull; <span class="text-accent font-bold">{{ activeHeroNovel.avgRating || 'N/A' }}</span> ({{ activeHeroNovel.ratingCount }})</span>
              </div>

              <!-- Content Synopsis with drop cap for curated feel -->
              <p class="font-body text-sm sm:text-base text-ink-light leading-relaxed mb-6 line-clamp-4 first-letter:float-left first-letter:font-heading first-letter:text-5xl first-letter:font-black first-letter:mr-2 first-letter:text-accent first-letter:leading-none">
                {{ activeHeroNovel.synopsis }}
              </p>
            </div>

            <!-- Carousel Controls -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-rule mt-4">
              <div class="flex flex-wrap gap-1">
                <button 
                  v-for="(n, idx) in featuredNovels" 
                  :key="n.id"
                  @click="setHeroIndex(idx)"
                  class="w-8 h-8 font-mono text-xs border transition-all shrink-0"
                  :class="idx === currentHeroIndex ? 'bg-ink text-paper border-ink font-bold' : 'border-rule hover:border-ink hover:text-accent text-ink-muted'"
                  :aria-label="`Go to slide ${idx + 1}`"
                  :aria-current="idx === currentHeroIndex ? 'true' : undefined"
                >
                  {{ String(idx + 1).padStart(2, '0') }}
                </button>
              </div>

              <NuxtLink 
                :to="`/novels/${activeHeroNovel.slug}`"
                class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider font-bold border-b-2 border-ink hover:border-accent hover:text-accent pb-0.5 transition-colors"
              >
                Read Manuscript
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="square" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </NuxtLink>
            </div>
          </div>

          <!-- Cover Art / Print Section (Right Column) -->
          <div class="order-1 lg:order-2 lg:col-span-5 relative flex items-center justify-center bg-surface-sunken overflow-hidden min-h-75 sm:min-h-75 lg:min-h-135 border-b lg:border-b-0 border-ink">
            <!-- Responsive NuxtImg ensuring strict dimensions, cover visual aesthetics, zero bleed overlap -->
              <div :key="`cover-${currentHeroIndex}`" class="hero-cover-enter w-full h-full">
              <NuxtImg
                v-if="activeHeroNovel.coverUrl"
                :src="activeHeroNovel.coverUrl!"
                :alt="`Volume Cover for ${activeHeroNovel.title}`"
                width="400"
                height="560"
                loading="eager"
                class="w-full h-full object-cover"
              />
              <div v-else class="flex flex-col items-center justify-center p-8 text-center text-ink-faint font-mono w-full h-full">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="square" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <span>No Illustration Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading skeleton fallback -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-12 min-h-120 sm:min-h-120 lg:min-h-135">
        <div class="order-2 lg:order-1 lg:col-span-7 p-5 sm:p-8 md:p-10 flex flex-col justify-between border-b-0 lg:border-r border-ink bg-paper">
          <div class="space-y-4">
            <UiSkeleton class="h-6 w-32" />
            <UiSkeleton class="h-12 w-full" />
            <UiSkeleton class="h-12 w-2/3" />
            <UiSkeleton class="h-4 w-48" />
            <div class="space-y-2 pt-6">
              <UiSkeleton class="h-4 w-full" />
              <UiSkeleton class="h-4 w-full" />
              <UiSkeleton class="h-4 w-5/6" />
            </div>
          </div>
          <div class="flex justify-between pt-6 border-t border-rule">
            <UiSkeleton class="h-8 w-24" />
            <UiSkeleton class="h-8 w-24" />
          </div>
        </div>
        <div class="order-1 lg:order-2 lg:col-span-5 bg-surface-sunken flex items-center justify-center min-h-75 sm:min-h-75 lg:min-h-135 border-b lg:border-b-0 border-ink">
          <UiSkeleton class="w-full h-full" />
        </div>
      </div>
    </section>

    <!-- ===== curated SUBHEAD (NEWSPAPER ROW) ===== -->
    <div class="border-y border-ink-light py-3 mb-10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs uppercase tracking-widest text-ink">
      <div class="flex items-center gap-6">
        <span><strong>Reminder:</strong> Don't forget to buy the Novels when avaliable in your country</span>
      </div>
      <div class="flex items-center gap-4">
        <span>All Contents are Machine Translated</span>
        <div class="w-2.5 h-2.5 bg-success rounded-none inline-block animate-pulse"></div>
      </div>
    </div>

    <!-- ===== MAIN CONTENT GRID (NEWSPAPER COLUMNS) ===== -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
      <!-- Left & Center Columns: Latest Dispatches (Col span 8) -->
      <main class="lg:col-span-8 space-y-8">
        <div>
          <!-- Section Heading styled like curated division -->
          <div class="flex items-center justify-between border-b-4 border-ink pb-2 mb-6">
            <h2 class="font-heading text-3xl font-black uppercase tracking-tight text-ink">
              {{ hpSettings.latestTitle || 'Latest Additions' }}
            </h2>
            <NuxtLink to="/novels" class="font-mono text-[10px] uppercase tracking-[0.24em] font-bold text-ink-muted hover:text-accent transition-colors flex items-center gap-2 group">
              View list <span class="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </NuxtLink>
          </div>

          <div v-if="latestNovels?.data?.length" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              v-for="novel in latestNovels?.data" 
              :key="novel.id"
              class="border border-rule hover:border-ink transition-colors bg-surface flex flex-col justify-between"
            >
              <!-- Novel Cover & Brief Metadata -->
              <div class="p-4 border-b border-rule flex gap-4">
                <NuxtLink :to="`/novels/${novel.slug}`" class="w-20 h-28 bg-surface-sunken shrink-0 relative overflow-hidden border border-rule">
                  <NuxtImg 
                    v-if="novel.coverUrl"
                    :src="novel.coverUrl"
                    :alt="`Cover for ${novel.title}`"
                    width="200"
                    height="280"
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center bg-surface-sunken text-ink-faint">
                    <span class="font-mono text-[9px] uppercase">Blank</span>
                  </div>
                </NuxtLink>

                <div class="flex-1 flex flex-col justify-between">
                  <div>
                    <div class="flex items-start justify-between gap-2">
                      <span class="font-mono text-[9px] tracking-wider uppercase text-accent font-bold">
                        {{ novel.genreTags[0] || 'Serial' }}
                      </span>
                      <UiBookmarkButton :novel-id="novel.id" size="sm" :icon-only="true" />
                    </div>
                    <NuxtLink :to="`/novels/${novel.slug}`" class="block group">
                      <h4 class="font-heading text-lg font-bold leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                        {{ novel.title }}
                      </h4>
                    </NuxtLink>
                    <p class="text-xs text-ink-muted font-mono mt-1">By {{ novel.author }}</p>
                  </div>
                  <!-- Novel Chapters info / Rating -->
                  <div class="flex items-center justify-between text-xs font-mono pt-2">
                    <span class="text-ink-muted font-medium">{{ novel.totalChapters }} chapters</span>
                    <span class="flex items-center gap-0.5 text-accent font-bold">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                      </svg>
                      {{ novel.avgRating ? Number(novel.avgRating).toFixed(1) : '—' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Footer with Latest Chapter Action -->
              <div class="px-4 py-2.5 bg-surface-raised flex items-center justify-between text-xs">
                <span class="font-mono text-ink-muted">Updated {{ new Date(novel.updatedAt).toLocaleDateString() }}</span>
                <NuxtLink 
                  :to="`/novels/${novel.slug}`"
                  class="font-mono uppercase font-bold hover:text-accent transition-colors flex items-center gap-0.5"
                >
                  Read Serial
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="square" d="M9 5l7 7-7 7" />
                  </svg>
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Empty Fallback / Loader Skeletons -->
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-for="i in 4" :key="i" class="border border-rule p-4 space-y-4">
              <div class="flex gap-4">
                <UiSkeleton class="w-20 h-28" />
                <div class="flex-1 space-y-2">
                  <UiSkeleton class="h-3 w-16" />
                  <UiSkeleton class="h-5 w-full" />
                  <UiSkeleton class="h-5 w-4/5" />
                  <UiSkeleton class="h-3 w-24" />
                </div>
              </div>
              <UiSkeleton class="h-6 w-full" />
            </div>
          </div>
        </div>

        <!-- ===== GENRE TAXONOMY GRID ===== -->
        <div class="border border-ink p-6 bg-white">
          <h3 class="font-heading text-xl font-black mb-4 border-b border-ink pb-2 uppercase tracking-tight">
            Browse by Genre Division
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NuxtLink
              v-for="genre in genres"
              :key="genre"
              :to="`/novels?genre=${encodeURIComponent(genre)}`"
              class="border border-rule hover:border-ink bg-surface hover:bg-surface-sunken p-3 text-center text-sm font-mono tracking-wider font-semibold transition-all hover:text-accent"
            >
              {{ genre }}
            </NuxtLink>
          </div>
        </div>

        <!-- Continue Where You Left Off (moved here as a card) -->
        <div class="mt-6">
          <UiCard accentBorder>
            <template #header>
              Continue Where You Left Off
            </template>
            <div>
              <div v-if="isClientReady && resumeReading" class="flex items-center justify-between gap-4">
                <div class="flex-1">
                  <NuxtLink :to="`/read/${resumeReading.chapterId}`" class="block">
                    <h4 class="font-heading text-lg font-bold leading-tight line-clamp-2">{{ resumeReading.title }}</h4>
                  </NuxtLink>
                  <p class="text-sm text-ink-muted mt-1">Chapter {{ resumeReading.chapterNumber }} · {{ resumeReading.chapterTitle }}</p>
                  <div class="h-2 bg-surface-sunken border border-rule mt-3 overflow-hidden">
                    <div class="h-full bg-accent" :style="{ width: `${Math.max(0, Math.min(100, resumeReading.progressPct ?? 0))}%` }"></div>
                  </div>
                </div>

                <div class="flex flex-col items-end gap-2">
                  <NuxtLink :to="`/read/${resumeReading.chapterId}`" class="px-3 py-2 bg-ink text-paper font-semibold">Resume</NuxtLink>
                  <NuxtLink to="/novels" class="text-xs text-ink-muted">Browse Catalog</NuxtLink>
                </div>
              </div>
              <div v-else class="text-sm text-ink-muted">No saved position yet. Start reading to populate this card.</div>
            </div>
          </UiCard>
        </div>
      </main>

      <!-- Right Column: Trending Opinion & Dispatch Column (Col span 4) -->
      <aside ref="sidebarRef" class="lg:col-span-4 flex flex-col gap-6">
        <!-- curated Leaderboard (Trending Column) -->
        <div class="border border-ink p-5 sm:p-6 bg-white shadow-sm">
          <div class="border-b-2 border-ink pb-2 mb-4 flex items-center justify-between">
            <h3 class="font-heading text-xl font-bold uppercase tracking-tight text-ink">
              {{ hpSettings.trendingTitle || 'Trending Serials' }}
            </h3>
            <span class="font-mono text-[9px] text-ink-muted tracking-[0.2em] uppercase">Metrics Engine</span>
          </div>

          <div v-if="trendingNovels?.data?.length" class="space-y-6">
            <div 
              v-for="(novel, index) in trendingNovels?.data" 
              :key="novel.id"
              class="flex gap-4 border-b border-rule last:border-b-0 pb-4 last:pb-0"
            >
              <!-- Numeric rank identifier in Newsprint Style -->
              <span class="font-heading text-4xl font-extrabold text-accent leading-none select-none w-8 text-right">
                {{ index + 1 }}
              </span>

              <div class="flex-1">
                <NuxtLink :to="`/novels/${novel.slug}`" class="block group">
                  <h4 class="font-heading text-base font-bold leading-tight group-hover:text-accent transition-colors">
                    {{ novel.title }}
                  </h4>
                </NuxtLink>
                <div class="flex items-center justify-between text-xs font-mono text-ink-muted mt-1">
                  <span>By {{ novel.author }}</span>
                  <span class="text-accent font-bold">{{ novel.avgRating ? Number(novel.avgRating).toFixed(1) : '—' }} rating</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Loading skeleton -->
          <div v-else class="space-y-4">
            <div v-for="i in 5" :key="i" class="flex gap-4 border-b border-rule pb-4">
              <UiSkeleton class="h-10 w-8" />
              <div class="flex-1 space-y-2">
                <UiSkeleton class="h-4 w-full" />
                <UiSkeleton class="h-3 w-2/3" />
              </div>
            </div>
          </div>
        </div>

        <!-- Dynamic Statistics Desk -->
        <div class="border border-ink p-5 sm:p-6 bg-white font-mono text-xs text-ink-muted space-y-4 shadow-sm">
          <div class="flex items-start justify-between gap-3 border-b border-rule pb-2">
            <div>
              <h4 class="font-heading text-sm font-black text-ink uppercase">Top Contributors</h4>
              <p class="mt-1 text-[10px] uppercase tracking-[0.24em] text-ink-muted">Weekly refresh · rating + review activity</p>
            </div>
            <span class="shrink-0 rounded-none border border-ink px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-ink font-bold bg-paper">Top 5</span>
          </div>

          <div v-if="contributorsList.length" class="space-y-3">
            <div
              v-for="(contributor, index) in contributorsList"
              :key="contributor.id"
              class="flex items-center gap-3 rounded-none border border-rule bg-paper p-2.5 sm:p-3"
            >
              <component :is="AsyncAvatar"
                :src="contributor.avatarUrl || undefined"
                :name="contributor.username"
                :alt="`${contributor.username} profile avatar`"
                size="sm"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <p class="truncate font-heading text-sm font-bold text-ink">{{ contributor.username }}</p>
                  <span class="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">#{{ Number(index) + 1 }}</span>
                </div>
                <p class="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                  {{ Number(contributor.contributionCount || 0) }} contributions this week
                </p>
              </div>
            </div>
          </div>

          <div v-else class="border border-dashed border-rule bg-paper p-4 text-center text-ink-muted">
            No contributor data available yet.
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ===== HERO CAROUSEL ANIMATIONS ===== */

/* Content text animation — smooth fade-slide on key change */
.hero-content-enter {
  animation: heroContentIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes heroContentIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Cover image animation — subtle scale-fade on key change */
.hero-cover-enter {
  animation: heroCoverIn 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes heroCoverIn {
  from {
    opacity: 0;
    transform: scale(1.03) translateX(10px);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Hover zoom for cover image */
.hero-section .hero-cover-enter:hover img {
  transform: scale(1.03);
  transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-section .hero-cover-enter img {
  transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

@media (max-width: 639px) {
  .hero-section .hero-cover-enter:hover img {
    transform: scale(1.015);
  }
}

/* Auto-flip progress indicator on active slide button */
.hero-section button[aria-current="true"] {
  position: relative;
  overflow: hidden;
}

.hero-section button[aria-current="true"]::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: currentColor;
  animation: slideProgress 5s linear both;
  width: 100%;
}

@keyframes slideProgress {
  from {
    transform: scaleX(0);
    transform-origin: left;
  }
  to {
    transform: scaleX(1);
    transform-origin: left;
  }
}
</style>
