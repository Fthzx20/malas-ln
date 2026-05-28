<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '~/composables/useToast'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const { data: novelsData, pending: novelsPending } = await useFetch('/api/novels', {
  query: { limit: 100 },
})

const selectedNovelId = ref(String(route.query.novelId || ''))
const isSaving = ref(false)

const selectedNovel = computed(() => {
  return novelsData.value?.data?.find(novel => novel.id === selectedNovelId.value) || null
})

const form = ref({
  title: '',
  chapterNumber: '1',
  translatorGroup: '',
  publishAt: '',
  isPublished: false,
})

const handleCreateChapter = async () => {
  if (!selectedNovelId.value) {
    toast.warning('Select a series first')
    return
  }

  if (!form.value.title.trim()) {
    toast.warning('Chapter title is required')
    return
  }

  isSaving.value = true
  try {
    const chapter = await $fetch<any>('/api/chapters', {
      method: 'POST',
      headers: await authStore.getAuthHeaders(),
      body: {
        novelId: selectedNovelId.value,
        title: form.value.title.trim(),
        chapterNumber: Number(form.value.chapterNumber),
        content: '',
        translatorGroup: form.value.translatorGroup.trim() || null,
        isPublished: form.value.isPublished,
        publishAt: form.value.publishAt ? new Date(form.value.publishAt).toISOString() : null,
      },
    })

    toast.success('Chapter created. Opening editor...')
    await router.push(`/admin/manuscripts/editor?chapterId=${chapter.id}`)
  } catch (err) {
    console.error('[manuscripts/new] create chapter failed', err)
    toast.error('Failed to create chapter')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6 font-ui min-h-[calc(100vh-120px)] flex flex-col">
    <div class="border-b border-rule pb-3 flex items-center justify-between shrink-0 gap-3">
      <div>
        <NuxtLink to="/admin/manuscripts" class="font-mono text-xs uppercase hover:text-accent font-bold mb-0.5 block">&larr; Manuscripts Directory</NuxtLink>
        <h2 class="font-heading text-xl sm:text-2xl font-black uppercase tracking-tight">Create Chapter First</h2>
      </div>

      <UiButton @click="handleCreateChapter" variant="primary" :loading="isSaving">
        Create & Open Editor
      </UiButton>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0 flex-1">
      <section class="xl:col-span-8 border border-ink bg-paper p-5 space-y-5">
        <div class="space-y-2">
          <h3 class="font-heading text-base font-black uppercase border-b border-ink pb-1.5">Chapter Intake</h3>
          <p class="font-mono text-[10px] uppercase text-ink-muted tracking-wider">
            Pick the series, create the chapter shell, then jump straight into the writing room.
          </p>
        </div>

        <div class="space-y-1">
          <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Series</label>
          <select v-model="selectedNovelId" class="w-full px-3 py-2 bg-surface border border-rule focus:border-accent focus:outline-none text-xs font-mono">
            <option value="">-- Choose Light Novel Serial --</option>
            <option v-for="n in novelsData?.data" :key="n.id" :value="n.id">{{ n.title }}</option>
          </select>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="space-y-1 sm:col-span-2">
            <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Chapter Title</label>
            <UiInput v-model="form.title" placeholder="Title..." class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Chapter No.</label>
            <UiInput v-model="form.chapterNumber" type="text" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Translator Group</label>
            <UiInput v-model="form.translatorGroup" placeholder="Group name..." class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Release Time (Scheduler)</label>
            <UiInput v-model="form.publishAt" type="datetime-local" placeholder="Optional" class="w-full" />
          </div>
        </div>

        <div class="pt-2 border-t border-rule flex items-center justify-between gap-4">
          <div>
            <span class="block font-heading text-sm font-bold">Publish Instantly</span>
            <span class="block font-mono text-[9px] text-ink-muted uppercase">Enable this only if the chapter should go public right away.</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="form.isPublished" class="rounded-none border-ink text-accent focus:ring-accent w-5 h-5 cursor-pointer" />
          </label>
        </div>
      </section>

      <aside class="xl:col-span-4 border border-ink bg-surface p-5 space-y-4">
        <div class="space-y-2">
          <h3 class="font-heading text-base font-black uppercase border-b border-ink pb-1.5">What Happens Next</h3>
          <p class="font-mono text-[10px] uppercase text-ink-muted tracking-wider">
            The chapter shell is created first, then the editor opens with more room to write.
          </p>
        </div>

        <div class="border border-rule bg-paper p-4 space-y-3">
          <div>
            <p class="font-mono text-[10px] uppercase text-ink-muted">Selected Series</p>
            <p class="font-heading text-lg font-black">{{ selectedNovel?.title || 'No series selected' }}</p>
          </div>
          <div>
            <p class="font-mono text-[10px] uppercase text-ink-muted">New Chapter</p>
            <p class="font-heading text-lg font-black">{{ form.title || 'Untitled Chapter' }}</p>
          </div>
          <div>
            <p class="font-mono text-[10px] uppercase text-ink-muted">Target Route</p>
            <p class="font-mono text-xs break-all text-ink-muted">/admin/manuscripts/editor</p>
          </div>
        </div>

        <div v-if="novelsPending" class="text-xs font-mono text-ink-muted uppercase">Loading series ledger...</div>
      </aside>
    </div>
  </div>
</template>