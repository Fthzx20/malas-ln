import { defineStore } from 'pinia'

interface SearchState {
  query: string
  filters: {
    genre: string[]
    status: string
    author: string
    year: string
    sort: string
  }
  isFiltersOpen: boolean
}

export const useSearchStore = defineStore('search', {
  state: (): SearchState => ({
    query: '',
    filters: {
      genre: [],
      status: '',
      author: '',
      year: '',
      sort: 'latest',
    },
    isFiltersOpen: false,
  }),

  getters: {
    hasActiveFilters: (state) =>
      state.filters.genre.length > 0 ||
      !!state.filters.status ||
      !!state.filters.author ||
      !!state.filters.year,

    activeFilterCount: (state) => {
      let count = 0
      if (state.filters.genre.length > 0) count++
      if (state.filters.status) count++
      if (state.filters.author) count++
      if (state.filters.year) count++
      return count
    },

    queryParams: (state) => {
      const params: Record<string, string> = {}
      if (state.query) params.search = state.query
      if (state.filters.genre.length) params.genre = state.filters.genre.join(',')
      if (state.filters.status) params.status = state.filters.status
      if (state.filters.author) params.author = state.filters.author
      if (state.filters.year) params.year = state.filters.year
      if (state.filters.sort) params.sort = state.filters.sort
      return params
    },
  },

  actions: {
    setQuery(query: string) {
      this.query = query
    },

    toggleGenre(genre: string) {
      const idx = this.filters.genre.indexOf(genre)
      if (idx >= 0) {
        this.filters.genre.splice(idx, 1)
      } else {
        this.filters.genre.push(genre)
      }
    },

    setFilter(key: keyof SearchState['filters'], value: any) {
      (this.filters as any)[key] = value
    },

    clearFilters() {
      this.filters = { genre: [], status: '', author: '', year: '', sort: 'latest' }
    },

    toggleFiltersPanel() {
      this.isFiltersOpen = !this.isFiltersOpen
    },
  },
})
