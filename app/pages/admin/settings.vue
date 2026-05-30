<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

const toast = useToast()

const activeTab = ref('general')
const tabs = [
  { id: 'general', label: 'General' },
  { id: 'homepage', label: 'Homepage' },
  { id: 'pages', label: 'Static Pages' },
  { id: 'content', label: 'Content' },
  { id: 'media', label: 'Media' },
  { id: 'user', label: 'User & Auth' },
  { id: 'system', label: 'System' },
]

// State to hold settings, organized by category -> key
const settingsForm = reactive<Record<string, Record<string, any>>>({
  general: { siteName: '', siteDescription: '', maintenanceMode: false },
  homepage: { heroLeft: 'Recommended by Admin', heroRight: 'Issue No. 104 • Vol. I', latestTitle: 'Latest Additions', trendingTitle: 'Trending Serials', genres: 'Action, Fantasy, Adventure, Sci-Fi, Romance, Mystery, Slice of Life, Drama' },
  pages: { about: '', faq: '[]', dmca: '', terms: '', privacy: '' },
  content: { defaultCover: '', itemsPerPage: 12 },
  media: { maxUploadSize: 5, cdnEnabled: true },
  user: { allowRegistration: true, defaultRole: 'user' },
  system: { enableCache: true, cacheTtl: 3600 },
})

const isSaving = ref(false)

const {
  data: settingsData,
  pending: isLoading,
  refresh: refreshSettings,
  error: settingsError,
} = await useAsyncData(
  'admin-settings',
  () => $fetch<{ settings: Record<string, Record<string, any>> }>('/api/admin/settings'),
  {
    default: () => ({ settings: {} }),
    lazy: false,
  },
)

watch(settingsError, (err) => {
  if (err) {
    toast.error('Failed to load settings')
  }
})

watch(
  settingsData,
  (data) => {
    if (!data?.settings) return
    for (const cat in data.settings) {
      if (!settingsForm[cat]) settingsForm[cat] = {}
      for (const key in data.settings[cat]) {
        settingsForm[cat][key] = data.settings[cat][key]
      }
    }
  },
  { immediate: true },
)

const saveSettings = async () => {
  isSaving.value = true
  try {
    const updates = []
    for (const cat in settingsForm) {
      for (const key in settingsForm[cat]) {
        updates.push({ category: cat, key, value: settingsForm[cat][key] })
      }
    }
    
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { updates }
    })
    await refreshSettings()
    
    toast.success('Settings saved successfully')
  } catch (err) {
    toast.error('Failed to save settings')
  } finally {
    isSaving.value = false
  }
}

useHead({ title: 'Site Settings | Admin' })
</script>

