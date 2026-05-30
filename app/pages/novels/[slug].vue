<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useLibraryStore } from '~/stores/library'
import { useToast } from '~/composables/useToast'

const route = useRoute()
const authStore = useAuthStore()
const libraryStore = useLibraryStore()
const toast = useToast()

const slug = route.params.slug as string

// Fetch novel details (novel, volumes, chapters, ratings distribution)
let novelDataRaw: any = ref(null)
let pending = ref(false)
let error: any = null
let refresh = async () => {}
let novelData = computed(() => novelDataRaw?.value as any)

if (slug) {
  const fetchResult = await useFetch(`/api/novels/${slug}`)
  novelDataRaw = fetchResult.data
  pending = fetchResult.pending
  error = fetchResult.error
  refresh = fetchResult.refresh
} else {
  // If no slug provided, show not found state (client-side guard)
  error = { status: 400, message: 'Missing novel slug' }
}

// Active tab for listing
const activeTab = ref('chapters')
const tabs = [
  { label: 'Chapters List', value: 'chapters' },
  { label: 'Volumes', value: 'volumes' },
  { label: 'Reviews & Ratings', value: 'reviews' },
]

// Current user bookmark for this novel
const bookmark = computed(() => {
  if (!novelData.value?.novel) return null
  return libraryStore.getBookmarkForNovel(novelData.value.novel.id)
})

// Bookmark dropdown state + loading state
const isBookmarkDropdownOpen = ref(false)
const isBookmarkPending = ref(false)
const bookmarkDropdownRef = ref<HTMLElement | null>(null)

const selectBookmarkStatus = async (status: 'reading' | 'plan_to_read' | 'on_hold' | 'completed' | 'none') => {
  if (!authStore.isAuthenticated) {
    toast.warning('Please sign in to bookmark novels')
    navigateTo('/auth/login')
    return
  }

  isBookmarkPending.value = true
  try {
    if (status === 'none') {
      await libraryStore.deleteBookmark(novelData.value.novel.id)
      toast.success('Bookmark removed')
    } else {
      await libraryStore.updateBookmark(novelData.value.novel.id, { status })
      toast.success(`Saved to Library as ${status.replace(/_/g, ' ')}`)
    }
  } catch (err) {
    toast.error('Failed to update bookmark')
  } finally {
    isBookmarkPending.value = false
    isBookmarkDropdownOpen.value = false
  }
}

// Close bookmark dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (bookmarkDropdownRef.value && !bookmarkDropdownRef.value.contains(event.target as Node)) {
    isBookmarkDropdownOpen.value = false
  }
}

// User rating form
const isRatingModalOpen = ref(false)
const userRating = ref({
  overall: 5,
  story: 5,
  translation: 5,
  characters: 5,
  reviewText: '',
})

const isSubmittingRating = ref(false)
const submitRating = async () => {
  if (!authStore.isAuthenticated) return
  isSubmittingRating.value = true
  try {
    await $fetch('/api/ratings', {
      method: 'POST',
      body: {
        novelId: novelData.value.novel.id,
        ...userRating.value,
      },
    })
    toast.success('Thank you for your review!')
    isRatingModalOpen.value = false
    refresh()
  } catch (err) {
    toast.error('Failed to submit review')
  } finally {
    isSubmittingRating.value = false
  }
}

// Set page title and SEO description
useHead(() => {
  if (!novelData.value?.novel) return {}
  return {
    title: novelData.value.novel.title,
    meta: [
      { name: 'description', content: novelData.value.novel.synopsis.slice(0, 155) }
    ]
  }
})

