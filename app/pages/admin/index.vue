<script setup lang="ts">
import { computed } from 'vue'

definePageMeta({
  layout: 'admin',
  ssr: false
})

const { data: analyticsData, pending: analyticsPending, refresh } = await useFetch('/api/admin/analytics')

const overviewStats = computed(() => {
  const stats = analyticsData.value?.stats
  return [
    { label: 'Cataloged Serials', value: stats?.totalNovels ? String(stats.totalNovels) : '—', hint: 'in public archive', trend: '📋' },
    { label: 'Published Chapters', value: stats?.totalChapters ? String(stats.totalChapters) : '—', hint: 'total chapters', trend: '📖' },
    { label: 'Registered Readers', value: stats?.totalUsers ? String(stats.totalUsers) : '—', hint: 'community registry', trend: '👥' },
    { label: 'Community Comments', value: stats?.totalComments ? String(stats.totalComments) : '—', hint: 'discussion volume', trend: '💬' },
    { label: 'Active Readers (7d)', value: stats?.activeReaders7d ? String(stats.activeReaders7d) : '—', hint: 'readers online', trend: '⚡' },
    { label: 'R2 Storage Usage', value: stats?.storageUsageMb ? `${stats.storageUsageMb} MB` : '—', hint: 'assets committed', trend: '☁️' },
  ]
})

const quickActions = [
  { label: 'Catalog new series', to: '/admin/novels', detail: 'Open content ledger and add a new publication.', icon: '📋' },
  { label: 'Review moderation queue', to: '/admin/moderation', detail: 'Triage pending reports and flagged posts.', icon: '🛡️' },
  { label: 'Scheduler desk', to: '/admin/scheduler', detail: 'Manage serialization timing and publishing flow.', icon: '📅' },
  { label: 'Upload cover art', to: '/admin/uploads', detail: 'Commit assets into the R2 pipeline.', icon: '🖼️' },
]

useHead({
  title: 'Admin Command Board'
})
</script>

