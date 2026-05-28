<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { clientLogger } from '~/utils/client-logger'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()

const isMobileMenuOpen = ref(false)
const isSearchOpen = ref(false)
const isNotificationsOpen = ref(false)
const searchQuery = ref('')
const notificationItems = ref<any[]>([])
const notificationCursor = ref<string | null>(null)
const notificationHasMore = ref(false)
const notificationUnreadCount = ref(0)
const notificationLoading = ref(false)
let notificationPoller: ReturnType<typeof setInterval> | null = null
// Track if we've already loaded notifications for this session
let initialLoadDone = false

const navLinks = [
  { label: 'Home', to: '/', icon: 'home' },
  { label: 'Browse', to: '/novels', icon: 'browse' },
  { label: 'Library', to: '/library', icon: 'library' },
  { label: 'Community', to: '/community', icon: 'community' },
]

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const closeAll = () => {
  closeMobileMenu()
  isSearchOpen.value = false
  isNotificationsOpen.value = false
}

const stopNotificationPoller = () => {
  if (notificationPoller) {
    clearInterval(notificationPoller)
    notificationPoller = null
  }
}

const resetNotificationState = () => {
  stopNotificationPoller()
  notificationItems.value = []
  notificationCursor.value = null
  notificationHasMore.value = false
  notificationUnreadCount.value = 0
  initialLoadDone = false
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    stopNotificationPoller()
    return
  }
  // Only resume polling if authenticated
  if (authStore.isAuthenticated) {
    startNotificationPoller()
  }
}

const startNotificationPoller = () => {
  if (!import.meta.client || notificationPoller) return
  notificationPoller = setInterval(() => {
    // Double-check auth before each poll to prevent stale state
    if (!authStore.isAuthenticated) {
      stopNotificationPoller()
      return
    }
    void refreshNotifications()
  }, 30000)
}

const loadNotifications = async (reset = false) => {
  // Guard: only load if authenticated
  if (!authStore.isAuthenticated) return
  if (notificationLoading.value) return

  notificationLoading.value = true
  try {
    // Double-check headers to avoid anonymous calls from SSR/hydration races
    const headers = await authStore.getAuthHeaders().catch(() => undefined)
    if (!headers || Object.keys(headers).length === 0) return
    const query: Record<string, string | number> = { limit: 10 }
    if (!reset && notificationCursor.value) {
      query.cursor = notificationCursor.value
    }

    const data = await $fetch<{ items: any[], nextCursor: string | null, hasMore: boolean, unreadCount: number }>('/api/notifications', {
      query,
      headers,
    })

    if (reset) {
      notificationItems.value = data.items ?? []
    } else {
      const existingIds = new Set(notificationItems.value.map(item => item.id))
      const incoming = (data.items ?? []).filter(item => !existingIds.has(item.id))
      notificationItems.value = [...notificationItems.value, ...incoming]
    }

    notificationCursor.value = data.nextCursor ?? null
    notificationHasMore.value = Boolean(data.hasMore)
    notificationUnreadCount.value = data.unreadCount ?? 0
    initialLoadDone = true
  } catch (err: any) {
    // Silently swallow 401 errors (user not authenticated or session expired)
    if (err?.statusCode === 401 || err?.data?.statusCode === 401) {
      return
    }
    // Other errors: log but don't crash
    clientLogger.warn('[Notifications] Failed to load:', err?.statusMessage || err?.message)
  } finally {
    notificationLoading.value = false
  }
}

const refreshNotifications = async () => {
  notificationCursor.value = null
  await loadNotifications(true)
}

const markNotificationsRead = async (ids?: string[]) => {
  if (!authStore.isAuthenticated) return
  try {
    const headers = await authStore.getAuthHeaders().catch(() => undefined)
    if (!headers || Object.keys(headers).length === 0) return
    await $fetch('/api/notifications/read', {
      method: 'POST',
      body: ids?.length ? { ids } : { all: true },
      headers,
    })
    await refreshNotifications()
  } catch {
    // Silently ignore
  }
}

const handleNotificationClick = async (item: any) => {
  if (item.link) {
    await navigateTo(item.link)
  }

  if (!item.isRead) {
    await markNotificationsRead([item.id])
  }
}

const toggleNotifications = async () => {
  if (!authStore.isAuthenticated) return
  isMobileMenuOpen.value = false
  isSearchOpen.value = false
  isNotificationsOpen.value = !isNotificationsOpen.value

  if (isNotificationsOpen.value && !initialLoadDone) {
    await refreshNotifications()
  }
}

