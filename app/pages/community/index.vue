<script setup lang="ts">
useHead({
  title: 'Community Board',
  meta: [
    { name: 'description', content: 'Participate in the Malaz Scans discussion forums. Share feedback, request reviews, and meet other light novel readers.' }
  ]
})

import { computed } from 'vue'

// Fetch all categories with post counts
const { data: forumDataRaw, pending, error } = await useFetch('/api/forum')
const forumData = computed(() => forumDataRaw.value as any)
</script>

<template>
  <div class="container-curated py-8">
    <!-- ===== SECTION HEADER ===== -->
    <div class="border-b-4 border-ink pb-4 mb-8">
      <h2 class="font-heading text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight">
        The Community Board
      </h2>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        General Discussion &bull; Translations Gazette &bull; Reader Feedback
      </p>
    </div>

    <!-- ===== MAIN FORUM GRID ===== -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- Categories listing (Col span 8) -->
      <main class="lg:col-span-8 space-y-6">
        <div class="border-b-2 border-ink pb-2 mb-4">
          <h3 class="font-heading text-xl font-bold uppercase tracking-tight text-ink">
            Forum Divisions
          </h3>
        </div>

        <div v-if="pending" class="space-y-4">
          <UiSkeleton v-for="i in 3" :key="i" class="h-20 w-full" />
        </div>

        <div v-else-if="error || !forumData?.categories?.length" class="border border-dashed border-rule p-8 text-center bg-paper">
          <p class="text-sm font-mono text-ink-muted">No forum divisions have been indexed yet.</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Categories list styled like newspaper columns -->
          <div 
            v-for="cat in forumData.categories" 
            :key="cat.id"
            class="border border-rule hover:border-ink bg-surface p-5 transition-colors flex items-center justify-between gap-4"
          >
            <div class="space-y-1">
              <NuxtLink :to="`/community/${cat.slug}`" class="block group">
                <h4 class="font-heading text-lg font-black group-hover:text-accent transition-colors leading-tight">
                  {{ cat.name }}
                </h4>
              </NuxtLink>
              <p class="text-sm font-body text-ink-muted leading-relaxed">
                {{ cat.description || 'No description supplied.' }}
              </p>
            </div>

            <!-- Post Counts Badge -->
            <NuxtLink 
              :to="`/community/${cat.slug}`"
              class="shrink-0 flex flex-col items-center justify-center w-16 h-16 border border-rule bg-paper hover:bg-surface-sunken transition-colors"
            >
              <span class="font-heading text-lg font-bold text-accent">{{ cat.postCount }}</span>
              <span class="font-mono text-[9px] text-ink-muted uppercase">threads</span>
            </NuxtLink>
          </div>
        </div>
      </main>

      <!-- Sidebar curated Column (Col span 4) -->
      <aside class="lg:col-span-4 space-y-8">
        <!-- Forum rules -->
        <div class="border border-ink p-5 bg-paper">
          <h4 class="font-heading text-lg font-black border-b border-ink pb-1.5 mb-4 uppercase">Board Guidelines</h4>
          <ol class="list-decimal list-inside space-y-3 font-body text-xs text-ink-light leading-relaxed">
            <li><strong>Be civil</strong>: Evaluative debates are encouraged, but harassment is banned.</li>
            <li><strong>No spoilers</strong>: Use appropriate markdown labels when sharing plot details.</li>
            <li><strong>No dead links</strong>: Report link rot directly to the uploader desks.</li>
            <li><strong>Translation courtesy</strong>: Respect group signatures and releases scheduling.</li>
          </ol>
        </div>

        <!-- Curated quotes -->
        <div class="border-t-4 border-b-4 border-ink py-6 px-4 text-center bg-surface">
          <p class="font-body text-base italic text-ink-light leading-relaxed">
            "Discussion is the seed of literary comprehension. Let our evaluations be sharp, and our dialogues constructive."
          </p>
          <p class="font-mono text-[10px] text-accent uppercase tracking-widest mt-3 font-bold">
            — The Moderator Desk
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>