<template>
  <div class="space-y-6 font-ui">
    <div class="flex items-center justify-between border-b-4 border-ink pb-4">
      <div>
        <h2 class="font-heading text-3xl font-black uppercase tracking-tight">Site Settings</h2>
        <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">Configure global platform behavior</p>
      </div>
      <button 
        @click="saveSettings" 
        :disabled="isSaving || isLoading"
        class="bg-accent text-paper px-6 py-2.5 font-bold text-sm hover:bg-accent-dark disabled:opacity-50 transition-colors uppercase tracking-wider font-mono"
      >
        {{ isSaving ? 'Saving...' : 'Save Settings' }}
      </button>
    </div>

    <div v-if="isLoading" class="p-12 text-center text-ink-muted flex flex-col items-center justify-center space-y-4">
      <UiSkeleton class="w-12 h-12 rounded-full" />
      <span class="font-mono text-sm uppercase">Loading configuration...</span>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      
      <!-- TABS -->
      <nav class="lg:col-span-1 border border-rule bg-surface p-4 flex flex-col gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="text-left px-4 py-2.5 font-mono text-xs uppercase font-bold tracking-wider transition-colors border"
          :class="activeTab === tab.id ? 'bg-ink text-paper border-ink' : 'bg-transparent text-ink border-transparent hover:border-rule hover:bg-surface-raised'"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- CONTENT -->
      <main class="lg:col-span-3 border border-rule bg-surface p-6 min-h-100">
        
        <!-- GENERAL -->
        <div v-if="activeTab === 'general'" class="space-y-6">
          <h3 class="font-heading text-xl font-bold border-b border-rule pb-2 mb-6">General Configuration</h3>
          
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Site Name</label>
            <UiInput v-model="settingsForm.general.siteName" placeholder="Malaz Scans" />
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Site Description (SEO)</label>
            <textarea 
              v-model="settingsForm.general.siteDescription" 
              class="w-full p-3 border border-rule bg-paper focus:border-ink transition-colors font-body text-sm" 
              rows="3"
            ></textarea>
          </div>

          <div class="pt-4 flex items-center gap-3 border-t border-rule">
            <input type="checkbox" id="maintenance" v-model="settingsForm.general.maintenanceMode" class="w-5 h-5 accent-accent" />
            <label for="maintenance" class="font-mono text-xs uppercase tracking-wider font-bold text-accent cursor-pointer">Maintenance Mode</label>
          </div>
        </div>

        <!-- HOMEPAGE -->
        <div v-if="activeTab === 'homepage'" class="space-y-6">
          <h3 class="font-heading text-xl font-bold border-b border-rule pb-2 mb-6">Homepage Configuration</h3>
          
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Hero Top Left Text</label>
            <UiInput v-model="settingsForm.homepage.heroLeft" placeholder="Recommended by Admin" />
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Hero Top Right Text</label>
            <UiInput v-model="settingsForm.homepage.heroRight" placeholder="Issue No. 104 • Vol. I" />
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Latest Additions Title</label>
            <UiInput v-model="settingsForm.homepage.latestTitle" placeholder="Latest Additions" />
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Trending Serials Title</label>
            <UiInput v-model="settingsForm.homepage.trendingTitle" placeholder="Trending Serials" />
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Genre Taxonomy Categories (comma separated)</label>
            <UiInput v-model="settingsForm.homepage.genres" placeholder="Action, Fantasy, Adventure..." />
          </div>
        </div>

        <!-- STATIC PAGES -->
        <div v-if="activeTab === 'pages'" class="space-y-6">
          <h3 class="font-heading text-xl font-bold border-b border-rule pb-2 mb-6">Static Pages Content</h3>
          <p class="font-mono text-xs text-ink-muted mb-4">Use HTML formatting for these pages.</p>
          
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">About Page</label>
            <textarea v-model="settingsForm.pages.about" class="w-full p-3 border border-rule bg-paper focus:border-ink transition-colors font-body text-sm" rows="6"></textarea>
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">DMCA Policy</label>
            <textarea v-model="settingsForm.pages.dmca" class="w-full p-3 border border-rule bg-paper focus:border-ink transition-colors font-body text-sm" rows="6"></textarea>
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Terms of Service</label>
            <textarea v-model="settingsForm.pages.terms" class="w-full p-3 border border-rule bg-paper focus:border-ink transition-colors font-body text-sm" rows="6"></textarea>
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Privacy Policy</label>
            <textarea v-model="settingsForm.pages.privacy" class="w-full p-3 border border-rule bg-paper focus:border-ink transition-colors font-body text-sm" rows="6"></textarea>
          </div>
          
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">FAQ (JSON Array: [{"q":"...","a":"..."}])</label>
            <textarea v-model="settingsForm.pages.faq" class="w-full p-3 border border-rule bg-paper focus:border-ink transition-colors font-mono text-xs" rows="6"></textarea>
          </div>
        </div>

        <!-- CONTENT -->
        <div v-if="activeTab === 'content'" class="space-y-6">
          <h3 class="font-heading text-xl font-bold border-b border-rule pb-2 mb-6">Content Configuration</h3>
          
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Default Fallback Cover URL</label>
            <UiInput v-model="settingsForm.content.defaultCover" placeholder="/images/default-cover.jpg" />
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Items Per Page (Catalog)</label>
            <UiInput v-model.number="settingsForm.content.itemsPerPage" type="number" />
          </div>
        </div>

        <!-- MEDIA -->
        <div v-if="activeTab === 'media'" class="space-y-6">
          <h3 class="font-heading text-xl font-bold border-b border-rule pb-2 mb-6">Media & Storage</h3>
          
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Max Upload Size (MB)</label>
            <UiInput v-model.number="settingsForm.media.maxUploadSize" type="number" />
          </div>

          <div class="pt-4 flex items-center gap-3 border-t border-rule">
            <input type="checkbox" id="cdn" v-model="settingsForm.media.cdnEnabled" class="w-5 h-5 accent-accent" />
            <label for="cdn" class="font-mono text-xs uppercase tracking-wider font-bold cursor-pointer">Enable R2 CDN</label>
          </div>
        </div>

        <!-- USER & AUTH -->
        <div v-if="activeTab === 'user'" class="space-y-6">
          <h3 class="font-heading text-xl font-bold border-b border-rule pb-2 mb-6">User & Authentication</h3>
          
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Default User Role</label>
            <UiSelect v-model="settingsForm.user.defaultRole" :options="[{label: 'User', value: 'user'}, {label: 'Editor', value: 'editor'}]" />
          </div>

          <div class="pt-4 flex items-center gap-3 border-t border-rule">
            <input type="checkbox" id="register" v-model="settingsForm.user.allowRegistration" class="w-5 h-5 accent-accent" />
            <label for="register" class="font-mono text-xs uppercase tracking-wider font-bold cursor-pointer">Allow Open Registration</label>
          </div>
        </div>

        <!-- SYSTEM -->
        <div v-if="activeTab === 'system'" class="space-y-6">
          <h3 class="font-heading text-xl font-bold border-b border-rule pb-2 mb-6">System Level</h3>
          
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Global API Cache TTL (seconds)</label>
            <UiInput v-model.number="settingsForm.system.cacheTtl" type="number" />
          </div>

          <div class="pt-4 flex items-center gap-3 border-t border-rule">
            <input type="checkbox" id="syscache" v-model="settingsForm.system.enableCache" class="w-5 h-5 accent-accent" />
            <label for="syscache" class="font-mono text-xs uppercase tracking-wider font-bold cursor-pointer">Enable API Redis Cache</label>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>