<template>
  <div class="space-y-8 font-ui">
    <!-- ===== PAGE HEADER ===== -->
    <section class="border-b-4 border-ink pb-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-1">
          <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-muted">Admin overview</p>
          <h2 class="font-heading text-3xl font-black uppercase tracking-tight sm:text-4xl">
            Command Overview
          </h2>
          <p class="max-w-2xl font-body text-sm text-ink-light sm:text-base">
            A newsroom-style workspace for cataloging serials, monitoring activity, and keeping the publishing pipeline readable at a glance.
          </p>
        </div>

        <div class="flex flex-wrap gap-2 shrink-0">
          <NuxtLink to="/admin/novels" class="inline-flex items-center border border-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors hover:bg-ink hover:text-paper">
            Catalog series
          </NuxtLink>
          <NuxtLink to="/admin/moderation" class="inline-flex items-center border border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors hover:border-ink hover:bg-surface-raised">
            Review reports
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ===== STATS GRID ===== -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <UiCard v-for="stat in overviewStats" :key="stat.label">
        <div class="flex items-start justify-between gap-1">
          <p class="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-muted leading-tight">{{ stat.label }}</p>
          <span class="text-xs filter grayscale opacity-65">{{ stat.trend }}</span>
        </div>
        <div class="mt-3 flex items-end justify-between gap-2">
          <span class="font-heading text-2xl sm:text-3xl font-black text-accent leading-none">{{ stat.value }}</span>
        </div>
        <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint mt-1.5">{{ stat.hint }}</p>
      </UiCard>
    </div>

    <!-- ===== MAIN CONTENT GRID ===== -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <!-- Left side: Activity Feed & Reports Triage -->
      <div class="xl:col-span-8 space-y-6">
        <!-- Recent Uploads Feed -->
        <section class="border border-ink bg-surface">
          <div class="flex items-center justify-between gap-4 border-b border-ink px-5 py-4">
            <div>
              <h3 class="font-heading text-lg font-black uppercase tracking-tight">Recent Uploads</h3>
              <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted mt-0.5">Latest chapters committed to catalog</p>
            </div>
            <NuxtLink to="/admin/manuscripts" class="font-mono text-[10px] uppercase tracking-[0.24em] text-accent hover:underline whitespace-nowrap">
              Open manuscripts →
            </NuxtLink>
          </div>

          <div class="p-5">
            <div v-if="analyticsPending" class="space-y-3">
              <UiSkeleton v-for="i in 4" :key="i" class="h-14 w-full" />
            </div>

            <div v-else-if="analyticsData?.recentUploads?.length" class="divide-y divide-rule font-mono text-xs">
              <div 
                v-for="item in analyticsData.recentUploads"
                :key="item.id"
                class="py-3.5 flex items-center justify-between hover:bg-surface-raised px-2 transition-colors gap-4"
              >
                <div class="min-w-0 flex-1">
                  <span class="font-heading font-bold text-sm text-ink block truncate">{{ item.novel.title }}</span>
                  <span class="text-[10px] text-ink-light">Chapter {{ item.chapterNumber }}: {{ item.title }} &bull; {{ item.wordCount }} words</span>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-[10px] text-ink-muted block">{{ new Date(item.createdAt).toLocaleDateString() }}</span>
                  <NuxtLink :to="`/admin/manuscripts/editor?chapterId=${item.id}`" class="text-[9px] uppercase tracking-wider text-accent font-bold hover:underline">Edit</NuxtLink>
                </div>
              </div>
            </div>

            <div v-else class="border border-dashed border-rule p-8 text-center text-sm text-ink-muted">
              No recent uploads yet. Start by writing a chapter.
            </div>
          </div>
        </section>

        <!-- Moderation Reports Triage -->
        <section class="border border-ink bg-surface">
          <div class="flex items-center justify-between gap-4 border-b border-ink px-5 py-4">
            <div>
              <h3 class="font-heading text-lg font-black uppercase tracking-tight">Active Reports Triage</h3>
              <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted mt-0.5">Flagged reader items needing review</p>
            </div>
            <NuxtLink to="/admin/moderation" class="font-mono text-[10px] uppercase tracking-[0.24em] text-accent hover:underline whitespace-nowrap">
              Full Queue →
            </NuxtLink>
          </div>

          <div class="p-5">
            <div v-if="analyticsPending" class="space-y-3">
              <UiSkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
            </div>

            <div v-else-if="analyticsData?.recentReports?.length" class="overflow-x-auto">
              <table class="w-full text-left font-mono text-[11px] border-collapse min-w-[500px]">
                <thead>
                  <tr class="bg-surface-raised border-b border-ink uppercase text-ink-muted font-bold tracking-wider text-[9px]">
                    <th class="p-2.5">Reporter</th>
                    <th class="p-2.5">Target</th>
                    <th class="p-2.5">Reason</th>
                    <th class="p-2.5">Description</th>
                    <th class="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-rule">
                  <tr v-for="report in analyticsData.recentReports" :key="report.id" class="hover:bg-surface-raised transition-colors">
                    <td class="p-2.5 font-bold">@{{ report.reporter?.username }}</td>
                    <td class="p-2.5 uppercase text-accent font-bold text-[10px]">{{ report.targetType }}</td>
                    <td class="p-2.5 text-ink-light">{{ report.reason }}</td>
                    <td class="p-2.5 max-w-[180px] truncate text-ink-muted" :title="report.description">{{ report.description || '—' }}</td>
                    <td class="p-2.5 text-right">
                      <NuxtLink to="/admin/moderation" class="px-2 py-1 border border-ink bg-ink text-paper text-[8px] uppercase tracking-wider font-bold hover:bg-accent hover:border-accent">Triage</NuxtLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="border border-dashed border-rule p-8 text-center text-sm text-ink-muted italic font-body">
              Clean desk! There are no pending reports to review.
            </div>
          </div>
        </section>
      </div>

      <!-- Right sidebar: Quick Actions & Popular Novels -->
      <aside class="xl:col-span-4 space-y-6">
        <!-- Quick Actions -->
        <section class="border border-ink bg-paper">
          <div class="flex items-center justify-between border-b border-rule px-5 py-4">
            <div>
              <h3 class="font-heading text-lg font-black uppercase tracking-tight">Quick Actions</h3>
              <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted mt-0.5">Workspace shortcuts</p>
            </div>
          </div>

          <div class="p-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
            <NuxtLink
              v-for="action in quickActions"
              :key="action.to"
              :to="action.to"
              class="group flex items-start gap-3 border border-rule bg-surface p-3.5 transition-all hover:border-ink hover:bg-surface-raised"
            >
              <div class="flex-1 min-w-0">
                <h4 class="font-heading text-sm font-bold leading-tight group-hover:text-accent transition-colors">{{ action.label }}</h4>
                <p class="mt-0.5 text-xs text-ink-light leading-snug">{{ action.detail }}</p>
              </div>
              <span class="text-ink-muted text-sm transition-transform group-hover:translate-x-0.5 flex-shrink-0">↗</span>
            </NuxtLink>
          </div>
        </section>

        <!-- Trending titles -->
        <section class="border border-rule bg-surface">
          <div class="flex items-center justify-between border-b border-rule px-5 py-4">
            <div>
              <h3 class="font-heading text-lg font-black uppercase tracking-tight">Trending Serials</h3>
              <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted mt-0.5">Highest reader bookmark counts</p>
            </div>
          </div>

          <div class="p-5">
            <div v-if="analyticsPending" class="space-y-3">
              <UiSkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
            </div>

            <div v-else-if="analyticsData?.popularNovels?.length" class="space-y-2.5">
              <article
                v-for="(item, idx) in analyticsData.popularNovels"
                :key="item.novel?.id"
                class="flex items-center gap-3 border border-rule p-3 hover:border-ink transition-colors bg-paper"
              >
                <span class="font-heading text-2xl font-extrabold text-accent leading-none w-7 text-center flex-shrink-0">{{ idx + 1 }}</span>
                <div class="w-9 h-12 shrink-0 border border-rule bg-surface-sunken overflow-hidden">
                  <NuxtImg v-if="item.novel?.coverUrl" :src="item.novel.coverUrl" width="36" height="48" class="h-full w-full object-cover" loading="lazy" />
                </div>
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/novels/${item.novel?.slug}`" class="hover:text-accent transition-colors">
                    <p class="truncate font-heading text-sm font-bold">{{ item.novel?.title || 'Unknown Novel' }}</p>
                  </NuxtLink>
                  <p class="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">By {{ item.novel?.author }} &bull; {{ item.count }} bookmarks</p>
                </div>
              </article>
            </div>

            <div v-else class="border border-dashed border-rule p-6 text-center text-sm text-ink-muted">
              No popular serials recorded yet.
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