onMounted(() => {
  if (authStore.isAuthenticated) {
    libraryStore.fetchBookmarks()
  }
  document.addEventListener('click', handleClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
})

// Offline download feature removed per request

// Calculate percentage for ratings breakdown
const totalRatingCount = computed(() => {
  if (!novelData.value?.ratings?.distribution) return 0
  return novelData.value.ratings.distribution.reduce((acc: number, cur: any) => acc + Number(cur.count), 0)
})

const getRatingPercentage = (rating: number) => {
  if (!totalRatingCount.value) return 0
  const found = novelData.value.ratings.distribution.find((d: any) => d.rating === rating)
  return found ? Math.round((Number(found.count) / totalRatingCount.value) * 100) : 0
}
</script>

<template>
  <div class="container-curated py-8">
    <div v-if="pending" class="space-y-8">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <UiSkeleton class="lg:col-span-4 h-96 w-full" />
        <div class="lg:col-span-8 space-y-4">
          <UiSkeleton class="h-10 w-2/3" />
          <UiSkeleton class="h-6 w-1/3" />
          <UiSkeleton class="h-32 w-full" />
        </div>
      </div>
    </div>

    <div v-else-if="error || !novelData?.novel" class="border border-dashed border-accent p-12 text-center bg-paper">
      <h3 class="font-heading text-2xl font-black text-accent mb-2">Novel Not Found</h3>
      <p class="text-sm text-ink-muted mb-6">The novel you are trying to view does not exist in our library archives.</p>
      <NuxtLink to="/novels" class="px-5 py-2 bg-ink text-paper hover:bg-accent font-ui font-semibold text-sm transition-colors">
        Return to Gazette
      </NuxtLink>
    </div>

    <div v-else class="space-y-8 sm:space-y-10">
      <!-- ===== curated MASTHEAD GRID ===== -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        <!-- Cover Art Panel (Col span 4) -->
        <div class="lg:col-span-4">
          <div class="border-4 border-ink p-2 bg-white">
            <div class="border border-rule bg-surface-sunken overflow-hidden relative" style="aspect-ratio: 3 / 4;">
              <NuxtImg 
                v-if="novelData.novel.coverUrl"
                :src="novelData.novel.coverUrl"
                :alt="`Volume Cover for ${novelData.novel.title}`"
                width="300"
                height="400"
                loading="eager"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex flex-col items-center justify-center text-ink-faint">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="square" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292" />
                </svg>
                <span class="font-mono text-xs uppercase">No Cover Art</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Novel Description Panel (Col span 8) -->
        <div class="lg:col-span-8 flex flex-col justify-between">
          <div>
            <div class="flex flex-wrap gap-2 mb-4">
              <span 
                v-for="tag in novelData.novel.genreTags" 
                :key="tag"
                class="font-mono text-[10px] tracking-widest uppercase border border-ink px-2 py-0.5"
              >
                {{ tag }}
              </span>
            </div>

            <h1 class="font-heading text-3xl sm:text-4xl md:text-5xl font-black mb-1 tracking-tight leading-tight">
              {{ novelData.novel.title }}
            </h1>
            <p v-if="novelData.novel.originalTitle" class="font-body text-base italic text-ink-muted mb-4">
              Original: {{ novelData.novel.originalTitle }}
            </p>

            <!-- Book Metadata Table -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 border-y-2 border-ink py-4 mb-6 font-mono text-xs text-ink-muted">
              <div>
                <span class="block uppercase text-[10px] text-ink font-bold mb-0.5">Author</span>
                <span class="text-ink-light font-medium">{{ novelData.novel.author }}</span>
              </div>
              <div v-if="novelData.novel.illustrator">
                <span class="block uppercase text-[10px] text-ink font-bold mb-0.5">Illustrations</span>
                <span class="text-ink-light font-medium">{{ novelData.novel.illustrator }}</span>
              </div>
              <div>
                <span class="block uppercase text-[10px] text-ink font-bold mb-0.5">Status</span>
                <span class="font-bold text-accent uppercase">{{ novelData.novel.status }}</span>
              </div>
              <div>
                <span class="block uppercase text-[10px] text-ink font-bold mb-0.5">Published</span>
                <span class="text-ink-light font-medium">{{ novelData.novel.year || 'Unknown' }}</span>
              </div>
            </div>

            <!-- Synopsis Section -->
            <div class="prose max-w-none">
              <h3 class="font-heading text-lg font-black uppercase mb-2 border-b border-rule pb-1 tracking-tight">
                curated Synopsis
              </h3>
              <p class="font-body text-base leading-relaxed text-ink-light whitespace-pre-line">
                {{ novelData.novel.synopsis }}
              </p>
            </div>
          </div>

          <!-- Library Bookmark & Read Actions -->
          <div class="flex flex-wrap items-center gap-3 pt-6 border-t border-rule mt-6">
            <!-- Bookmark Button -->
            <div class="relative" ref="bookmarkDropdownRef">
              <button
                @click="isBookmarkDropdownOpen = !isBookmarkDropdownOpen"
                :disabled="isBookmarkPending"
                class="touch-target px-5 py-2.5 font-ui font-semibold text-sm tracking-wider uppercase inline-flex items-center gap-2 transition-colors disabled:opacity-70 border-2 border-ink hover:bg-ink hover:text-paper"
                :class="bookmark ? 'bg-surface-raised text-ink' : 'bg-transparent text-ink'"
                :aria-expanded="isBookmarkDropdownOpen"
              >
                <svg v-if="isBookmarkPending" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <svg v-else-if="bookmark" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="square" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                </svg>
                <span v-if="isBookmarkPending">Saving...</span>
                <span v-else>{{ bookmark ? `Bookmarked: ${bookmark.status.replace(/_/g, ' ')}` : 'Add to Library' }}</span>
                <svg v-if="!isBookmarkPending" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform" :class="isBookmarkDropdownOpen ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="square" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <Transition name="fade">
                <div
                  v-if="isBookmarkDropdownOpen"
                  class="absolute left-0 mt-1.5 w-52 border border-ink bg-surface shadow-md z-10"
                >
                  <div class="py-1">
                    <p class="px-4 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Set reading status</p>
                    <button @click="selectBookmarkStatus('reading')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-raised font-ui font-medium transition-colors flex items-center gap-2" :class="bookmark?.status === 'reading' ? 'text-accent font-semibold' : ''">
                      <span class="w-1.5 h-1.5 bg-success" v-if="bookmark?.status === 'reading'"></span>
                      Reading
                    </button>
                    <button @click="selectBookmarkStatus('plan_to_read')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-raised font-ui font-medium transition-colors flex items-center gap-2" :class="bookmark?.status === 'plan_to_read' ? 'text-accent font-semibold' : ''">
                      <span class="w-1.5 h-1.5 bg-success" v-if="bookmark?.status === 'plan_to_read'"></span>
                      Plan to Read
                    </button>
                    <button @click="selectBookmarkStatus('on_hold')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-raised font-ui font-medium transition-colors flex items-center gap-2" :class="bookmark?.status === 'on_hold' ? 'text-accent font-semibold' : ''">
                      <span class="w-1.5 h-1.5 bg-success" v-if="bookmark?.status === 'on_hold'"></span>
                      On Hold
                    </button>
                    <button @click="selectBookmarkStatus('completed')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-raised font-ui font-medium transition-colors flex items-center gap-2" :class="bookmark?.status === 'completed' ? 'text-accent font-semibold' : ''">
                      <span class="w-1.5 h-1.5 bg-success" v-if="bookmark?.status === 'completed'"></span>
                      Completed
                    </button>
                    <div v-if="bookmark" class="border-t border-rule mt-1 pt-1">
                      <button @click="selectBookmarkStatus('none')" class="w-full text-left px-4 py-2.5 text-sm text-accent hover:bg-surface-raised font-ui font-medium transition-colors">Remove Bookmark</button>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Start reading button -->
            <NuxtLink
              v-if="novelData.chapters.length > 0"
              :to="`/read/${novelData.chapters[0].id}`"
              class="touch-target px-5 py-2.5 border-2 border-ink hover:bg-ink hover:text-paper font-ui font-semibold text-sm tracking-wider uppercase transition-colors"
            >
              Start Reading (Chapter 1)
            </NuxtLink>

          </div>
        </div>
      </section>

      <!-- ===== BOTTOM curated TABS SYSTEM ===== -->
      <section class="border border-ink bg-surface">
        <UiTabs v-model="activeTab" :tabs="tabs">
          <template #default="{ activeTab }">
            <!-- CHAPTERS LIST TAB -->
            <div v-if="activeTab === 'chapters'" class="p-4 sm:p-6">
              <div class="border-b border-ink pb-2 mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between font-mono text-[10px] sm:text-xs uppercase tracking-wider text-ink-muted">
                <span>Manuskrip Bab (Chapters)</span>
                <span>Word Count &bull; Translator</span>
              </div>

              <div v-if="novelData.chapters.length > 0" class="divide-y divide-rule">
                <div 
                  v-for="chapter in novelData.chapters" 
                  :key="chapter.id"
                  class="py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-surface-raised px-2 transition-colors"
                >
                  <div class="flex items-start gap-3 min-w-0">
                    <span 
                      class="w-5 h-5 flex items-center justify-center border font-mono text-[10px] font-black"
                      :class="libraryStore.isChapterRead(chapter.id) ? 'bg-success text-white border-success' : 'border-rule text-ink-faint'"
                      title="Read status indicator"
                    >
                      ✓
                    </span>

                    <NuxtLink 
                      :to="`/read/${chapter.id}`" 
                      class="font-heading text-sm sm:text-base font-bold hover:text-accent transition-colors wrap-break-word leading-tight"
                    >
                      Chapter {{ chapter.chapterNumber }}: {{ chapter.title }}
                    </NuxtLink>
                  </div>

                  <div class="flex flex-wrap items-center gap-3 sm:gap-6 font-mono text-[10px] sm:text-xs text-ink-muted">
                    <span class="hidden sm:inline">{{ chapter.wordCount }} words</span>
                    <span class="italic font-medium">{{ chapter.translatorGroup || 'Malaz Scans' }}</span>
                    <NuxtLink 
                      :to="`/read/${chapter.id}`"
                      class="px-2 py-0.5 border border-ink hover:bg-ink hover:text-paper text-[10px] uppercase font-bold"
                    >
                      Read
                    </NuxtLink>
                  </div>
                </div>
              </div>

              <div v-else class="text-center py-8 text-ink-muted font-mono text-sm">
                No chapters published yet. Stay tuned for translations!
              </div>
            </div>

            <!-- VOLUMES LIST TAB -->
            <div v-if="activeTab === 'volumes'" class="p-4 sm:p-6">
              <div v-if="novelData.volumes.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <div 
                  v-for="volume in novelData.volumes" 
                  :key="volume.id"
                  class="border border-rule bg-paper p-3 sm:p-4"
                >
                  <div class="bg-surface-sunken border border-rule mb-3 overflow-hidden" style="aspect-ratio: 3 / 4;">
                    <NuxtImg 
                      v-if="volume.coverUrl"
                      :src="volume.coverUrl"
                      :alt="volume.title"
                      width="200"
                      height="280"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <h4 class="font-heading text-lg font-black mb-1">Volume {{ volume.volumeNumber }}</h4>
                  <p class="font-body text-sm font-semibold mb-2">{{ volume.title }}</p>
                  <p class="text-xs text-ink-muted line-clamp-3 leading-relaxed font-body">{{ volume.synopsis || 'No synopsis added.' }}</p>
                </div>
              </div>
              <div v-else class="text-center py-8 text-ink-muted font-mono text-sm">
                No individual volumes cataloged yet.
              </div>
            </div>

            <!-- REVIEWS & RATINGS TAB -->
            <div v-if="activeTab === 'reviews'" class="p-4 sm:p-6">
              <div class="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
                <!-- SVG Distribution Chart (Col span 5) -->
                <div class="md:col-span-5 border border-rule p-3 sm:p-4 bg-paper">
                  <h4 class="font-heading text-lg font-black mb-4 uppercase tracking-tight">Rating Breakdown</h4>
                  
                  <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                    <div class="text-center shrink-0">
                      <span class="font-heading text-4xl font-extrabold text-accent leading-none">
                        {{ novelData.novel.avgRating ? Number(novelData.novel.avgRating).toFixed(1) : '—' }}
                      </span>
                      <span class="block text-[10px] font-mono text-ink-muted uppercase tracking-wider mt-1">
                        Out of 5.0
                      </span>
                    </div>
                    <div class="text-xs font-mono text-ink-muted">
                      Based on <strong class="text-ink font-semibold">{{ novelData.novel.ratingCount }} ratings</strong> cataloged in this issue.
                    </div>
                  </div>

                  <!-- Bar graphics of breakdown -->
                  <div class="space-y-2">
                    <div 
                      v-for="star in [5, 4, 3, 2, 1]" 
                      :key="star"
                      class="flex items-center gap-2 text-xs font-mono"
                    >
                      <span class="w-3 text-right">{{ star }}</span>
                      <div class="flex-1 h-3 bg-surface-sunken border border-rule relative overflow-hidden">
                        <div 
                          class="h-full bg-accent transition-all duration-500" 
                          :style="{ width: `${getRatingPercentage(star)}%` }"
                        ></div>
                      </div>
                      <span class="w-8 text-right text-ink-muted">{{ getRatingPercentage(star) }}%</span>
                    </div>
                  </div>

                  <!-- Sub ratings metrics -->
                  <div v-if="novelData.ratings.subRatings" class="mt-6 pt-4 border-t border-rule grid grid-cols-1 sm:grid-cols-3 gap-2 text-center font-mono text-[10px] text-ink-muted uppercase">
                    <div>
                      <span class="block text-ink font-bold">Story</span>
                      <span class="text-accent text-sm font-black">{{ novelData.ratings.subRatings.avgStory || '—' }}</span>
                    </div>
                    <div>
                      <span class="block text-ink font-bold">Translation</span>
                      <span class="text-accent text-sm font-black">{{ novelData.ratings.subRatings.avgTranslation || '—' }}</span>
                    </div>
                    <div>
                      <span class="block text-ink font-bold">Characters</span>
                      <span class="text-accent text-sm font-black">{{ novelData.ratings.subRatings.avgCharacters || '—' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Submit rating area & reviews list (Col span 7) -->
                <div class="md:col-span-7 space-y-4 sm:space-y-6">
                  <div class="border border-ink p-3 sm:p-4 bg-surface-raised flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 class="font-heading text-base font-bold">Inspect & Review</h4>
                      <p class="text-xs text-ink-muted font-mono">Submit your technical evaluation to the forum.</p>
                    </div>
                    <button 
                      @click="isRatingModalOpen = true"
                      class="touch-target px-4 py-2 bg-ink text-paper hover:bg-accent font-ui text-xs uppercase font-bold tracking-wider transition-colors"
                    >
                      Rate Manuscript
                    </button>
                  </div>

                  <div class="prose">
                    <h4 class="font-heading text-lg font-black border-b border-rule pb-1.5 uppercase">Reader Reviews</h4>
                    <!-- Reviews list could be query fetched here. Currently we show the rating counts. -->
                    <p class="text-sm font-body text-ink-muted italic">
                      Individual evaluation logs can be viewed in the Community Board tab. Submit your score to enrich our metrics!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </UiTabs>
      </section>
    </div>

    <!-- Rating modal overlay -->
    <LazyUiModal v-model:open="isRatingModalOpen" title="Manuscript Evaluation Form">
      <form @submit.prevent="submitRating" class="space-y-4 font-mono text-xs">
        <div>
          <label class="block uppercase font-bold text-ink-muted mb-1">Overall Critique Score (1-5)</label>
          <UiStarRating v-model="userRating.overall" />
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block uppercase font-bold text-ink-muted mb-1">Story</label>
            <UiStarRating v-model="userRating.story" size="sm" />
          </div>
          <div>
            <label class="block uppercase font-bold text-ink-muted mb-1">Translation</label>
            <UiStarRating v-model="userRating.translation" size="sm" />
          </div>
          <div>
            <label class="block uppercase font-bold text-ink-muted mb-1">Characters</label>
            <UiStarRating v-model="userRating.characters" size="sm" />
          </div>
        </div>
        <div>
          <label class="block uppercase font-bold text-ink-muted mb-1">Written Critique Log (Optional)</label>
          <UiTextarea
            v-model="userRating.reviewText"
            placeholder="Document your curated findings and review remarks here..."
            :rows="4"
          />
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-rule">
          <UiButton 
            type="button" 
            variant="secondary" 
            @click="isRatingModalOpen = false"
          >
            Cancel
          </UiButton>
          <UiButton 
            type="submit" 
            variant="primary" 
            :loading="isSubmittingRating"
          >
            Submit Gazette Evaluation
          </UiButton>
        </div>
      </form>
    </LazyUiModal>
  </div>
</template>