const loadMoreNotifications = async () => {
  if (!notificationHasMore.value || !notificationCursor.value) return
  await loadNotifications(false)
}

const handleSignOut = async () => {
  await authStore.signOut()
  closeAll()
  await navigateTo('/auth/login')
}

watch(route, () => {
  closeAll()
})

// Watch authentication state changes
watch(() => authStore.isAuthenticated, async (isAuthenticated) => {
  if (isAuthenticated) {
    // Defer slightly to ensure Supabase session is fully restored
    await nextTick()
    // Only start if we haven't already (e.g. SSR hydration)
    if (!initialLoadDone) {
      void refreshNotifications()
    }
    startNotificationPoller()
    return
  }

  // User signed out — clean up everything
  resetNotificationState()
  isNotificationsOpen.value = false
}, { immediate: false })

onUnmounted(() => {
  stopNotificationPoller()
  if (import.meta.client) {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
})

if (import.meta.client) {
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Safe initial load — only trigger once we know auth state is settled
  // Use a short nextTick to let Pinia hydration complete
  nextTick(() => {
    if (authStore.isAuthenticated && !initialLoadDone) {
      void refreshNotifications()
      startNotificationPoller()
    }
  })
}

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    navigateTo(`/novels?search=${encodeURIComponent(searchQuery.value.trim())}`)
    isSearchOpen.value = false
    searchQuery.value = ''
  }
}

