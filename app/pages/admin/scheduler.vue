<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  ssr: false
})

// Fetch all novels first
const { data: novelsData, pending } = await useFetch('/api/novels', {
  query: { limit: 100 }
})

useHead({
  title: 'Release Scheduler Desk'
})
</script>

<template>
  <div class="space-y-8 font-ui">
    <!-- ===== HEADER ===== -->
    <div class="border-b-4 border-ink pb-4">
      <h2 class="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight">
        The Release Desk
      </h2>
      <p class="font-mono text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">
        Scheduled Manuscripts &bull; Serialization Calendar
      </p>
    </div>

    <!-- ===== SCHEDULER CALENDAR PREVIEW ===== -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- Calendar Ledger (Col span 8) -->
      <main class="lg:col-span-8 border border-ink bg-surface p-5 space-y-6">
        <h3 class="font-heading text-lg font-black border-b border-ink pb-2 mb-4 uppercase">Upcoming Publications</h3>
        
        <div v-if="pending" class="space-y-4">
          <UiSkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
        </div>

        <div v-else-if="!novelsData?.data?.length" class="border border-dashed border-rule p-8 text-center bg-paper">
          <p class="text-sm font-mono text-ink-muted">No catalog series are currently registered.</p>
        </div>

        <div v-else class="divide-y divide-rule font-mono text-xs text-ink-light">
          <!-- Iterate novels and simulate active scheduling indicators -->
          <div 
            v-for="novel in novelsData.data.slice(0, 5)" 
            :key="novel.id"
            class="py-4 flex items-center justify-between gap-4"
          >
            <div>
              <strong class="text-ink font-bold text-sm block leading-snug">{{ novel.title }}</strong>
              <span class="text-[10px] text-ink-muted block mt-0.5">Author: {{ novel.author }} &bull; Total Published: {{ novel.totalChapters }}</span>
            </div>

            <div class="text-right">
              <span class="px-2 py-0.5 bg-success/15 border border-success text-success font-bold text-[9px] uppercase tracking-wider block sm:inline-block">
                Synced Calendar
              </span>
              <span class="block text-[10px] text-ink-muted mt-1">Automatic Dispatch</span>
            </div>
          </div>
        </div>
      </main>

      <!-- Calendar Column Info (Col span 4) -->
      <aside class="lg:col-span-4 border border-ink p-5 bg-paper font-mono text-xs text-ink-muted space-y-4">
        <h4 class="font-heading text-sm font-black text-ink border-b border-rule pb-1.5 uppercase">Uploader Desk Info</h4>
        <p class="font-body leading-relaxed text-ink-light">
          Translators can schedule automated releases directly when compiling manuscripts in the **Manuscript Desk** by settings the *Release Time (Scheduler)*.
        </p>
        <p class="font-body leading-relaxed text-ink-light">
          Automated edge functions query scheduled timings hourly, resolving publishing transitions seamlessly.
        </p>
      </aside>
    </div>
  </div>
</template>
