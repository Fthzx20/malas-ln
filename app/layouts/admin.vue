
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()

const sidebarSections = [
  {
    title: 'Command Center',
    links: [
      { label: 'Overview', to: '/admin', icon: 'chart', exact: true },
      { label: 'Novels', to: '/admin/novels', icon: 'book', exact: false },
      { label: 'Chapters', to: '/admin/chapters', icon: 'edit', exact: false },
      { label: 'Scheduler', to: '/admin/scheduler', icon: 'clock', exact: false },
    ],
  },
  {
    title: 'Operations',
    links: [
      { label: 'Moderation', to: '/admin/moderation', icon: 'shield', exact: false },
      { label: 'Forum', to: '/admin/forum', icon: 'message-square', exact: false },
      { label: 'Notices', to: '/admin/notices', icon: 'bell', exact: false },
      { label: 'Users', to: '/admin/users', icon: 'users', exact: false },
      { label: 'Settings', to: '/admin/settings', icon: 'settings', exact: false },
    ],
  },
]

const quickLinks = [
  { label: 'Site Home', to: '/' },
  { label: 'Browse', to: '/novels' },
  { label: 'Community', to: '/community' },
]

const isSidebarOpen = ref(false)

const activePath = computed(() => route.path)

// Check if a link is active — exact for root admin, startsWith for others
const isLinkActive = (link: { to: string; exact: boolean }) => {
  if (link.exact) return activePath.value === link.to
  return activePath.value === link.to || activePath.value.startsWith(link.to + '/')
}

// Page title based on current route
const pageTitle = computed(() => {
  const path = activePath.value
  if (path === '/admin') return 'Command Overview'
  if (path.startsWith('/admin/novels')) return 'Catalog Desk'
  if (path.startsWith('/admin/chapters')) return 'Manuscript Intake'
  if (path.startsWith('/admin/scheduler')) return 'Release Scheduler'
  if (path.startsWith('/admin/moderation')) return 'Moderation Desk'
  if (path.startsWith('/admin/forum')) return 'Forum Management'
  if (path.startsWith('/admin/notices')) return 'Site Notices'
  if (path.startsWith('/admin/users')) return 'Reader database'
  if (path.startsWith('/admin/settings')) return 'Platform Settings'
  return 'curated Command Board'
})

const closeSidebar = () => {
  isSidebarOpen.value = false
}

watch(() => route.fullPath, closeSidebar)
</script>

<template>
  <div class="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96)_0%,rgba(245,242,236,0.96)_36%,rgba(233,228,218,1)_100%)] text-ink">
    <div class="flex min-h-screen">
      <!-- Overlay for mobile sidebar -->
      <Transition name="fade">
        <div
          v-if="isSidebarOpen"
          class="fixed inset-0 z-30 bg-black/50 lg:hidden"
          @click="closeSidebar"
          aria-hidden="true"
        />
      </Transition>

      <!-- ===== SIDEBAR ===== -->
      <aside
        class="fixed inset-y-0 left-0 z-40 w-72 border-r border-rule bg-paper/98 backdrop-blur-sm transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:flex lg:flex-col"
        :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
        aria-label="Admin navigation sidebar"
      >
        <div class="flex h-full flex-col overflow-hidden">
          <!-- Sidebar header / branding -->
          <div class="border-b border-rule px-5 py-5 shrink-0">
            <NuxtLink to="/" class="block space-y-0.5 group" @click="closeSidebar">
              <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-muted">Admin platform</p>
              <h1 class="font-heading text-2xl font-black leading-none tracking-tight group-hover:text-accent transition-colors">
                MALAZ<span class="text-accent group-hover:text-ink transition-colors">LN</span>
              </h1>
              <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                curated command board
              </p>
            </NuxtLink>
          </div>

          <!-- Navigation links -->
          <nav class="flex-1 space-y-6 overflow-y-auto px-4 py-5" aria-label="Admin navigation">
            <section v-for="section in sidebarSections" :key="section.title" class="space-y-1.5">
              <p class="px-2 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-muted mb-2">
                {{ section.title }}
              </p>
              <ul class="space-y-0.5">
                <li v-for="link in section.links" :key="link.to">
                  <NuxtLink
                    :to="link.to"
                    class="group flex items-center justify-between gap-3 border px-3 py-2.5 font-ui text-sm font-medium transition-all"
                    :class="isLinkActive(link)
                      ? 'border-ink bg-ink text-paper shadow-sm'
                      : 'border-transparent hover:border-rule hover:bg-surface-raised text-ink hover:text-ink'"
                    @click="closeSidebar"
                  >
                    <span>{{ link.label }}</span>
                    <svg
                      v-if="isLinkActive(link)"
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-3.5 h-3.5 opacity-60"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                    >
                      <path stroke-linecap="square" d="M9 5l7 7-7 7" />
                    </svg>
                  </NuxtLink>
                </li>
              </ul>
            </section>

            <!-- Quick links section -->
            <section class="border border-rule bg-surface-raised p-4">
              <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-muted mb-3">Quick links</p>
              <div class="flex flex-col gap-1.5">
                <NuxtLink
                  v-for="link in quickLinks"
                  :key="link.to"
                  :to="link.to"
                  class="flex items-center justify-between border border-rule px-3 py-2 text-sm font-ui transition-colors hover:border-ink hover:bg-paper"
                  @click="closeSidebar"
                >
                  <span>{{ link.label }}</span>
                  <span class="text-ink-muted text-xs">↗</span>
                </NuxtLink>
              </div>
            </section>
          </nav>

          <!-- User profile footer -->
          <div class="border-t border-rule px-5 py-4 shrink-0">
            <div class="flex items-center gap-3">
              <UiAvatar :src="authStore.avatarUrl || ''" :name="authStore.displayName" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-ui text-sm font-semibold">{{ authStore.displayName }}</p>
                <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">{{ authStore.userRole }}</p>
              </div>
              <NuxtLink
                to="/profile"
                class="shrink-0 p-1.5 text-ink-muted hover:text-accent transition-colors"
                title="Profile settings"
                @click="closeSidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="square" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="square" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>
      </aside>

      <!-- ===== MAIN CONTENT ===== -->
      <div class="flex min-w-0 flex-1 flex-col">
        <!-- Top header bar -->
        <header class="sticky top-0 z-20 border-b border-rule bg-paper/98 backdrop-blur-sm">
          <div class="flex h-14 items-center gap-3 px-4 sm:px-6">
            <!-- Mobile menu toggle -->
            <button
              class="touch-target inline-flex items-center justify-center lg:hidden text-ink hover:text-accent transition-colors"
              type="button"
              aria-label="Open sidebar navigation"
              @click="isSidebarOpen = true"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="square" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <!-- Page title -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 text-xs font-mono text-ink-muted uppercase tracking-[0.22em]">
                <NuxtLink to="/admin" class="hover:text-accent transition-colors">Admin</NuxtLink>
                <span v-if="activePath !== '/admin'" class="text-ink-faint">/</span>
                <span v-if="activePath !== '/admin'" class="text-ink">{{ pageTitle }}</span>
              </div>
            </div>

            <!-- Header right actions -->
            <div class="flex items-center gap-2">
              <NuxtLink
                to="/"
                class="hidden sm:inline-flex items-center border border-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors hover:bg-ink hover:text-paper"
              >
                ← Back to Site
              </NuxtLink>
            </div>
          </div>
        </header>

        <!-- Page content slot -->
        <main class="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div class="mx-auto w-full max-w-7xl">
            <slot />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
