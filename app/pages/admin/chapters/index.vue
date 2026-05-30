<script setup lang="ts">
import { ref, watch, computed } from 'vue'

definePageMeta({
  layout: 'admin',
  ssr: false
})

// Fetch all novels to choose from (non-blocking)
const { data: novelsData } = useFetch('/api/novels', {
  query: { limit: 100 },
})

const selectedNovelId = ref('')
const selectedNovelSlug = ref('')

// Find selected novel details
const selectedNovel = computed(() => {
  if (!novelsData.value?.data) return null
  return novelsData.value.data.find(n => n.id === selectedNovelId.value)
})

// Watch novel change to update slug
watch(selectedNovelId, (newId) => {
  const match = novelsData.value?.data?.find(n => n.id === newId)
  if (match) {
    selectedNovelSlug.value = match.slug
  } else {
    selectedNovelSlug.value = ''
  }
})

// Fetch chapters for the selected novel dynamically (non-blocking)
const { data: novelDetails, pending: chaptersPending } = useAsyncData(
  'novelChaptersAdmin',
  async () => {
    if (!selectedNovelSlug.value) return null
    return await $fetch<any>(`/api/novels/${selectedNovelSlug.value}`)
  },
  {
    watch: [selectedNovelSlug],
    immediate: false,
    default: () => null,
  },
)
</script>

<template>
  <div class="space-y-8 font-ui">
    <!-- ===== HEADER ===== -->
    <div class="border-b-4 border-ink pb-4">
      <h2 class="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight">
        Chapters
      </h2>
      <p class="font-mono text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">
        Manage chapter lists
      </p>
    </div>

    <!-- ===== SELECT SERIAL DIVISION ===== -->
    <div class="border border-ink p-4 bg-paper flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div class="w-full sm:w-2/3 flex items-center gap-2">
        <span class="font-mono text-xs text-ink-muted uppercase whitespace-nowrap">Select novel:</span>
        <select 
          v-model="selectedNovelId"
          class="w-full px-3 py-2 bg-surface border border-rule focus:border-accent focus:outline-none text-xs font-mono"
        >
          <option value="">-- Choose a novel --</option>
          <option 
            v-for="n in novelsData?.data" 
            :key="n.id" 
            :value="n.id"
          >
            {{ n.title }}
          </option>
        </select>
      </div>

      <NuxtLink 
        v-if="selectedNovelId"
        :to="`/admin/chapters/new?novelId=${selectedNovelId}`"
        class="touch-target px-4 py-2 bg-accent text-white font-mono text-[10px] uppercase font-bold tracking-wider hover:bg-accent-dark transition-colors inline-flex items-center gap-1"
      >
        <span>&#x2b;</span> New Chapter
      </NuxtLink>
    </div>

    <!-- ===== MANUSCRIPT FEED ===== -->
    <main v-if="!selectedNovelId" class="border border-dashed border-rule p-12 text-center bg-paper">
      <h4 class="font-heading text-lg font-bold text-ink-muted uppercase">No novel selected</h4>
      <p class="text-xs text-ink-faint font-mono mt-1">Select a novel above to view chapters.</p>
    </main>

    <main v-else-if="chaptersPending" class="space-y-4">
      <UiSkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
    </main>

    <main v-else class="border border-ink bg-surface">
      <div class="px-4 py-2 bg-surface-raised border-b border-ink flex justify-between text-xs font-mono uppercase tracking-wider text-ink-muted">
        <span>Chapters &bull; {{ selectedNovel?.title }}</span>
        <span>Words &bull; Actions</span>
      </div>

      <div v-if="novelDetails?.chapters?.length" class="divide-y divide-rule font-mono text-xs">
        <div 
          v-for="chapter in novelDetails.chapters" 
          :key="chapter.id"
          class="p-4 flex items-center justify-between hover:bg-surface-raised transition-colors gap-4"
        >
          <div class="space-y-0.5">
            <span class="font-bold text-ink text-sm">Chapter {{ chapter.chapterNumber }}: {{ chapter.title }}</span>
            <div class="flex gap-2 text-[10px] text-ink-muted">
              <span>Status: <strong class="text-success uppercase">Published</strong></span>
              <span>&bull; Created: {{ new Date(chapter.createdAt).toLocaleDateString() }}</span>
            </div>
          </div>

          <div class="flex items-center gap-6">
            <span class="text-ink-muted font-bold">{{ chapter.wordCount }} words</span>
            <NuxtLink 
              :to="`/admin/chapters/editor?chapterId=${chapter.id}`"
              class="px-2 py-1 border border-ink hover:bg-ink hover:text-paper uppercase font-bold text-[10px]"
            >
              Edit Draft
            </NuxtLink>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12 text-ink-muted italic font-body text-sm bg-paper">
        No chapters yet. Create one above.
      </div>
    </main>
  </div>
</template>
