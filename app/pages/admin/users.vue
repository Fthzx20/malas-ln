<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from 'vue'
import { useToast } from '~/composables/useToast'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'admin',
  ssr: false
})

const toast = useToast()
const authStore = useAuthStore()

const searchQuery = ref('')
const selectedRole = ref('')
const currentPage = ref(1)
const itemsPerPage = 20

// Roles for filter dropdown
const roles = [
  { label: 'All Roles', value: '' },
  { label: 'Reader', value: 'user' },
  { label: 'Translator', value: 'translator' },
  { label: 'Admin', value: 'admin' }
]

// Fetch profiles with reactive query params
const { data: profilesResponse, pending, error, refresh } = await useFetch('/api/profiles', {
  query: {
    search: searchQuery,
    role: selectedRole,
    page: currentPage,
    limit: itemsPerPage
  },
  watch: [searchQuery, selectedRole, currentPage]
})

const users = computed(() => {
  return (profilesResponse.value as any)?.data || []
})

const pagination = computed(() => {
  return (profilesResponse.value as any)?.pagination || { total: 0, totalPages: 1 }
})

// Moderation / Ban States
const AsyncModal = defineAsyncComponent(() => import('~/components/ui/UiModal.vue'))
const isModModalOpen = ref(false)
const selectedUser = ref<any>(null)
const banReason = ref('')
const isBanning = ref(false)

const openModModal = (user: any) => {
  selectedUser.value = user
  banReason.value = user.banReason || ''
  isModModalOpen.value = true
}

const handleToggleBan = async (isBanned: boolean) => {
  if (!selectedUser.value) return
  if (isBanned && !banReason.value.trim()) {
    toast.warning('A reason must be logged to ban an account')
    return
  }

  isBanning.value = true
  try {
    const headers = await authStore.getAuthHeaders()
    const res = await $fetch<any>(`/api/profiles/${selectedUser.value.id}/ban`, {
      method: 'POST',
      headers,
      body: {
        isBanned,
        banReason: banReason.value.trim()
      }
    })

    toast.success(res.message || 'Moderation action successfully committed!')
    isModModalOpen.value = false
    selectedUser.value = null
    refresh()
  } catch (err: any) {
    toast.error(err.data?.statusMessage || 'Failed to update moderation state')
  } finally {
    isBanning.value = false
  }
}

const getRoleColor = (role: string) => {
  if (role === 'admin') return 'text-accent font-bold'
  if (role === 'translator') return 'text-info font-bold'
  return 'text-ink-light'
}

// Reset page when queries change
watch([searchQuery, selectedRole], () => {
  currentPage.value = 1
})

useHead({
  title: 'Reader Registry Desk'
})
</script>

