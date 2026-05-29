<script setup lang="ts">
import { useSearchStore } from '~/stores/search'
import { watch, onMounted, onUnmounted, computed, ref, defineAsyncComponent } from 'vue'

const searchStore = useSearchStore()
const route = useRoute()
const router = useRouter()

// Standard lists
const genres = ['Action', 'Fantasy', 'Adventure', 'Sci-Fi', 'Romance', 'Mystery', 'Slice of Life', 'Drama', 'Historical', 'Psychological']
const statuses = [
  { label: 'All Statuses', value: '' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Hiatus', value: 'hiatus' },
  { label: 'Completed', value: 'completed' },
]
const sorts = [
  { label: 'Latest Updates', value: 'latest' },
  { label: 'Highest Ratings', value: 'rating' },
  { label: 'Popularity', value: 'popular' },
  { label: 'Alphabetical A-Z', value: 'title' },
]

const itemsPerPage = 12
const isSyncingRoute = ref(false)

const AsyncPagination = defineAsyncComponent(() => import('~/components/ui/UiPagination.vue'))

const selectedGenresLabel = computed(() => {
  const selected = searchStore.filters.genre
  if (selected.length === 0) return 'All Genres'
  if (selected.length === 1) return selected[0]
  return `${selected.length} Genres Selected`
})

const currentPage = computed({
  get: () => {
    const pageValue = typeof route.query.page === 'string' ? Number.parseInt(route.query.page, 10) : 1
    return Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1
  },
  set: (page) => {
    syncRoute({ page: String(Math.max(1, page)) })
  },
})

const routeQueryString = computed(() => JSON.stringify(route.query))

const readStringQuery = (value: unknown) => (typeof value === 'string' ? value : '')

const routeQuery = computed(() => {
  const search = readStringQuery(route.query.search)
  const status = readStringQuery(route.query.status)
  const author = readStringQuery(route.query.author)
  const year = readStringQuery(route.query.year)
  const sort = readStringQuery(route.query.sort) || 'latest'
  const genre = readStringQuery(route.query.genre)

  return {
    page: currentPage.value,
    search,
    status,
    author,
    year,
    sort,
    genre,
  }
})

const buildQuery = (page = currentPage.value) => {
  const query: Record<string, string> = {
    page: String(Math.max(1, page)),
  }

  const search = searchStore.query.trim()
  const author = searchStore.filters.author.trim()
  const year = searchStore.filters.year.trim()
  const genre = searchStore.filters.genre.filter(Boolean).join(',')

  if (search) query.search = search
  if (searchStore.filters.status) query.status = searchStore.filters.status
  if (author) query.author = author
  if (year) query.year = year
  if (searchStore.filters.sort) query.sort = searchStore.filters.sort
  if (genre) query.genre = genre

  return query
}

async function syncRoute(overrides: Record<string, string> = {}) {
  if (isSyncingRoute.value) return

  const nextQuery = { ...buildQuery(), ...overrides }
  const normalizedNext = JSON.stringify(nextQuery)

  if (normalizedNext === routeQueryString.value) return

  isSyncingRoute.value = true
  try {
    await router.replace({ query: nextQuery })
  } finally {
    queueMicrotask(() => {
      isSyncingRoute.value = false
    })
  }
}

const syncFromRoute = () => {
  isSyncingRoute.value = true

  searchStore.setQuery(readStringQuery(route.query.search))
  searchStore.setFilter('status', readStringQuery(route.query.status))
  searchStore.setFilter('author', readStringQuery(route.query.author))
  searchStore.setFilter('year', readStringQuery(route.query.year))
  searchStore.setFilter('sort', readStringQuery(route.query.sort) || 'latest')

  searchStore.filters.genre = []
  const genreQuery = readStringQuery(route.query.genre)
  if (genreQuery) {
    genreQuery.split(',').forEach((g) => {
      const normalizedGenre = g.trim()
      if (normalizedGenre && !searchStore.filters.genre.includes(normalizedGenre)) {
        searchStore.filters.genre.push(normalizedGenre)
      }
    })
  }

  queueMicrotask(() => {
    isSyncingRoute.value = false
  })
}

const fetchParams = computed(() => {
  const params: Record<string, string | number> = {
    page: routeQuery.value.page,
    limit: itemsPerPage,
  }

  const query = routeQuery.value

  if (query.search) params.search = query.search
  if (query.status) params.status = query.status
  if (query.author) params.author = query.author
  if (query.year) params.year = query.year
  if (query.sort) params.sort = query.sort
  if (query.genre) params.genre = query.genre

  return params
})

// Ensure store is initialized from the route during setup (SSR + client)
try {
  syncFromRoute()
} catch (e) {
  // swallow any unexpected errors during initial sync
}

const { data: novelsData, pending, refresh } = await useFetch('/api/novels', {
  query: () => fetchParams.value,
})

// Secondary data — non-blocking
const { data: trending } = useFetch('/api/novels', {
  query: { sort: 'popular', limit: 5 },
  lazy: true,
})

onMounted(syncFromRoute)

watch(() => route.fullPath, () => {
  syncFromRoute()
})

let _syncDebounce: ReturnType<typeof setTimeout> | null = null
watch(
  () => [
    searchStore.query,
    searchStore.filters.genre.join(','),
    searchStore.filters.status,
    searchStore.filters.author,
    searchStore.filters.year,
    searchStore.filters.sort,
    currentPage.value,
  ],
  () => {
    if (isSyncingRoute.value) return
    if (_syncDebounce) clearTimeout(_syncDebounce)
    _syncDebounce = setTimeout(() => {
      syncRoute()
      _syncDebounce = null
    }, 250)
  },
)

onUnmounted(() => {
  if (_syncDebounce) clearTimeout(_syncDebounce)
})

const resetFilters = () => {
  searchStore.clearFilters()
  searchStore.setQuery('')
  currentPage.value = 1
  syncRoute({ page: '1' })
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Mobile filters drawer state — separate from searchStore.isFiltersOpen so it's purely local UI
const isMobileFiltersOpen = ref(false)

const toggleMobileFilters = () => {
  isMobileFiltersOpen.value = !isMobileFiltersOpen.value
}

// Close mobile filters when a filter is applied (sync to URL)
watch(fetchParams, () => {
  // don't auto-close — let user close manually
})

useHead({
  title: 'Browse Serials',
  meta: [
    { name: 'description', content: 'Search and filter the complete archive of premium light novels on Malaz Scans.' }
  ]
})
</script>

<template>
  <div class="container-curated py-8">
    <!-- ===== PAGE TITLE ===== -->
    <div class="border-b-4 border-ink pb-4 mb-8">
      <h2 class="font-heading text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight">
        Bookshelf
      </h2>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        Browse, filter, and discover cataloged chapters &middot; {{ novelsData?.pagination?.total || 0 }} Entries Found
      </p>
    </div>

    <!-- ===== MOBILE FILTERS TOGGLE BAR ===== -->
    <div class="lg:hidden mb-4">
      <button
        type="button"
        @click="toggleMobileFilters"
        class="w-full flex items-center justify-between px-4 py-3 border border-ink bg-paper font-mono text-xs uppercase font-bold tracking-wider transition-colors hover:bg-surface-raised"
        :aria-expanded="isMobileFiltersOpen"
        aria-controls="browse-filters-panel"
      >
        <span class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="square" d="M3 4h18M7 8h10M11 12h2" />
          </svg>
          Filters &amp; Sorting
        </span>
        <span class="flex items-center gap-2">
          <span v-if="searchStore.activeFilterCount > 0" class="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
            {{ searchStore.activeFilterCount }} active
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 transition-transform duration-200"
            :class="isMobileFiltersOpen ? 'rotate-180' : ''"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
          >
            <path stroke-linecap="square" d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <!-- ===== FILTERS SIDEBAR ===== -->
      <aside class="lg:col-span-3">
        <!-- Mobile filters panel — collapsible -->
        <Transition name="filter-slide">
          <div
            v-show="isMobileFiltersOpen"
            id="browse-filters-panel"
            class="lg:hidden border border-ink bg-paper mb-4 overflow-hidden"
          >
            <div class="p-5 space-y-5">
              <div class="flex items-center justify-between border-b border-ink pb-2">
                <h3 class="font-heading text-base font-black uppercase tracking-tight text-ink">
                  Filters
                </h3>
                <button
                  v-if="searchStore.hasActiveFilters || searchStore.query"
                  type="button"
                  @click="resetFilters"
                  class="font-mono text-[10px] uppercase text-accent hover:underline font-bold"
                >
                  Reset All
                </button>
              </div>

              <!-- Status Filter (Mobile) -->
              <div class="space-y-2">
                <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Status</label>
                <UiSelect
                  :model-value="searchStore.filters.status || routeQuery.status"
                  @update:model-value="(v) => searchStore.setFilter('status', v)"
                  :options="statuses"
                />
              </div>

              <!-- Genre Divisions (Mobile) — inline checkboxes, no nested dropdown -->
              <div class="space-y-2">
                <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Genre Divisions</label>
                <div class="border border-ink-faint bg-surface p-3 space-y-2 max-h-48 overflow-y-auto">
                  <label
                    v-for="genre in genres"
                    :key="'mobile-' + genre"
                    class="flex items-center gap-3 py-1 cursor-pointer text-sm font-ui text-ink hover:text-accent transition-colors"
                  >
                    <input
                      type="checkbox"
                      :checked="searchStore.filters.genre.includes(genre)"
                      @change="searchStore.toggleGenre(genre)"
                      class="w-4 h-4 border-ink accent-[--color-accent] cursor-pointer shrink-0"
                    />
                    <span class="select-none">{{ genre }}</span>
                  </label>
                </div>
              </div>

              <!-- Sort (Mobile) -->
              <div class="space-y-2">
                <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Sort By</label>
                <UiSelect
                  :model-value="searchStore.filters.sort || routeQuery.sort"
                  @update:model-value="(v) => searchStore.setFilter('sort', v)"
                  :options="sorts"
                />
              </div>

              <!-- Author Filter (Mobile) -->
              <div class="space-y-2">
                <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Author</label>
                <UiInput
                  :model-value="searchStore.filters.author || routeQuery.author"
                  @update:model-value="(v) => searchStore.setFilter('author', v)"
                  placeholder="Author's name..."
                  type="text"
                />
              </div>

              <!-- Year Filter (Mobile) -->
              <div class="space-y-2">
                <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Release Year</label>
                <UiInput
                  :model-value="searchStore.filters.year || routeQuery.year"
                  @update:model-value="(v) => searchStore.setFilter('year', v)"
                  placeholder="e.g. 2026"
                  type="text"
                />
              </div>

              <!-- Apply button on mobile -->
              <button
                type="button"
                @click="isMobileFiltersOpen = false"
                class="w-full py-2.5 bg-ink text-paper hover:bg-accent font-mono text-xs uppercase font-bold tracking-wider transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </Transition>

        <!-- Desktop filters — always visible, no max-height constraint -->
        <div class="hidden lg:block border border-ink bg-paper p-5 space-y-5 sticky top-24">
          <div class="flex items-center justify-between border-b border-ink pb-2">
            <h3 class="font-heading text-lg font-black uppercase tracking-tight text-ink">
              Filter
            </h3>
            <button
              v-if="searchStore.hasActiveFilters || searchStore.query"
              type="button"
              @click="resetFilters"
              class="font-mono text-[10px] uppercase text-accent hover:underline font-bold"
            >
              Reset All
            </button>
          </div>

          <!-- Status Filter (Desktop) -->
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Status</label>
            <UiSelect
              :model-value="searchStore.filters.status || routeQuery.status"
              @update:model-value="(v) => searchStore.setFilter('status', v)"
              :options="statuses"
            />
          </div>

          <!-- Genre Divisions (Desktop) — simple inline checkboxes -->
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Genre Divisions</label>
            <div class="border border-ink-faint bg-surface p-3 space-y-2">
              <label
                v-for="genre in genres"
                :key="'desktop-' + genre"
                class="flex items-center gap-3 py-0.5 cursor-pointer text-sm font-ui text-ink hover:text-accent transition-colors"
              >
                <input
                  type="checkbox"
                  :checked="searchStore.filters.genre.includes(genre)"
                  @change="searchStore.toggleGenre(genre)"
                  class="w-4 h-4 border-ink accent-[--color-accent] cursor-pointer shrink-0"
                />
                <span class="select-none">{{ genre }}</span>
              </label>
            </div>
          </div>

          <!-- Author Search Input (Desktop) -->
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Author</label>
            <UiInput
              :model-value="searchStore.filters.author || routeQuery.author"
              @update:model-value="(v) => searchStore.setFilter('author', v)"
              placeholder="Author's name..."
              type="text"
            />
          </div>

          <!-- Year Filter (Desktop) -->
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">Release Year</label>
            <UiInput
              :model-value="searchStore.filters.year || routeQuery.year"
              @update:model-value="(v) => searchStore.setFilter('year', v)"
              placeholder="e.g. 2026"
              type="text"
            />
          </div>
        </div>
      </aside>

      <!-- ===== MAIN ARCHIVE GRID (Col span 9) ===== -->
      <main class="lg:col-span-9 space-y-5">
        <!-- Search bar & Sorting bar -->
        <div class="border border-ink p-4 bg-paper flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div class="flex-1">
            <UiInput
              :model-value="searchStore.query || routeQuery.search"
              @update:model-value="(v) => searchStore.setQuery(v)"
              placeholder="Fuzzy search titles..."
              type="text"
              class="w-full"
            >
              <template #prefix>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="square" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </template>
            </UiInput>
          </div>

          <!-- Sort — shown inline on desktop, also available in mobile filters -->
          <div class="hidden sm:flex items-center gap-2 shrink-0">
            <span class="font-mono text-xs text-ink-muted uppercase whitespace-nowrap">Sort:</span>
            <UiSelect
              :model-value="searchStore.filters.sort || routeQuery.sort"
              @update:model-value="(v) => searchStore.setFilter('sort', v)"
              :options="sorts"
              class="w-44"
            />
          </div>
        </div>

        <!-- Active filter chips (visual feedback) -->
        <div v-if="searchStore.hasActiveFilters || searchStore.query" class="flex flex-wrap gap-2">
          <span
            v-if="searchStore.query"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-ink bg-surface font-mono text-[10px] uppercase"
          >
            Search: {{ searchStore.query }}
            <button
              type="button"
              @click="searchStore.setQuery('')"
              class="text-accent hover:text-accent-dark ml-1"
              aria-label="Clear search"
            >×</button>
          </span>
          <span
            v-if="searchStore.filters.status"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-ink bg-surface font-mono text-[10px] uppercase"
          >
            {{ searchStore.filters.status }}
            <button
              type="button"
              @click="searchStore.setFilter('status', '')"
              class="text-accent hover:text-accent-dark ml-1"
              aria-label="Clear status filter"
            >×</button>
          </span>
          <span
            v-for="genre in searchStore.filters.genre"
            :key="genre"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-ink bg-surface font-mono text-[10px] uppercase"
          >
            {{ genre }}
            <button
              type="button"
              @click="searchStore.toggleGenre(genre)"
              class="text-accent hover:text-accent-dark ml-1"
              :aria-label="`Remove ${genre} filter`"
            >×</button>
          </span>
        </div>

        <!-- Catalog list with state indicator -->
        <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div v-for="i in 6" :key="i" class="border border-rule p-4 space-y-4">
            <div class="flex gap-4">
              <UiSkeleton class="w-20 h-28 shrink-0" />
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

        <!-- Render entries -->
        <div v-else-if="novelsData?.data?.length" class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div
            v-for="novel in novelsData.data"
            :key="novel.id"
            class="border border-rule hover:border-ink transition-colors bg-surface flex flex-col justify-between group"
          >
            <div class="p-4 border-b border-rule flex gap-4">
              <NuxtLink :to="`/novels/${novel.slug}`" class="w-20 h-28 bg-surface-sunken shrink-0 border border-rule overflow-hidden block">
                <NuxtImg
                  v-if="novel.coverUrl"
                  :src="novel.coverUrl"
                  :alt="`Cover for ${novel.title}`"
                  width="200"
                  height="280"
                  loading="lazy"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div v-else class="w-full h-full flex items-center justify-center bg-surface-sunken text-ink-faint">
                  <span class="font-mono text-[9px] uppercase">No Cover</span>
                </div>
              </NuxtLink>

              <div class="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <span class="font-mono text-[9px] tracking-wider uppercase text-accent font-bold">
                      {{ novel.genreTags[0] || 'Serial' }}
                    </span>
                    <UiBookmarkButton :novel-id="novel.id" size="sm" :icon-only="true" />
                  </div>
                  <NuxtLink :to="`/novels/${novel.slug}`" class="block">
                    <h4 class="font-heading text-sm sm:text-base lg:text-lg font-bold leading-tight tracking-tight whitespace-nowrap overflow-hidden text-ellipsis hover:text-accent transition-colors mt-0.5">
                      {{ novel.title }}
                    </h4>
                  </NuxtLink>
                  <p class="text-xs text-ink-muted font-mono mt-1 truncate">By {{ novel.author }}</p>
                </div>
                <div class="flex items-center justify-between text-xs font-mono pt-2">
                  <span class="text-ink-muted">{{ novel.totalChapters }} chapters</span>
                  <span class="flex items-center gap-0.5 text-accent font-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                    {{ novel.avgRating ? Number(novel.avgRating).toFixed(1) : '—' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Card Bottom Bar -->
            <div class="px-4 py-2.5 bg-surface-raised flex items-center justify-between text-xs">
              <span class="font-mono text-ink-muted">Published &bull; {{ novel.year || 'Unknown' }}</span>
              <NuxtLink
                :to="`/novels/${novel.slug}`"
                class="font-mono uppercase font-bold hover:text-accent flex items-center gap-0.5 transition-colors"
              >
                Inspect
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="square" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- No data found fallback -->
        <div v-else class="border border-dashed border-rule bg-paper w-full max-w-5xl mx-auto p-6 sm:p-8 lg:p-10 text-center">
          <div class="space-y-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-14 h-14 mx-auto text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="square" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>

            <div class="space-y-4">
              <h4 class="font-heading text-xl sm:text-2xl font-black leading-tight tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full mx-auto">No Records Found</h4>
              <p class="text-sm sm:text-base text-ink-muted max-w-4xl mx-auto leading-relaxed sm:leading-8 tracking-normal">
                We couldn't find any light novels matching your query or filter configurations. Please refine your search.
              </p>
              <button
                type="button"
                @click="resetFilters"
                class="px-5 py-2.5 bg-ink text-paper hover:bg-accent font-ui text-sm font-semibold transition-colors min-h-11 mx-auto"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div
          v-if="novelsData?.pagination && novelsData.pagination.totalPages > 1"
          class="flex justify-center pt-4 border-t border-rule"
        >
          <component :is="AsyncPagination"
            :currentPage="currentPage"
            :totalPages="novelsData.pagination.totalPages"
            @page-change="handlePageChange"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Mobile filter slide-down animation */
.filter-slide-enter-active,
.filter-slide-leave-active {
  transition: max-height 300ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.filter-slide-enter-from,
.filter-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.filter-slide-enter-to,
.filter-slide-leave-from {
  max-height: 800px;
  opacity: 1;
}
</style>
