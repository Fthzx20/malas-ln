<script setup lang="ts">
import { useBookmark } from '~/composables/useBookmark'
import { useAuthStore } from '~/stores/auth'
import { useLibraryStore } from '~/stores/library'

interface Props {
  novelId: string
  /** Visual size of the button */
  size?: 'sm' | 'md'
  /** If true, shows just the icon. If false, shows icon + text label */
  iconOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  iconOnly: true,
})

const { isBookmarked, isPending, toggleBookmark } = useBookmark()
const authStore = useAuthStore()
const libraryStore = useLibraryStore()

// Ensure library is loaded when auth is available
if (import.meta.client && authStore.isAuthenticated && !libraryStore.bookmarks.length) {
  libraryStore.fetchBookmarks()
}
</script>

<template>
  <ClientOnly>
    <button
      type="button"
      :disabled="isPending(novelId)"
      :title="isBookmarked(novelId) ? 'Remove from Library' : 'Add to Library'"
      :aria-label="isBookmarked(novelId) ? 'Remove from Library' : 'Add to Library'"
      :aria-pressed="isBookmarked(novelId)"
      class="inline-flex items-center gap-1.5 transition-all focus-visible:outline-accent"
      :class="[
        size === 'sm'
          ? 'p-1.5 text-xs'
          : 'px-2.5 py-1.5 text-xs',
        isBookmarked(novelId)
          ? 'text-accent border border-accent hover:text-accent-dark hover:border-accent-dark'
          : 'text-ink-muted border border-rule hover:text-accent hover:border-ink',
        isPending(novelId) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
      ]"
      @click.prevent.stop="toggleBookmark(novelId)"
    >
      <!-- Spinner while pending -->
      <svg
        v-if="isPending(novelId)"
        class="animate-spin"
        :class="size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>

      <!-- Bookmarked icon (filled) -->
      <svg
        v-else-if="isBookmarked(novelId)"
        :class="size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
      </svg>

      <!-- Unbookmarked icon (outline) -->
      <svg
        v-else
        :class="size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="square" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
      </svg>

      <span v-if="!iconOnly" class="font-mono text-[10px] uppercase tracking-wider font-bold">
        {{ isPending(novelId) ? '...' : isBookmarked(novelId) ? 'Saved' : 'Save' }}
      </span>
    </button>
  </ClientOnly>
</template>