<template>
  <div class="space-y-8 font-ui">
    <!-- ===== HEADER ===== -->
    <div class="border-b-4 border-ink pb-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-muted">Operations</p>
          <h2 class="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight">
            Reader Registry
          </h2>
          <p class="font-mono text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">
            Staff &amp; Readers &bull; System Role Ledgers
          </p>
        </div>

        <div class="flex flex-wrap gap-2.5 items-center w-full lg:w-auto">
          <UiSelect
            v-model="selectedRole"
            :options="roles"
            class="w-full sm:w-44"
          />
          <UiInput
            v-model="searchQuery"
            type="search"
            placeholder="Search by name, username..."
            class="w-full sm:w-72"
          />
        </div>
      </div>
    </div>

    <!-- ===== USER LEDGER TABLE ===== -->
    <UiCard padded>
      <div class="overflow-x-auto">
        <table class="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr class="bg-surface-raised border-b border-ink uppercase text-ink-muted font-bold tracking-wider text-[10px]">
              <th class="p-3">Profile</th>
              <th class="p-3">Username</th>
              <th class="p-3">System Role</th>
              <th class="p-3">Status</th>
              <th class="p-3">Joined</th>
              <th class="p-3 text-right" v-if="authStore.isAdmin">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-rule text-ink-light">
            <!-- Loading state -->
            <tr v-if="pending">
              <td colspan="6" class="p-8 text-center">
                <UiSkeleton class="h-8 w-full mb-2" />
                <UiSkeleton class="h-8 w-full" />
              </td>
            </tr>

            <!-- Error or No users state -->
            <tr v-else-if="error || !users.length">
              <td colspan="6" class="p-12 text-center">
                <div class="space-y-3 max-w-md mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mx-auto text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="square" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p class="font-heading text-base font-bold text-ink">
                    {{ error ? 'User registry failed to load' : 'No matches found' }}
                  </p>
                  <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted leading-relaxed">
                    {{ error 
                      ? 'The /api/profiles endpoint encountered an unexpected server error. Verify your administrator permission.' 
                      : 'No profiles match your active search and role criteria.' 
                    }}
                  </p>
                </div>
              </td>
            </tr>

            <!-- User rows -->
            <tr
              v-else
              v-for="user in users"
              :key="user.id"
              class="hover:bg-surface-raised transition-colors"
              :class="user.isBanned ? 'bg-red-50/40' : ''"
            >
              <td class="p-3">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-surface-sunken border border-rule flex items-center justify-center overflow-hidden flex-shrink-0">
                    <NuxtImg
                      v-if="user.avatarUrl"
                      :src="user.avatarUrl"
                      width="32"
                      height="32"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <span v-else class="font-heading text-xs font-bold text-ink-muted">
                      {{ (user.displayName || user.username || '?')[0]?.toUpperCase() }}
                    </span>
                  </div>
                  <div class="min-w-0">
                    <p class="font-heading text-sm font-bold text-ink truncate">{{ user.displayName || user.username }}</p>
                  </div>
                </div>
              </td>
              <td class="p-3 text-ink-muted">
                @{{ user.username }}
              </td>
              <td class="p-3">
                <span :class="['uppercase text-[10px] tracking-wider', getRoleColor(user.role)]">
                  {{ user.role }}
                </span>
              </td>
              <td class="p-3">
                <span v-if="user.isBanned" class="bg-accent text-white px-2 py-0.5 text-[8px] uppercase tracking-wider font-bold">Banned</span>
                <span v-else class="text-success uppercase text-[9px] font-bold">Active</span>
              </td>
              <td class="p-3 text-ink-muted">
                {{ user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—' }}
              </td>
              <td class="p-3 text-right" v-if="authStore.isAdmin">
                <button
                  @click="openModModal(user)"
                  class="px-2.5 py-1 border border-ink hover:bg-ink hover:text-paper font-bold uppercase text-[9px]"
                >
                  Moderate
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination & Summary -->
      <div v-if="!pending && !error && users.length > 0" class="border-t border-rule pt-4 mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-widest text-ink-muted">
        <div>
          Showing {{ users.length }} of {{ pagination.total }} profiles
        </div>
        <div class="flex items-center gap-1.5" v-if="pagination.totalPages > 1">
          <button 
            :disabled="currentPage === 1"
            @click="currentPage--"
            class="px-2 py-1 border border-rule hover:border-ink disabled:opacity-40 disabled:hover:border-rule"
          >
            &larr; Prev
          </button>
          <span class="px-2">Page {{ currentPage }} / {{ pagination.totalPages }}</span>
          <button 
            :disabled="currentPage === pagination.totalPages"
            @click="currentPage++"
            class="px-2 py-1 border border-rule hover:border-ink disabled:opacity-40 disabled:hover:border-rule"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </UiCard>

    <!-- Moderate Account Drawer / Modal -->
    <component :is="AsyncModal" v-model:open="isModModalOpen" :title="`Moderate @${selectedUser?.username || 'Account'}`">
      <div v-if="selectedUser" class="space-y-4 font-mono text-xs text-ink-light">
        <div class="flex items-center gap-3 border-b border-rule pb-3">
          <div class="w-10 h-10 bg-surface-sunken border border-rule overflow-hidden">
            <NuxtImg v-if="selectedUser.avatarUrl" :src="selectedUser.avatarUrl" width="40" height="40" class="w-full h-full object-cover" />
          </div>
          <div>
            <h4 class="font-heading text-sm font-bold text-ink leading-tight">{{ selectedUser.displayName }}</h4>
            <p class="text-[9px] text-ink-muted uppercase">Role: {{ selectedUser.role }} &bull; ID: {{ selectedUser.id }}</p>
          </div>
        </div>

        <div v-if="selectedUser.isBanned" class="p-3.5 bg-red-50 border border-accent text-accent uppercase font-bold tracking-wider leading-snug">
          This account is currently blocked from community access.
        </div>

        <div class="space-y-1.5">
          <label class="block uppercase font-bold text-ink-muted">Moderation Logging Reason</label>
          <component :is="AsyncTextarea" v-model="banReason" placeholder="Enter reason for account ban or warming log..." :rows="3" class="w-full" />
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-rule">
          <UiButton variant="secondary" @click="isModModalOpen = false">Close</UiButton>
          
          <button
            v-if="selectedUser.isBanned"
            type="button"
            class="px-4 py-2 border border-success bg-paper hover:bg-success hover:text-white uppercase font-bold transition-colors"
            @click="handleToggleBan(false)"
            :disabled="isBanning"
          >
            Lift Account Ban
          </button>
          
          <button
            v-else
            type="button"
            class="px-4 py-2 border border-accent bg-paper hover:bg-accent hover:text-white uppercase font-bold transition-colors"
            @click="handleToggleBan(true)"
            :disabled="isBanning"
          >
            Restrict Account (Ban)
          </button>
        </div>
      </div>
    </component>
  </div>
</template>
