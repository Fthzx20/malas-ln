<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useLibraryStore } from '~/stores/library'
import { useToast } from '~/composables/useToast'

const authStore = useAuthStore()
const libraryStore = useLibraryStore()
const toast = useToast()

const activeTab = ref('reading')
const tabs = [
  { label: 'Reading Feed', value: 'reading' },
  { label: 'Plan to Read', value: 'plan_to_read' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Completed Log', value: 'completed' },
]

// Current filtered books
const activeBookmarks = computed(() => {
  if (activeTab.value === 'reading') return libraryStore.reading
  if (activeTab.value === 'plan_to_read') return libraryStore.planToRead
  if (activeTab.value === 'on_hold') return libraryStore.onHold
  if (activeTab.value === 'completed') return libraryStore.completed
  return []
})

const removeBookmark = async (novelId: string) => {
  try {
    await libraryStore.deleteBookmark(novelId)
    toast.info('Removed from Library feed')
  } catch (err) {
    toast.error('Failed to update Library')
  }
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    libraryStore.fetchBookmarks()
  }
})

useHead({
  title: 'My Gazette Library',
  meta: [
    { name: 'description', content: 'Manage your customized Light Novel reading pipeline.' }
  ]
})
</script>

<template>
  <div class="container-editorial py-8">
    <!-- ===== PAGE HEADER ===== -->
    <div class="border-b-4 border-ink pb-4 mb-8 flex flex-col sm:flex-row sm:items-baseline justify-between">
      <div>
        <h2 class="font-heading text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight">
          My Gazette Library
        </h2>
        <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
          Cataloged Serials &middot; Reading logs &middot; Live Progress
        </p>
      </div>
      <div v-if="!authStore.isAuthenticated" class="mt-4 sm:mt-0 font-mono text-xs">
        <span class="text-accent font-bold uppercase mr-2">Guest Profile:</span>
        <span class="text-ink-muted">Tracking local history only</span>
      </div>
    </div>

    <!-- ===== GUEST FALLBACK LOGS ===== -->
    <div v-if="!authStore.isAuthenticated" class="space-y-8">
      <div class="border border-dashed border-accent p-6 text-center bg-paper max-w-2xl mx-auto">
        <h3 class="font-heading text-xl font-bold mb-2">Sign In to sync Library</h3>
        <p class="text-sm text-ink-muted mb-4">
          You are currently reading as a guest. Your bookmark progress, status folders, and evaluation records will not sync across devices.
        </p>
        <NuxtLink 
          to="/auth/login" 
          class="px-5 py-2.5 bg-ink text-paper hover:bg-accent font-ui font-semibold text-sm uppercase tracking-wider inline-block transition-colors"
        >
          Sign In Now
        </NuxtLink>
      </div>

      <!-- Guest local reading history logs -->
      <div class="border border-ink bg-surface p-6">
        <h3 class="font-heading text-xl font-black border-b-2 border-ink pb-2 mb-4 uppercase tracking-tight">
          Local History Log
        </h3>
        <div v-if="libraryStore.localHistory.length > 0" class="divide-y divide-rule font-mono text-xs text-ink-muted">
          <div 
            v-for="entry in libraryStore.localHistory" 
            :key="entry.chapterId"
            class="py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-surface-raised px-2 transition-colors"
          >
            <div class="min-w-0">
              <NuxtLink :to="`/novels/${entry.novelSlug}`" class="font-heading text-sm font-bold text-ink hover:text-accent transition-colors block">
                {{ entry.novelTitle }}
              </NuxtLink>
              <span class="mt-0.5 block">Chapter {{ entry.chapterNumber }}: {{ entry.chapterTitle }}</span>
            </div>
            <div class="flex items-center justify-between sm:justify-end gap-4 flex-wrap">
              <span>Read {{ new Date(entry.readAt).toLocaleDateString() }}</span>
              <NuxtLink 
                :to="`/read/${entry.chapterId}`"
                class="px-2 py-1 border border-ink hover:bg-ink hover:text-paper font-bold uppercase text-[10px]"
              >
                Resume
              </NuxtLink>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-sm italic font-body text-ink-muted">
          No local reading history logged yet.
        </div>
      </div>
    </div>

    <!-- ===== REGISTERED USER FEED ===== -->
    <div v-else class="space-y-8">
      <div class="border border-ink bg-surface">
        <UiTabs v-model="activeTab" :tabs="tabs">
          <template #default="{ activeTab }">
            <div class="p-6">
              <!-- Bookmarks Grid -->
              <div v-if="activeBookmarks.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                  v-for="entry in activeBookmarks" 
                  :key="entry.id"
                  class="border border-rule bg-paper p-4 flex flex-col justify-between"
                >
                  <div class="flex gap-4">
                    <!-- Book Cover -->
                    <NuxtLink :to="`/novels/${entry.novel.slug}`" class="w-16 h-24 bg-surface-sunken border border-rule flex-shrink-0 overflow-hidden">
                      <NuxtImg 
                        v-if="entry.novel.coverUrl"
                        :src="entry.novel.coverUrl"
                        :alt="entry.novel.title"
                        width="64"
                        height="96"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </NuxtLink>

                    <div class="flex-1 flex flex-col justify-between">
                      <div>
                        <span class="font-mono text-[9px] tracking-wider uppercase text-accent font-bold">
                          {{ entry.novel.status }}
                        </span>
                        <NuxtLink :to="`/novels/${entry.novel.slug}`" class="block group">
                          <h4 class="font-heading text-base font-bold leading-tight line-clamp-2 group-hover:text-accent transition-colors">
                            {{ entry.novel.title }}
                          </h4>
                        </NuxtLink>
                        <p class="text-xs text-ink-muted font-mono">By {{ entry.novel.author }}</p>
                      </div>

                      <div class="text-[10px] font-mono text-ink-muted">
                        <span>{{ entry.novel.totalChapters }} Chapters Total</span>
                      </div>
                    </div>
                  </div>

                  <!-- Progress tracking & Quick Resume -->
                  <div class="mt-4 pt-4 border-t border-rule space-y-3">
                    <div v-if="entry.currentChapter" class="flex justify-between items-baseline text-xs font-mono">
                      <span class="text-ink-muted truncate max-w-[70%]">Last: Chapter {{ entry.currentChapter.chapterNumber }}</span>
                      <span class="font-bold text-accent">{{ Math.round(entry.progressPct) }}% Read</span>
                    </div>

                    <!-- Clean progress bar -->
                    <div class="h-2 bg-surface-sunken border border-rule relative overflow-hidden">
                      <div 
                        class="h-full bg-accent transition-all duration-300"
                        :style="{ width: `${entry.progressPct}%` }"
                      ></div>
                    </div>

                    <!-- Quick resume action buttons -->
                    <div class="flex gap-2">
                      <NuxtLink 
                        v-if="entry.currentChapterId"
                        :to="`/read/${entry.currentChapterId}`"
                        class="flex-1 text-center py-1.5 bg-ink text-paper hover:bg-accent font-mono text-[10px] uppercase font-bold tracking-wider transition-colors"
                      >
                        Quick Resume
                      </NuxtLink>
                      <button 
                        @click="removeBookmark(entry.novelId)"
                        class="px-2 py-1.5 border border-rule hover:border-ink hover:text-accent font-mono text-[10px] uppercase font-bold tracking-wider transition-colors min-h-[44px]"
                        title="Remove bookmark"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty status fallback -->
              <div v-else class="py-16 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-14 h-14 mx-auto text-ink-faint mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="square" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18c1.746 0 3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h4 class="font-heading text-xl font-bold mb-2">Nothing cataloged here yet</h4>
                <p class="text-sm font-mono text-ink-muted max-w-sm mx-auto mb-6">
                  You have no serials in this reading folder. Browse the gazette archive to discover and bookmark titles.
                </p>
                <NuxtLink
                  to="/novels"
                  class="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper hover:bg-accent font-ui font-semibold text-sm uppercase tracking-wider transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="square" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Browse Gazette Archive
                </NuxtLink>
              </div>
            </div>
          </template>
        </UiTabs>
      </div>

      <!-- Live statistics dashboard -->
      <div class="border border-ink p-5 bg-paper grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-xs text-ink-muted text-center uppercase">
        <div class="border-r border-rule last:border-r-0 pb-4 md:pb-0">
          <span class="block text-ink font-bold mb-1">Assigned Reading</span>
          <span class="text-accent text-xl font-black">{{ libraryStore.reading.length }}</span>
        </div>
        <div class="border-r border-rule last:border-r-0 pb-4 md:pb-0">
          <span class="block text-ink font-bold mb-1">Completed Log</span>
          <span class="text-accent text-xl font-black">{{ libraryStore.completed.length }}</span>
        </div>
        <div class="border-r border-rule last:border-r-0 pb-4 md:pb-0">
          <span class="block text-ink font-bold mb-1">Plan to Read</span>
          <span class="text-accent text-xl font-black">{{ libraryStore.planToRead.length }}</span>
        </div>
        <div>
          <span class="block text-ink font-bold mb-1">History Entries</span>
          <span class="text-accent text-xl font-black">{{ libraryStore.localHistory.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
