<template>
  <nav
    :aria-label="ariaLabel"
    class="flex items-center gap-1"
  >
    <!-- Previous button -->
    <button
      type="button"
      class="touch-target flex items-center justify-center min-w-[44px] min-h-[44px] px-2 font-ui text-sm text-ink border border-rule bg-surface hover:bg-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="currentPage <= 1"
      aria-label="Go to previous page"
      @click="goToPage(currentPage - 1)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <!-- Page buttons -->
    <template v-for="page in pages" :key="page.key">
      <!-- Ellipsis -->
      <span
        v-if="page.type === 'ellipsis'"
        class="flex items-center justify-center min-w-[44px] min-h-[44px] font-mono text-sm text-ink-muted select-none"
        aria-hidden="true"
      >
        &hellip;
      </span>

      <!-- Page number -->
      <button
        v-else
        type="button"
        class="touch-target flex items-center justify-center min-w-[44px] min-h-[44px] px-2 font-mono text-sm transition-colors border"
        :class="
          page.value === currentPage
            ? 'bg-ink text-paper border-ink font-bold border-b-4 border-b-accent'
            : 'text-ink bg-surface border-rule hover:bg-surface-raised'
        "
        :aria-current="page.value === currentPage ? 'page' : undefined"
        :aria-label="`Page ${page.value}`"
        @click="goToPage(page.value!)"
      >
        {{ page.value }}
      </button>
    </template>

    <!-- Next button -->
    <button
      type="button"
      class="touch-target flex items-center justify-center min-w-[44px] min-h-[44px] px-2 font-ui text-sm text-ink border border-rule bg-surface hover:bg-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="currentPage >= totalPages"
      aria-label="Go to next page"
      @click="goToPage(currentPage + 1)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  siblingCount?: number
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  siblingCount: 1,
  ariaLabel: 'Pagination',
})

const emit = defineEmits<{
  'page-change': [page: number]
}>()

interface PageItem {
  key: string
  type: 'page' | 'ellipsis'
  value?: number
}

const pages = computed<PageItem[]>(() => {
  const total = props.totalPages
  const current = props.currentPage
  const siblings = props.siblingCount

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => ({
      key: `page-${i + 1}`,
      type: 'page' as const,
      value: i + 1,
    }))
  }

  const items: PageItem[] = []

  // Always show first page
  items.push({ key: 'page-1', type: 'page', value: 1 })

  const leftSibling = Math.max(2, current - siblings)
  const rightSibling = Math.min(total - 1, current + siblings)

  // Left ellipsis
  if (leftSibling > 2) {
    items.push({ key: 'ellipsis-left', type: 'ellipsis' })
  }

  // Middle pages
  for (let i = leftSibling; i <= rightSibling; i++) {
    items.push({ key: `page-${i}`, type: 'page', value: i })
  }

  // Right ellipsis
  if (rightSibling < total - 1) {
    items.push({ key: 'ellipsis-right', type: 'ellipsis' })
  }

  // Always show last page
  if (total > 1) {
    items.push({ key: `page-${total}`, type: 'page', value: total })
  }

  return items
})

function goToPage(page: number) {
  if (page < 1 || page > props.totalPages || page === props.currentPage) return
  emit('page-change', page)
}
</script>
