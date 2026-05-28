<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const categorySlug = route.params.category as string

// Fetch posts in this category
const { data: categoryDataRaw, pending, error, refresh } = await useFetch(`/api/forum/${categorySlug}`)
const categoryData = computed(() => categoryDataRaw.value as any)

// Post new thread state
const isPostModalOpen = ref(false)
const threadTitle = ref('')
const threadContent = ref('')
const isSubmittingThread = ref(false)

const handleCreateThread = async () => {
  if (!authStore.isAuthenticated) {
    toast.warning('Authentication required. Sign in to post.')
    navigateTo('/auth/login')
    return
  }

  if (!threadTitle.value.trim() || !threadContent.value.trim()) {
    toast.warning('Title and content cannot be blank')
    return
  }

  isSubmittingThread.value = true
  try {
    await $fetch('/api/forum/post', {
      method: 'POST',
      body: {
        title: threadTitle.value.trim(),
        content: threadContent.value.trim(),
        categoryId: categoryData.value.category.id
      }
    })
    toast.success('Discussion thread created successfully!')
    threadTitle.value = ''
    threadContent.value = ''
    isPostModalOpen.value = false
    refresh()
  } catch (err) {
    toast.error('Failed to create thread')
  } finally {
    isSubmittingThread.value = false
  }
}

// Lazy-load heavy textarea only when modal opens
const AsyncTextarea = defineAsyncComponent(() => import('~/components/ui/UiTextarea.vue'))
const AsyncModal = defineAsyncComponent(() => import('~/components/ui/UiModal.vue'))

useHead(() => {
  if (!categoryData.value?.category) return {}
  return {
    title: `${categoryData.value.category.name} — Community Board`,
    meta: [
      { name: 'description', content: categoryData.value.category.description }
    ]
  }
})
</script>

<template>
  <div class="container-editorial py-8">
    <div v-if="pending" class="space-y-4">
      <UiSkeleton class="h-12 w-1/3" />
      <UiSkeleton class="h-6 w-2/3" />
      <div class="space-y-2 pt-6">
        <UiSkeleton v-for="i in 3" :key="i" class="h-20 w-full" />
      </div>
    </div>

    <div v-else-if="error || !categoryData?.category" class="border border-dashed border-accent p-12 text-center bg-paper">
      <h3 class="font-heading text-2xl font-black text-accent mb-2">Category Not Found</h3>
      <p class="text-sm text-ink-muted mb-6">The category division you requested is not cataloged in our board archives.</p>
      <NuxtLink to="/community" class="px-5 py-2 bg-ink text-paper hover:bg-accent font-ui font-semibold text-sm transition-colors">
        Return to Board
      </NuxtLink>
    </div>

    <div v-else class="space-y-8">
      <!-- ===== DYNAMIC CATEGORY HEADER ===== -->
      <div class="border-b-4 border-ink pb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
        <div>
          <NuxtLink to="/community" class="font-mono text-xs uppercase hover:text-accent font-bold mb-1 block">&larr; Community Board</NuxtLink>
          <h2 class="font-heading text-3xl sm:text-4xl font-black uppercase tracking-tight">
            {{ categoryData.category.name }}
          </h2>
          <p class="font-body text-sm text-ink-muted mt-1 leading-relaxed">
            {{ categoryData.category.description }}
          </p>
        </div>

        <!-- Create thread action -->
        <button 
          @click="isPostModalOpen = true"
          class="touch-target px-5 py-2.5 bg-ink text-paper hover:bg-accent font-ui text-xs uppercase font-bold tracking-wider transition-colors whitespace-nowrap self-start"
        >
          Create Thread
        </button>
      </div>

      <!-- ===== THREADS LIST FEED ===== -->
      <main class="border border-ink bg-surface">
        <div class="px-4 py-2 bg-surface-raised border-b border-ink flex justify-between text-xs font-mono uppercase tracking-wider text-ink-muted">
          <span>Manuscript Threads</span>
          <span class="hidden sm:inline">Views &bull; Replies</span>
        </div>

        <div v-if="categoryData.posts.length > 0" class="divide-y divide-rule">
          <div 
            v-for="post in categoryData.posts" 
            :key="post.id"
            class="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-raised transition-colors gap-4"
          >
            <div class="space-y-1">
              <!-- Sticky Pinned Badge -->
              <span v-if="post.isPinned" class="font-mono text-[9px] bg-accent text-white px-1.5 py-0.5 uppercase tracking-widest mr-2">Pinned</span>
              
              <NuxtLink :to="`/community/post/${post.id}`" class="font-heading text-base sm:text-lg font-bold hover:text-accent transition-colors leading-snug inline-block">
                {{ post.title }}
              </NuxtLink>
              
              <div class="flex flex-wrap items-center gap-3 text-xs font-mono text-ink-muted">
                <span>By <strong class="text-ink font-semibold">{{ post.user.displayName }}</strong></span>
                <span>&bull; {{ new Date(post.createdAt).toLocaleDateString() }}</span>
              </div>
            </div>

            <!-- Stats Badge side -->
            <div class="flex items-center gap-6 font-mono text-xs text-ink-muted text-right">
              <div class="hidden sm:block">
                <span class="block font-bold text-ink">{{ post.viewCount }}</span>
                <span class="text-[9px] uppercase tracking-wider">Views</span>
              </div>
              <div>
                <span class="block font-bold text-accent">{{ post.replyCount }}</span>
                <span class="text-[9px] uppercase tracking-wider text-ink-muted">Replies</span>
              </div>
              <NuxtLink 
                :to="`/community/post/${post.id}`"
                class="px-2 py-1 border border-ink hover:bg-ink hover:text-paper uppercase text-[10px] font-bold"
              >
                Join
              </NuxtLink>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-16 text-ink-muted italic font-body text-sm bg-paper">
          This division is currently silent. Be the first to catalog a dispatch!
        </div>
      </main>
    </div>

    <!-- Create thread Modal -->
    <component :is="AsyncModal" v-model:open="isPostModalOpen" :title="`Dispatch a New Thread: ${categoryData?.category?.name}`">
      <form @submit.prevent="handleCreateThread" class="space-y-4 font-mono text-xs">
        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Thread Title</label>
          <UiInput 
            v-model="threadTitle" 
            placeholder="e.g. Editorial Analysis on Lora's Typography..."
            required
            class="w-full"
          />
        </div>
        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Content Dispatch</label>
          <component
            :is="AsyncTextarea"
            v-model="threadContent"
            placeholder="Commit your discussion manuscript here..."
            :rows="6"
            required
            class="w-full"
          />
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-rule">
          <UiButton type="button" variant="secondary" @click="isPostModalOpen = false">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :loading="isSubmittingThread">Post Thread</UiButton>
        </div>
      </form>
    </component>
  </div>
</template>
