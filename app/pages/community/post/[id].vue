<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const postId = route.params.id as string

// Fetch thread and replies
const { data: threadDataRaw, pending, error, refresh } = await useFetch(`/api/forum/post/${postId}`)
const threadData = computed(() => threadDataRaw.value as any)

// Reply state
const replyContent = ref('')
const isSubmittingReply = ref(false)

const handlePostReply = async () => {
  if (!authStore.isAuthenticated) {
    toast.warning('Authentication required. Sign in to reply.')
    navigateTo('/auth/login')
    return
  }

  if (!replyContent.value.trim()) {
    toast.warning('Reply content cannot be blank')
    return
  }

  isSubmittingReply.value = true
  try {
    await $fetch('/api/forum/reply', {
      method: 'POST',
      body: {
        postId,
        content: replyContent.value.trim()
      }
    })
    toast.success('Reply dispatched to thread!')
    replyContent.value = ''
    refresh()
  } catch (err) {
    toast.error('Failed to post reply')
  } finally {
    isSubmittingReply.value = false
  }
}

const AsyncTextarea = defineAsyncComponent(() => import('~/components/ui/UiTextarea.vue'))
const AsyncAvatar = defineAsyncComponent(() => import('~/components/ui/UiAvatar.vue'))

useHead(() => {
  if (!threadData.value?.post) return {}
  return {
    title: `${threadData.value.post.title} — Community Board`,
    meta: [
      { name: 'description', content: threadData.value.post.content.slice(0, 150) }
    ]
  }
})
</script>

<template>
  <div class="container-curated py-8 font-ui">
    <div v-if="pending" class="space-y-4">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-32 w-full" />
    </div>

    <div v-else-if="error || !threadData?.post" class="border border-dashed border-accent p-12 text-center bg-paper">
      <h3 class="font-heading text-2xl font-black text-accent mb-2">Thread Not Found</h3>
      <p class="text-sm text-ink-muted mb-6">The thread you are trying to view does not exist or has been flagged.</p>
      <NuxtLink to="/community" class="px-5 py-2 bg-ink text-paper hover:bg-accent font-ui font-semibold text-sm transition-colors">
        Return to Board
      </NuxtLink>
    </div>

    <div v-else class="space-y-8 max-w-4xl mx-auto">
      
      <!-- ===== BREADCRUMBS & TOP BAR ===== -->
      <div>
        <NuxtLink :to="`/community/${threadData.post.category.slug}`" class="font-mono text-xs uppercase hover:text-accent font-bold mb-2 inline-block">
          &larr; Back to {{ threadData.post.category.name }}
        </NuxtLink>
      </div>

      <!-- ===== MAIN THREAD CONTAINER ===== -->
      <article class="border-4 border-ink p-6 sm:p-8 bg-paper">
        <!-- Pinned / Locked Indicators -->
        <div class="flex flex-wrap gap-2 mb-4 font-mono text-[9px] uppercase font-bold text-white">
          <span v-if="threadData.post.isPinned" class="bg-accent px-1.5 py-0.5">Pinned</span>
          <span v-if="threadData.post.isLocked" class="bg-ink-muted px-1.5 py-0.5">Locked</span>
          <span class="border border-ink text-ink px-1.5 py-0.5">{{ threadData.post.category.name }}</span>
        </div>

        <h1 class="font-heading text-2xl sm:text-3xl md:text-4xl font-black mb-4 tracking-tight leading-tight">
          {{ threadData.post.title }}
        </h1>

        <!-- Author Dateline -->
        <div class="flex items-center gap-4 text-xs font-mono text-ink-muted mb-6 border-y border-rule py-2">
          <component :is="AsyncAvatar" :src="threadData.post.user.avatarUrl || ''" :name="threadData.post.user.displayName" size="sm" class="border border-ink" />
          <div class="flex flex-wrap items-baseline gap-2">
            <span>By <strong class="text-ink font-semibold">{{ threadData.post.user.displayName }}</strong></span>
            <span class="px-1.5 py-0.5 bg-ink text-paper text-[8px] uppercase tracking-wider font-bold">{{ threadData.post.user.role }}</span>
            <span>&bull; Published {{ new Date(threadData.post.createdAt).toLocaleDateString() }}</span>
            <span>&bull; {{ threadData.post.viewCount }} Views</span>
          </div>
        </div>

        <!-- Thread Text -->
        <p class="font-body text-base sm:text-lg text-ink-light leading-relaxed whitespace-pre-line text-justify">
          {{ threadData.post.content }}
        </p>
      </article>

      <!-- ===== CHRONOLOGICAL REPLIES SECTION ===== -->
      <section class="space-y-6">
        <div class="border-b-2 border-ink pb-2 mb-4">
          <h3 class="font-heading text-xl font-bold uppercase tracking-tight text-ink">
            Thread Dialogue ({{ threadData.replies.length }})
          </h3>
        </div>

        <div v-if="threadData.replies.length > 0" class="space-y-4">
          <div 
            v-for="(reply, index) in threadData.replies" 
            :key="reply.id"
            class="border border-rule bg-surface p-4 sm:p-5 flex gap-4"
          >
            <!-- Replier Avatar -->
            <component :is="AsyncAvatar" :src="reply.user.avatarUrl || ''" :name="reply.user.displayName" size="md" class="border border-rule shrink-0" />

            <div class="flex-1 space-y-2">
              <div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-1.5 text-xs font-mono text-ink-muted">
                <div class="flex items-baseline gap-2">
                  <strong class="text-ink font-bold">{{ reply.user.displayName }}</strong>
                  <span class="px-1 bg-surface-sunken border border-rule text-[8px] uppercase font-bold">{{ reply.user.role }}</span>
                </div>
                <span>Reply #{{ Number(index) + 1 }} &bull; {{ new Date(reply.createdAt).toLocaleDateString() }}</span>
              </div>

              <p class="font-body text-sm leading-relaxed text-ink-light whitespace-pre-line text-justify">
                {{ reply.content }}
              </p>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-10 text-ink-muted italic font-body text-sm border border-dashed border-rule bg-paper">
          No responses cataloged. Commit your critique below.
        </div>
      </section>

      <!-- ===== REPLY FORM DESK ===== -->
      <section v-if="!threadData.post.isLocked" class="border border-ink p-5 bg-paper space-y-4">
        <div class="border-b border-rule pb-2">
          <h4 class="font-heading text-lg font-black uppercase tracking-tight">Post Thread Critique</h4>
          <p class="font-mono text-[9px] text-ink-muted uppercase">Dialogue Entry Desk</p>
        </div>

        <form v-if="authStore.isAuthenticated" @submit.prevent="handlePostReply" class="space-y-4 font-mono text-xs">
          <component
            :is="AsyncTextarea"
            v-model="replyContent"
            placeholder="Commit your discussion reply manuscript here..."
            :rows="4"
            required
            class="w-full"
          />

          <div class="flex justify-end">
            <UiButton type="submit" variant="primary" :loading="isSubmittingReply">
              Submit Critique Reply
            </UiButton>
          </div>
        </form>

        <div v-else class="text-center py-6 text-sm font-body text-ink-muted bg-surface border border-rule p-4">
          Please 
          <NuxtLink to="/auth/login" class="text-accent font-bold hover:underline">Login</NuxtLink> 
          to post replies to this thread.
        </div>
      </section>
    </div>
  </div>
</template>