const toggleSearch = () => {
  isSearchOpen.value = !isSearchOpen.value
  if (isSearchOpen.value) {
    isMobileMenuOpen.value = false
    isNotificationsOpen.value = false
  }
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (isMobileMenuOpen.value) {
    isSearchOpen.value = false
    isNotificationsOpen.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-paper text-ink">
    <!-- ===== TOP BAR ===== -->
    <header class="border-b border-rule bg-paper sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <!-- Masthead -->
      <div class="container-editorial relative">
        <!-- Date line -->
        <div class="flex items-center justify-between py-1.5 border-b border-rule text-xs font-mono text-ink-muted tracking-wide">
          <client-only>
            <span>{{ new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</span>
          </client-only>
          <span class="hidden sm:inline">Light Novel Platform</span>
        </div>

        <!-- Logo & Title -->
        <div class="py-3 sm:py-4 text-center border-b-4 border-ink">
          <NuxtLink to="/" class="inline-block group">
            <h1 class="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none">
              RANO<span class="text-accent">LN</span>
            </h1>
            <p class="font-mono text-[10px] sm:text-xs tracking-[0.3em] text-ink-muted uppercase mt-0.5">
              The Literary Newsroom
            </p>
          </NuxtLink>
        </div>

        <!-- Navigation Bar -->
        <nav class="flex items-center justify-between py-2 gap-2" aria-label="Main navigation">
          <!-- Desktop Nav Links (left side) -->
          <ul class="hidden md:flex items-center gap-0">
            <li v-for="link in navLinks" :key="link.to">
              <NuxtLink
                :to="link.to"
                class="nav-link px-4 py-2 font-ui text-sm font-medium uppercase tracking-wider hover:text-accent transition-colors border-r border-rule first:pl-0 last:border-r-0 inline-flex items-center"
                :class="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to)) ? 'text-accent' : 'text-ink'"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>

          <!-- Mobile: spacer so buttons are on the right -->
          <div class="md:hidden flex-1"></div>

          <!-- Right side actions -->
          <div class="flex items-center gap-1">
            <!-- Search Toggle -->
            <button
              class="nav-icon-btn hover:text-accent transition-colors"
              @click="toggleSearch"
              :aria-expanded="isSearchOpen"
              aria-label="Toggle search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path v-if="!isSearchOpen" stroke-linecap="square" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                <path v-else stroke-linecap="square" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <!-- Notifications (authenticated only) -->
            <ClientOnly>
              <div class="relative">
                <button
                  v-if="authStore.isAuthenticated"
                  class="nav-icon-btn relative inline-flex items-center gap-2 border border-transparent px-3 py-2 transition-colors hover:border-rule hover:bg-surface-raised hover:text-accent md:px-2"
                  :class="notificationUnreadCount > 0 ? 'text-accent' : 'text-ink'"
                  @click="toggleNotifications"
                  :aria-expanded="isNotificationsOpen"
                  aria-label="Open notifications"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="square" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span v-if="notificationUnreadCount > 0" class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center bg-accent px-1 text-[10px] font-bold leading-none text-white">
                    {{ notificationUnreadCount > 99 ? '99+' : notificationUnreadCount }}
                  </span>
                </button>
              </div>
            </ClientOnly>

            <!-- Desktop Auth -->
            <ClientOnly>
              <div class="hidden md:flex items-center gap-2">
                <template v-if="authStore.isAuthenticated">
                  <NuxtLink
                    v-if="authStore.isAdmin"
                    to="/admin"
                    class="nav-icon-btn inline-flex items-center justify-center px-3 py-2 text-ink transition-colors hover:bg-surface-raised hover:text-accent"
                    aria-label="Open admin dashboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="square" d="M4 5h16v14H4zM4 9h16M9 9v10M15 9v10" />
                    </svg>
                  </NuxtLink>
                  <div class="group relative">
                    <NuxtLink
                      to="/profile"
                      class="inline-flex items-center gap-2 px-3 py-2 border border-rule bg-paper transition-colors hover:border-ink hover:bg-surface-raised"
                    >
                      <UiAvatar
                        :src="authStore.avatarUrl || ''"
                        :name="authStore.displayName"
                        size="sm"
                      />
                      <span class="text-sm font-ui font-medium max-w-28 truncate">{{ authStore.displayName }}</span>
                    </NuxtLink>

                    <div class="absolute right-0 top-full z-40 pt-2 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100">
                      <div class="min-w-48 border border-rule bg-paper shadow-lg">
                        <NuxtLink
                          to="/profile"
                          class="flex items-center justify-between px-4 py-3 text-sm font-ui border-b border-rule hover:bg-surface-raised"
                        >
                          <span>Profile Settings</span>
                          <span class="text-xs text-ink-muted">Open</span>
                        </NuxtLink>
                        <button
                          class="flex w-full items-center justify-between px-4 py-3 text-sm font-ui text-accent hover:bg-surface-raised"
                          @click="handleSignOut"
                        >
                          <span>Sign Out</span>
                          <span class="text-xs">Exit</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <NuxtLink
                    to="/auth/login"
                    class="auth-btn px-4 py-1.5 text-sm font-ui font-semibold border border-ink text-ink hover:bg-ink hover:text-paper transition-colors inline-flex items-center justify-center whitespace-nowrap"
                  >
                    Login
                  </NuxtLink>
                  <NuxtLink
                    to="/auth/register"
                    class="auth-btn px-4 py-1.5 text-sm font-ui font-semibold bg-accent text-white hover:bg-accent-dark transition-colors inline-flex items-center justify-center whitespace-nowrap"
                  >
                    Register
                  </NuxtLink>
                </template>
              </div>

              <template #fallback>
                <div class="hidden md:flex items-center gap-2">
                  <NuxtLink
                    to="/auth/login"
                    class="auth-btn px-4 py-1.5 text-sm font-ui font-semibold border border-ink text-ink hover:bg-ink hover:text-paper transition-colors inline-flex items-center justify-center whitespace-nowrap"
                  >
                    Login
                  </NuxtLink>
                  <NuxtLink
                    to="/auth/register"
                    class="auth-btn px-4 py-1.5 text-sm font-ui font-semibold bg-accent text-white hover:bg-accent-dark transition-colors inline-flex items-center justify-center whitespace-nowrap"
                  >
                    Register
                  </NuxtLink>
                </div>
              </template>
            </ClientOnly>

            <!-- Mobile Menu Toggle -->
            <button
              class="md:hidden nav-icon-btn"
              @click="toggleMobileMenu"
              :aria-expanded="isMobileMenuOpen"
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path v-if="!isMobileMenuOpen" stroke-linecap="square" d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="square" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </nav>

        <!-- Notifications panel -->
        <ClientOnly>
          <Transition name="fade">
            <div
              v-if="isNotificationsOpen && authStore.isAuthenticated"
              class="absolute right-4 top-full mt-2 w-[min(92vw,24rem)] border border-rule bg-surface shadow-lg z-50"
            >
              <div class="flex items-center justify-between px-4 py-3 border-b border-rule bg-surface-raised">
                <div>
                  <p class="font-heading text-lg font-black">Notifications</p>
                  <p class="font-mono text-[10px] uppercase text-ink-muted">In-app only &middot; auto-expire 30 days</p>
                </div>
                <button
                  type="button"
                  class="text-xs font-mono text-accent hover:text-accent-dark transition-colors"
                  @click="markNotificationsRead()"
                >
                  Mark all read
                </button>
              </div>

              <div class="max-h-96 overflow-y-auto">
                <!-- Loading state -->
                <div v-if="notificationLoading && notificationItems.length === 0" class="p-4 space-y-3">
                  <div v-for="i in 3" :key="i" class="flex gap-3">
                    <UiSkeleton class="w-8 h-8 shrink-0" />
                    <div class="flex-1 space-y-1.5">
                      <UiSkeleton class="h-3 w-3/4" />
                      <UiSkeleton class="h-3 w-full" />
                    </div>
                  </div>
                </div>

                <button
                  v-for="item in notificationItems"
                  :key="item.id"
                  class="w-full text-left px-4 py-3 border-b border-rule transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised"
                  :class="!item.isRead ? 'bg-surface' : ''"
                  @click="handleNotificationClick(item)"
                >
                  <div class="flex gap-3 items-start">
                    <UiAvatar v-if="item.actor" :src="item.actor.avatarUrl || ''" :name="item.actor.displayName || item.actor.username" size="sm" />
                    <div class="flex-1 min-w-0">
                      <p class="font-ui text-sm font-semibold text-ink leading-tight">{{ item.title }}</p>
                      <p class="font-ui text-xs text-ink-muted mt-1 leading-snug">{{ item.body }}</p>
                      <p class="font-mono text-[10px] text-ink-muted mt-1.5">{{ new Date(item.createdAt).toLocaleString() }}</p>
                    </div>
                    <span v-if="!item.isRead" class="mt-1 w-2 h-2 bg-accent flex-shrink-0"></span>
                  </div>
                </button>

                <div v-if="!notificationLoading && notificationItems.length === 0" class="px-4 py-10 text-center text-sm text-ink-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mx-auto text-ink-faint mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="square" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p>No notifications yet.</p>
                  <p class="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Replies, mentions, and updates appear here.</p>
                </div>
              </div>

              <div class="px-4 py-3 border-t border-rule bg-surface-raised text-center">
                <button
                  v-if="notificationHasMore"
                  type="button"
                  class="inline-flex items-center justify-center border border-ink px-3 py-1.5 text-xs font-mono uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-paper"
                  @click="loadMoreNotifications"
                >
                  Load more
                </button>
                <span v-else class="text-xs font-mono text-ink-muted">End of feed</span>
              </div>
            </div>
          </Transition>
        </ClientOnly>
      </div>

      <!-- Search Bar (Expandable) -->
      <Transition name="slide-down">
        <div v-if="isSearchOpen" class="border-t border-rule bg-surface">
          <div class="container-editorial py-3">
            <form @submit.prevent="handleSearch" class="flex gap-2">
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Search novels by title, author, or illustrator..."
                class="flex-1 px-4 py-2.5 bg-paper border border-rule focus:border-accent focus:outline-none text-sm font-ui"
                autofocus
              />
              <button
                type="submit"
                class="px-5 py-2.5 bg-ink text-paper font-ui text-sm font-medium hover:bg-accent transition-colors whitespace-nowrap"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </Transition>

      <!-- Mobile Menu -->
      <Transition name="slide-down">
        <div v-if="isMobileMenuOpen" class="md:hidden border-t border-rule bg-paper">
          <nav class="container-editorial py-4" aria-label="Mobile navigation">
            <ul class="space-y-0">
              <li v-for="link in navLinks" :key="link.to" class="border-b border-rule last:border-b-0">
                <NuxtLink
                  :to="link.to"
                  class="block py-3.5 px-2 font-ui text-sm font-medium uppercase tracking-wider hover:text-accent transition-colors min-h-[48px] flex items-center"
                  :class="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to)) ? 'text-accent' : 'text-ink'"
                  @click="closeMobileMenu"
                >
                  {{ link.label }}
                </NuxtLink>
              </li>
            </ul>

            <div class="mt-4 pt-4 border-t border-rule">
              <ClientOnly>
                <template v-if="authStore.isAuthenticated">
                  <div class="flex items-center gap-3 mb-4 p-3 bg-surface-raised border border-rule">
                    <UiAvatar :src="authStore.avatarUrl || ''" :name="authStore.displayName" size="md" />
                    <div class="min-w-0">
                      <p class="font-semibold text-sm truncate">{{ authStore.displayName }}</p>
                      <p class="text-xs text-accent font-mono uppercase tracking-wider">{{ authStore.userRole }}</p>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <NuxtLink to="/profile" class="block py-2.5 px-2 text-sm hover:text-accent transition-colors min-h-[44px] flex items-center" @click="closeMobileMenu">Profile Settings</NuxtLink>
                    <NuxtLink v-if="authStore.isAdmin" to="/admin" class="block py-2.5 px-2 text-sm hover:text-accent transition-colors min-h-[44px] flex items-center" @click="closeMobileMenu">Admin Dashboard</NuxtLink>
                    <button class="w-full text-left py-2.5 px-2 text-sm text-accent hover:text-accent-dark transition-colors min-h-[44px] flex items-center" @click="handleSignOut">Sign Out</button>
                  </div>
                </template>
                <template v-else>
                  <div class="flex gap-3">
                    <NuxtLink
                      to="/auth/login"
                      class="flex-1 text-center py-3 border border-ink bg-surface text-ink font-ui font-semibold text-sm hover:bg-ink hover:text-paper transition-colors flex items-center justify-center"
                      @click="closeMobileMenu"
                    >
                      Login
                    </NuxtLink>
                    <NuxtLink
                      to="/auth/register"
                      class="flex-1 text-center py-3 bg-accent text-white font-ui font-semibold text-sm hover:bg-accent-dark transition-colors flex items-center justify-center"
                      @click="closeMobileMenu"
                    >
                      Register
                    </NuxtLink>
                  </div>
                </template>

                <template #fallback>
                  <div class="flex gap-3">
                    <NuxtLink
                      to="/auth/login"
                      class="flex-1 text-center py-3 border border-ink bg-surface text-ink font-ui font-semibold text-sm hover:bg-ink hover:text-paper transition-colors flex items-center justify-center"
                      @click="closeMobileMenu"
                    >
                      Login
                    </NuxtLink>
                    <NuxtLink
                      to="/auth/register"
                      class="flex-1 text-center py-3 bg-accent text-white font-ui font-semibold text-sm hover:bg-accent-dark transition-colors flex items-center justify-center"
                      @click="closeMobileMenu"
                    >
                      Register
                    </NuxtLink>
                  </div>
                </template>
              </ClientOnly>
            </div>
          </nav>
        </div>
      </Transition>
    </header>

    <!-- ===== MAIN ===== -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- ===== FOOTER ===== -->
    <footer class="border-t-4 border-ink mt-auto">
      <div class="container-editorial py-8 sm:py-12">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <!-- Brand -->
          <div>
            <h2 class="font-heading text-2xl font-black mb-2">RANO<span class="text-accent">LN</span></h2>
            <p class="text-sm text-ink-muted leading-relaxed">
              A premium light novel reading platform. Built for readers, translators, and literary communities.
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h3 class="font-ui text-xs font-bold uppercase tracking-widest mb-3 border-b-4 border-accent pb-1 inline-block">Navigation</h3>
            <ul class="space-y-2 text-sm">
              <li><NuxtLink to="/novels" class="hover:text-accent transition-colors">Browse Novels</NuxtLink></li>
              <li><NuxtLink to="/library" class="hover:text-accent transition-colors">My Library</NuxtLink></li>
              <li><NuxtLink to="/community" class="hover:text-accent transition-colors">Community</NuxtLink></li>
            </ul>
          </div>

          <!-- About -->
          <div>
            <h3 class="font-ui text-xs font-bold uppercase tracking-widest mb-3 border-b-4 border-accent pb-1 inline-block">Platform</h3>
            <ul class="space-y-2 text-sm">
              <li><NuxtLink to="/about" class="hover:text-accent transition-colors">About</NuxtLink></li>
              <li><NuxtLink to="/faq" class="hover:text-accent transition-colors">FAQ</NuxtLink></li>
              <li><NuxtLink to="/contact" class="hover:text-accent transition-colors">Contact</NuxtLink></li>
            </ul>
          </div>

          <!-- Legal -->
          <div>
            <h3 class="font-ui text-xs font-bold uppercase tracking-widest mb-3 border-b-4 border-accent pb-1 inline-block">Legal</h3>
            <ul class="space-y-2 text-sm">
              <li><NuxtLink to="/terms" class="hover:text-accent transition-colors">Terms of Service</NuxtLink></li>
              <li><NuxtLink to="/privacy" class="hover:text-accent transition-colors">Privacy Policy</NuxtLink></li>
              <li><NuxtLink to="/dmca" class="hover:text-accent transition-colors">DMCA</NuxtLink></li>
            </ul>
          </div>
        </div>

        <div class="mt-8 pt-4 border-t border-rule flex flex-col sm:flex-row items-center justify-between gap-2">
          <p class="text-xs text-ink-muted font-mono">
            &copy; {{ new Date().getFullYear() }} Rano LN. All rights reserved.
          </p>
          <p class="text-xs text-ink-faint font-mono">
            Built with editorial precision.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Nav icon buttons */
.nav-icon-btn {
  min-width: 44px;
  min-height: 44px;
  width: auto;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Auth button */
.auth-btn {
  min-height: 44px;
}

/* Nav links */
.nav-link {
  height: 40px;
}

/* Slide-down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 400px;
}
</style>
