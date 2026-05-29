<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '~/composables/useToast'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'admin',
  ssr: false
})

const toast = useToast()
const authStore = useAuthStore()
const activeStatus = ref('pending')

// Fetch reports with status query
const { data: reportsData, pending, refresh } = useFetch('/api/admin/reports', {
  query: { status: activeStatus },
  watch: [activeStatus]
})

const handleResolveReport = async (reportId: string, status: 'reviewed' | 'dismissed') => {
  try {
    const headers = await authStore.getAuthHeaders()
    await $fetch(`/api/admin/reports/${reportId}`, {
      method: 'PUT',
      headers,
      body: { status }
    })
    toast.success(`Report successfully marked as ${status}`)
    refresh()
  } catch (err) {
    toast.error('Failed to update report')
  }
}

const handleDeleteComment = async (commentId: string, reportId: string) => {
  if (!confirm('Are you sure you want to permanently delete this flagged comment from the platform?')) return

  try {
    const headers = await authStore.getAuthHeaders()
    
    // 1. Delete the offensive comment
    await $fetch(`/api/admin/comments/${commentId}`, {
      method: 'DELETE',
      headers
    })

    // 2. Automatically resolve the report
    await $fetch(`/api/admin/reports/${reportId}`, {
      method: 'PUT',
      headers,
      body: { status: 'reviewed' }
    })

    toast.success('Flagged comment deleted and report resolved successfully!')
    refresh()
  } catch (err) {
    toast.error('Failed to delete comment')
  }
}

useHead({
  title: 'Moderation'
})
</script>

<template>
  <div class="space-y-8 font-ui">
    <!-- ===== HEADER ===== -->
    <div class="border-b-4 border-ink pb-4">
      <h2 class="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight">
        Moderation
      </h2>
      <p class="font-mono text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">
        Review flagged content
      </p>
    </div>

    <!-- ===== TABS TRIGGER ===== -->
    <div class="flex gap-2 border-b border-ink pb-1 font-mono text-[10px] uppercase font-bold text-ink-muted">
      <button 
        @click="activeStatus = 'pending'"
        class="px-4 py-2 border border-ink tracking-wider transition-colors"
        :class="activeStatus === 'pending' ? 'bg-ink text-paper border-ink font-black' : 'border-transparent hover:text-accent'"
      >
        Pending Review
      </button>
      <button 
        @click="activeStatus = 'reviewed'"
        class="px-4 py-2 border border-ink tracking-wider transition-colors"
        :class="activeStatus === 'reviewed' ? 'bg-ink text-paper border-ink font-black' : 'border-transparent hover:text-accent'"
      >
        Reviewed
      </button>
      <button 
        @click="activeStatus = 'dismissed'"
        class="px-4 py-2 border border-ink tracking-wider transition-colors"
        :class="activeStatus === 'dismissed' ? 'bg-ink text-paper border-ink font-black' : 'border-transparent hover:text-accent'"
      >
        Dismissed
      </button>
    </div>

    <!-- ===== REPORTS list ===== -->
    <main class="border border-ink bg-surface overflow-x-auto">
      <table class="w-full text-left font-mono text-xs border-collapse min-w-175">
        <thead>
          <tr class="bg-surface-raised border-b border-ink uppercase text-ink-muted font-bold tracking-wider">
            <th class="p-3">Reporter</th>
            <th class="p-3">Target</th>
            <th class="p-3">Violation Reason</th>
            <th class="p-3">Flagged Content Details</th>
            <th class="p-3">Reporter Description</th>
            <th class="p-3">Date</th>
            <th class="p-3 text-right" v-if="activeStatus === 'pending'">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-rule">
          <tr v-if="pending">
            <td colspan="7" class="p-4 text-center">
              <UiSkeleton class="h-8 w-full" />
            </td>
          </tr>
          <tr v-else-if="!reportsData?.data?.length">
            <td colspan="7" class="p-8 text-center italic text-ink-muted font-body">
              No reports found for this filter.
            </td>
          </tr>
          <tr 
            v-else 
            v-for="report in reportsData.data" 
            :key="report.id"
            class="hover:bg-surface-raised transition-colors"
          >
            <!-- Reporter -->
            <td class="p-3 font-bold text-ink">
              {{ report.reporter?.displayName || 'Unknown' }}
              <span class="block font-normal text-[9px] text-ink-muted">@{{ report.reporter?.username }}</span>
            </td>
            <!-- Target -->
            <td class="p-3 uppercase text-ink-light font-bold text-[10px]">
              {{ report.targetType }}
            </td>
            <!-- Reason -->
            <td class="p-3 text-accent font-bold uppercase text-[10px]">
              {{ report.reason }}
            </td>
            <!-- Flagged Content Details -->
            <td class="p-3 max-w-70 truncate text-ink font-body text-xs italic" :title="report.targetContent">
              <span class="block truncate bg-surface-sunken p-1.5 border border-rule">{{ report.targetContent }}</span>
            </td>
            <!-- Description -->
            <td class="p-3 max-w-45 truncate text-ink-light" :title="report.description || undefined">
              {{ report.description || 'No comment provided.' }}
            </td>
            <!-- Date -->
            <td class="p-3 text-ink-muted">
              {{ new Date(report.createdAt).toLocaleDateString() }}
            </td>
            <!-- Actions -->
            <td class="p-3 text-right" v-if="activeStatus === 'pending'">
              <div class="flex justify-end gap-1.5 flex-wrap">
                <button 
                  @click="handleResolveReport(report.id, 'reviewed')"
                  class="px-2 py-1 bg-ink text-paper hover:bg-accent uppercase font-bold text-[9px]"
                >
                  Mark Reviewed
                </button>
                <button 
                  v-if="report.targetType === 'comment' && report.targetContent !== 'Comment has been deleted' && report.targetContent !== 'Comment has been deleted'"
                  @click="handleDeleteComment(report.targetId, report.id)"
                  class="px-2 py-1 border border-accent bg-paper text-accent hover:bg-accent hover:text-paper uppercase font-bold text-[9px]"
                >
                  Delete
                </button>
                <button 
                  @click="handleResolveReport(report.id, 'dismissed')"
                  class="px-2 py-1 border border-rule hover:border-ink uppercase font-bold text-[9px]"
                >
                  Dismiss
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  </div>
</template>
