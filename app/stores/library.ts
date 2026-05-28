import { defineStore } from 'pinia'

interface BookmarkEntry {
  id: string
  novelId: string
  status: 'reading' | 'plan_to_read' | 'on_hold' | 'completed'
  currentChapterId: string | null
  scrollPosition: number
  progressPct: number
  novel: {
    id: string
    slug: string
    title: string
    coverUrl: string | null
    author: string
    status: string
    totalChapters: number
  }
  currentChapter: {
    id: string
    chapterNumber: number
    title: string
  } | null
  updatedAt: string
}

// Local reading history for guests
interface LocalHistoryEntry {
  chapterId: string
  novelSlug: string
  novelTitle: string
  chapterTitle: string
  chapterNumber: number
  readAt: string
  scrollPosition: number
  progressPct?: number
}

interface LibraryState {
  bookmarks: BookmarkEntry[]
  localHistory: LocalHistoryEntry[]
  readChapterIds: string[]
  isLoading: boolean
}

function normalizeReadChapterIds(value: unknown) {
  if (value instanceof Set) {
    return Array.from(value)
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  return []
}

export const useLibraryStore = defineStore('library', {
  state: (): LibraryState => ({
    bookmarks: [],
    localHistory: [],
    readChapterIds: [],
    isLoading: false,
  }),

  getters: {
    reading: (state) => state.bookmarks.filter(b => b.status === 'reading'),
    planToRead: (state) => state.bookmarks.filter(b => b.status === 'plan_to_read'),
    onHold: (state) => state.bookmarks.filter(b => b.status === 'on_hold'),
    completed: (state) => state.bookmarks.filter(b => b.status === 'completed'),
    isChapterRead: (state) => (chapterId: string) => state.readChapterIds.includes(chapterId),
    getBookmarkForNovel: (state) => (novelId: string) =>
      state.bookmarks.find(b => b.novelId === novelId),
  },

  actions: {
    // Helper to wrap $fetch with a timeout to avoid long-hanging requests
    async fetchWithTimeout<T>(url: string, opts: any = {}, timeoutMs = 5000): Promise<T> {
      // Prevent accidental calls to user-protected endpoints when the client
      // isn't authenticated. This reduces 401 churn to the server.
      try {
        if (url.startsWith('/api/user') || url.startsWith('/api/notifications')) {
          const authStore = useAuthStore()
          // If not authenticated, bail early instead of issuing a request.
          if (!authStore.isAuthenticated) {
            throw new Error('Not authenticated')
          }
        }
      } catch (e) {
        return await Promise.reject(e)
      }

      return await Promise.race<Promise<T>>([
        $fetch<T>(url, opts),
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Request timeout')), timeoutMs)),
      ])
    },
    async fetchBookmarks() {
      this.isLoading = true
      try {
        const data = await this.fetchWithTimeout<BookmarkEntry[]>('/api/user/bookmarks')
        this.bookmarks = data
      } catch {
        // Not authenticated or error — keep current list
      } finally {
        this.isLoading = false
      }
    },

    async updateBookmark(novelId: string, updates: Partial<BookmarkEntry>) {
      // Optimistic update: apply status change locally first
      const idx = this.bookmarks.findIndex(b => b.novelId === novelId)
      const prevStatus = idx >= 0 ? this.bookmarks[idx]?.status : undefined

      if (idx >= 0 && this.bookmarks[idx] && updates.status) {
        this.bookmarks[idx]!.status = updates.status as any
        this.bookmarks[idx]!.updatedAt = new Date().toISOString()
      }

      try {
        const data = await this.fetchWithTimeout('/api/user/bookmarks', {
          method: 'POST',
          body: { novelId, ...updates },
        })
        // Sync actual server response back
        if (idx >= 0) {
          const bookmark = this.bookmarks[idx]
          if (bookmark) {
            Object.assign(bookmark, data as any)
          }
        } else {
          // New bookmark created — refresh in background
          void this.fetchBookmarks()
        }
      } catch (err) {
        // Rollback optimistic update on failure
        if (idx >= 0 && this.bookmarks[idx] && prevStatus !== undefined) {
          this.bookmarks[idx]!.status = prevStatus
        } else if (idx < 0) {
          // Nothing to rollback, try refreshing in background
          void this.fetchBookmarks().catch(() => {})
        }
        throw err
      }
    },

    async deleteBookmark(novelId: string) {
      // Optimistic removal
      const prevBookmarks = [...this.bookmarks]
      this.bookmarks = this.bookmarks.filter(b => b.novelId !== novelId)
      try {
        await this.fetchWithTimeout(`/api/user/bookmarks/${novelId}`, { method: 'DELETE' })
      } catch {
        // Rollback on failure
        this.bookmarks = prevBookmarks
      }
    },

    markChapterRead(chapterId: string) {
      if (!this.readChapterIds.includes(chapterId)) {
        this.readChapterIds.push(chapterId)
      }
    },

    // Local history for guests
    addLocalHistory(entry: Omit<LocalHistoryEntry, 'readAt'>) {
      const existing = this.localHistory.findIndex(h => h.chapterId === entry.chapterId)
      const newEntry = { ...entry, readAt: new Date().toISOString() }
      if (existing >= 0) {
        this.localHistory[existing] = newEntry
      } else {
        this.localHistory.unshift(newEntry)
        if (this.localHistory.length > 100) {
          this.localHistory = this.localHistory.slice(0, 100)
        }
      }
    },

    updateScrollPosition(chapterId: string, position: number) {
      const entry = this.localHistory.find(h => h.chapterId === chapterId)
      if (entry) {
        entry.scrollPosition = position
      }
    },
  },

  // Only enable persisted state on the client to avoid SSR hydration mismatches
  persist: import.meta.client ? {
    pick: ['localHistory', 'readChapterIds'],
    afterHydrate: (ctx) => {
      ctx.store.readChapterIds = normalizeReadChapterIds(ctx.store.readChapterIds)
    },
    serializer: {
      serialize: (state: any) => JSON.stringify({
        localHistory: state.localHistory,
        readChapterIds: normalizeReadChapterIds(state.readChapterIds),
      }),
      deserialize: (value: string) => {
        const parsed = JSON.parse(value)
        return {
          localHistory: parsed.localHistory ?? [],
          readChapterIds: normalizeReadChapterIds(parsed.readChapterIds),
        }
      },
    },
  } : undefined,
})
