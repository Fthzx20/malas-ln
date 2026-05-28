import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useLibraryStore } from '~/stores/library'
import { useToast } from '~/composables/useToast'

/**
 * useBookmark — composable for quick bookmark toggling on novel cards.
 * Provides optimistic UI: local state updates immediately, then syncs to server.
 */
export function useBookmark() {
  const authStore = useAuthStore()
  const libraryStore = useLibraryStore()
  const toast = useToast()
  const pendingNovelIds = ref<Set<string>>(new Set())

  /**
   * Check if a novel is bookmarked by the current user.
   */
  const isBookmarked = (novelId: string): boolean => {
    return !!libraryStore.getBookmarkForNovel(novelId)
  }

  /**
   * Get the bookmark status for a novel.
   */
  const getBookmarkStatus = (novelId: string) => {
    return libraryStore.getBookmarkForNovel(novelId)?.status ?? null
  }

  /**
   * Check if a bookmark action is in progress for a novel.
   */
  const isPending = (novelId: string): boolean => {
    return pendingNovelIds.value.has(novelId)
  }

  /**
   * Toggle bookmark: if bookmarked, remove; if not, add as 'plan_to_read'.
   * Redirects to login if not authenticated.
   */
  const toggleBookmark = async (novelId: string, defaultStatus: 'reading' | 'plan_to_read' = 'plan_to_read') => {
    if (!authStore.isAuthenticated) {
      toast.info('Sign in to bookmark novels and track your reading progress.')
      void navigateTo('/auth/login')
      return
    }

    if (pendingNovelIds.value.has(novelId)) return // prevent double-tap

    pendingNovelIds.value.add(novelId)

    try {
      if (isBookmarked(novelId)) {
        await libraryStore.deleteBookmark(novelId)
        toast.success('Removed from Library')
      } else {
        await libraryStore.updateBookmark(novelId, { status: defaultStatus })
        toast.success('Added to Library — Plan to Read')
      }
    } catch (err) {
      toast.error('Failed to update bookmark. Please try again.')
    } finally {
      pendingNovelIds.value.delete(novelId)
    }
  }

  return {
    isBookmarked,
    getBookmarkStatus,
    isPending,
    toggleBookmark,
  }
}
