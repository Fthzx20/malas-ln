<script setup lang="ts">
import { computed, ref, defineAsyncComponent } from 'vue'
import { useToast } from '~/composables/useToast'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'admin',
  ssr: false
})

const toast = useToast()
const authStore = useAuthStore()
const searchQuery = ref('')

// Fetch all novels (non-blocking)
const { data: novelsData, pending, refresh } = useFetch('/api/novels', {
  query: { limit: 100 },
  lazy: true,
})

const filteredNovels = computed(() => {
  const novels = (novelsData.value as any)?.data || []
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return novels

  return novels.filter((novel: any) => {
    const haystack = [novel.title, novel.author, novel.illustrator, novel.year, novel.status, ...(novel.genreTags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
})

const catalogCount = computed(() => (novelsData.value as any)?.pagination?.total || 0)
const featuredCount = computed(() => {
  const novels = (novelsData.value as any)?.data || []
  return novels.filter((novel: any) => novel.isFeatured).length
})

// Async UI Components
const AsyncModal = defineAsyncComponent(() => import('~/components/ui/UiModal.vue'))
const AsyncTextarea = defineAsyncComponent(() => import('~/components/ui/UiTextarea.vue'))

// Create novel states
const isCreateModalOpen = ref(false)
const isSubmitting = ref(false)
const createCoverFile = ref<File | null>(null)
const createCoverPreviewUrl = ref('')

const form = ref({
  title: '',
  author: '',
  illustrator: '',
  synopsis: '',
  originalTitle: '',
  publisher: '',
  year: String(new Date().getFullYear()),
  status: 'ongoing',
  genres: '',
  isNsfw: false,
  isSpoiler: false
})

const updatePreviewUrl = (currentUrl: string, nextFile: File | null) => {
  if (currentUrl.startsWith('blob:')) {
    URL.revokeObjectURL(currentUrl)
  }

  return nextFile ? URL.createObjectURL(nextFile) : ''
}

const handleCreateFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0] || null
  createCoverFile.value = file
  createCoverPreviewUrl.value = updatePreviewUrl(createCoverPreviewUrl.value, file)
}

const handleCreateNovel = async () => {
  if (!form.value.title || !form.value.author || !form.value.synopsis) {
    toast.warning('Title, author, and synopsis are required')
    return
  }

  isSubmitting.value = true
  try {
    let uploadedCoverUrl = ''
    if (createCoverFile.value) {
      const formData = new FormData()
      formData.append('image', createCoverFile.value)
      const uploadRes = await $fetch<any>('/api/upload/image?folder=covers', {
        method: 'POST',
        body: formData
      })
      uploadedCoverUrl = uploadRes?.url || ''
    }

    const genreTags = form.value.genres 
      ? form.value.genres.split(',').map(g => g.trim()).filter(Boolean)
      : []

    const taxonomyTags: string[] = []
    if (form.value.isNsfw) taxonomyTags.push('nsfw')
    if (form.value.isSpoiler) taxonomyTags.push('spoiler')

    await $fetch('/api/novels', {
      method: 'POST',
      body: {
        title: form.value.title.trim(),
        author: form.value.author.trim(),
        illustrator: form.value.illustrator.trim() || null,
        synopsis: form.value.synopsis.trim(),
        coverUrl: uploadedCoverUrl || null,
        originalTitle: form.value.originalTitle.trim() || null,
        publisher: form.value.publisher.trim() || null,
        year: Number(form.value.year) || null,
        status: form.value.status,
        genreTags,
        taxonomyTags
      }
    })

    toast.success('New Light Novel cataloged successfully!')
    isCreateModalOpen.value = false
    createCoverFile.value = null
    createCoverPreviewUrl.value = updatePreviewUrl(createCoverPreviewUrl.value, null)
    form.value = {
      title: '',
      author: '',
      illustrator: '',
      synopsis: '',
      originalTitle: '',
      publisher: '',
      year: String(new Date().getFullYear()),
      status: 'ongoing',
      genres: '',
      isNsfw: false,
      isSpoiler: false
    }
    refresh()
  } catch (err) {
    toast.error('Failed to catalog novel')
  } finally {
    isSubmitting.value = false
  }
}

// Edit novel states
const isEditModalOpen = ref(false)
const isUpdating = ref(false)
const editingNovelId = ref('')
const editCoverFile = ref<File | null>(null)
const editCoverPreviewUrl = ref('')

const formEdit = ref({
  title: '',
  author: '',
  illustrator: '',
  synopsis: '',
  coverUrl: '',
  originalTitle: '',
  publisher: '',
  year: String(new Date().getFullYear()),
  status: 'ongoing',
  genres: '',
  isFeatured: false,
  isNsfw: false,
  isSpoiler: false
})

const handleEditFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0] || null
  editCoverFile.value = file
  editCoverPreviewUrl.value = updatePreviewUrl(editCoverPreviewUrl.value, file)
}

const openEditModal = (novel: any) => {
  editingNovelId.value = novel.id
  formEdit.value = {
    title: novel.title || '',
    author: novel.author || '',
    illustrator: novel.illustrator || '',
    synopsis: novel.synopsis || '',
    coverUrl: novel.coverUrl || '',
    originalTitle: novel.originalTitle || '',
    publisher: novel.publisher || '',
    year: novel.year ? String(novel.year) : '',
    status: novel.status || 'ongoing',
    genres: (novel.genreTags || []).join(', '),
    isFeatured: !!novel.isFeatured,
    isNsfw: (novel.taxonomyTags || []).includes('nsfw'),
    isSpoiler: (novel.taxonomyTags || []).includes('spoiler')
  }
  editCoverFile.value = null
  editCoverPreviewUrl.value = updatePreviewUrl(editCoverPreviewUrl.value, null)
  if (novel.coverUrl) {
    editCoverPreviewUrl.value = novel.coverUrl
  }
  isEditModalOpen.value = true
}

const handleUpdateNovel = async () => {
  if (!editingNovelId.value) return
  if (!formEdit.value.title || !formEdit.value.author || !formEdit.value.synopsis) {
    toast.warning('Title, author, and synopsis are required')
    return
  }

  isUpdating.value = true
  try {
    let uploadedCoverUrl = formEdit.value.coverUrl.trim()
    if (editCoverFile.value) {
      const formData = new FormData()
      formData.append('image', editCoverFile.value)
      const uploadRes = await $fetch<any>('/api/upload/image?folder=covers', {
        method: 'POST',
        body: formData
      })
      uploadedCoverUrl = uploadRes?.url || ''
    }

    const genreTags = formEdit.value.genres 
      ? formEdit.value.genres.split(',').map(g => g.trim()).filter(Boolean)
      : []

    const taxonomyTags: string[] = []
    if (formEdit.value.isNsfw) taxonomyTags.push('nsfw')
    if (formEdit.value.isSpoiler) taxonomyTags.push('spoiler')

    const headers = await authStore.getAuthHeaders()
    await $fetch(`/api/novels/${editingNovelId.value}`, {
      method: 'PUT',
      headers,
      body: {
        title: formEdit.value.title.trim(),
        author: formEdit.value.author.trim(),
        illustrator: formEdit.value.illustrator.trim() || null,
        synopsis: formEdit.value.synopsis.trim(),
        coverUrl: uploadedCoverUrl || null,
        originalTitle: formEdit.value.originalTitle.trim() || null,
        publisher: formEdit.value.publisher.trim() || null,
        year: formEdit.value.year ? Number(formEdit.value.year) : null,
        status: formEdit.value.status,
        genreTags,
        taxonomyTags,
        isFeatured: formEdit.value.isFeatured
      }
    })

    toast.success('Novel serial updated successfully!')
    isEditModalOpen.value = false
    editCoverFile.value = null
    editCoverPreviewUrl.value = updatePreviewUrl(editCoverPreviewUrl.value, null)
    refresh()
  } catch (err) {
    toast.error('Failed to update novel details')
  } finally {
    isUpdating.value = false
  }
}

// Delete novel states
const isDeleteConfirmOpen = ref(false)
const isDeleting = ref(false)
const novelToDelete = ref<any>(null)
const deleteConfirmationInput = ref('')

const openDeleteConfirm = (novel: any) => {
  novelToDelete.value = novel
  deleteConfirmationInput.value = ''
  isDeleteConfirmOpen.value = true
}

const handleDeleteNovel = async () => {
  if (!novelToDelete.value?.id) return
  if (deleteConfirmationInput.value.trim() !== novelToDelete.value.title) {
    toast.warning('Please type the exact title to confirm deletion')
    return
  }

  isDeleting.value = true
  try {
    const headers = await authStore.getAuthHeaders()
    await $fetch(`/api/novels/${novelToDelete.value.id}`, {
      method: 'DELETE',
      headers
    })

    toast.success('Novel serial purged from archives')
    isDeleteConfirmOpen.value = false
    novelToDelete.value = null
    refresh()
  } catch (err) {
    toast.error('Failed to purge novel serial')
  } finally {
    isDeleting.value = false
  }
}

useHead({
  title: 'Novels'
})
</script>

<template>
  <div class="space-y-8 font-ui">
    <!-- ===== HEADER ===== -->
    <div class="border-b-4 border-ink pb-4 space-y-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 class="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight">
            Novels
          </h2>
          <p class="font-mono text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">
            Manage novels and covers
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/admin/moderation" class="inline-flex border border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors hover:border-ink hover:bg-surface-raised">
            Moderation
          </NuxtLink>
          <NuxtLink to="/admin/scheduler" class="inline-flex border border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors hover:border-ink hover:bg-surface-raised">
            Scheduler
          </NuxtLink>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <UiCard>
          <span class="block text-[9px] uppercase tracking-wider text-ink-muted mb-1">Total novels</span>
          <span class="text-2xl font-black text-accent">{{ catalogCount }}</span>
        </UiCard>
        <UiCard>
          <span class="block text-[9px] uppercase tracking-wider text-ink-muted mb-1">Filtered results</span>
          <span class="text-2xl font-black text-accent">{{ filteredNovels.length }}</span>
        </UiCard>
        <UiCard>
          <span class="block text-[9px] uppercase tracking-wider text-ink-muted mb-1">Featured novels</span>
          <span class="text-2xl font-black text-accent">{{ featuredCount }}</span>
        </UiCard>
      </div>

      <div class="space-y-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 class="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight">
              Novel list
            </h2>
            <p class="font-mono text-[10px] uppercase tracking-wider text-ink-muted mt-0.5">
              Search and manage novels.
            </p>
          </div>
          <button
            @click="isCreateModalOpen = true"
            class="inline-flex border border-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors hover:bg-ink hover:text-paper text-ink font-bold bg-surface-raised"
          >
            New Novel
          </button>
        </div>
        <div class="flex w-full items-center gap-2">
          <UiInput v-model="searchQuery" type="search" placeholder="Search by title, author, status, genre..." class="w-full">
            <template #prefix>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="square" d="M21 21l-4.35-4.35m1.35-5.15a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
            </template>
          </UiInput>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-4">
      <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted">
        Results
      </p>
      <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted">
            Create a new novel and upload a cover image.
      </p>
    </div>

    <!-- ===== CATALOG list TABLE ===== -->
    <UiCard padded>
      <div class="overflow-x-auto">
        <table class="w-full text-left font-mono text-xs border-collapse">
        <thead>
          <tr class="bg-surface-raised border-b border-ink uppercase text-ink-muted font-bold tracking-wider">
            <th class="p-3">Cover</th>
            <th class="p-3">Novel Details</th>
            <th class="p-3 hidden md:table-cell">Author & Illustrator</th>
            <th class="p-3">Status</th>
            <th class="p-3">Chapters</th>
            <th class="p-3">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-rule">
          <tr v-if="pending">
            <td colspan="6" class="p-4 text-center">
              <UiSkeleton class="h-8 w-full" />
            </td>
          </tr>
          <tr v-else-if="!filteredNovels.length">
            <td colspan="6" class="p-8 text-center italic text-ink-muted font-body">
              No novels match the current filter.
            </td>
          </tr>
          <tr 
            v-else 
            v-for="novel in filteredNovels" 
            :key="novel.id"
            class="hover:bg-surface-raised transition-colors"
          >
            <!-- Cover -->
            <td class="p-3 w-16">
              <div class="w-10 h-14 bg-surface-sunken border border-rule overflow-hidden">
                <NuxtImg v-if="novel.coverUrl" :src="novel.coverUrl" width="40" height="56" class="w-full h-full object-cover" loading="lazy" />
              </div>
            </td>
            <!-- Title -->
            <td class="p-3 font-heading text-sm font-bold text-ink">
              <div class="flex items-center gap-1.5">
                <NuxtLink :to="`/novels/${novel.slug}`" class="hover:text-accent transition-colors block">
                  {{ novel.title }}
                </NuxtLink>
                <span v-if="novel.isFeatured" class="bg-accent text-white px-1.5 py-0.5 text-[8px] tracking-wider uppercase leading-none font-bold">Featured</span>
              </div>
              <span class="block font-mono text-[9px] text-ink-muted uppercase font-normal mt-0.5">Published: {{ novel.year || 'Unknown' }} &bull; Slug: {{ novel.slug }}</span>
            </td>
            <!-- Creators -->
            <td class="p-3 hidden md:table-cell text-ink-light">
              <span class="block">Author: {{ novel.author }}</span>
              <span v-if="novel.illustrator" class="block text-ink-muted">Artist: {{ novel.illustrator }}</span>
            </td>
            <!-- Status -->
            <td class="p-3">
              <span class="font-bold uppercase" :class="novel.status === 'ongoing' ? 'text-success' : 'text-accent'">
                {{ novel.status }}
              </span>
            </td>
            <!-- Chapters count -->
            <td class="p-3 font-bold text-ink-light">{{ novel.totalChapters }}</td>
            <!-- Actions -->
            <td class="p-3">
              <div class="flex flex-wrap gap-1.5">
                <button 
                  @click="openEditModal(novel)" 
                  class="px-2 py-1 border border-ink bg-paper text-ink hover:bg-ink hover:text-paper uppercase font-bold text-[9px]"
                >
                  Edit
                </button>
                <button 
                  v-if="authStore.isAdmin"
                  @click="openDeleteConfirm(novel)" 
                  class="px-2 py-1 border border-accent bg-paper text-accent hover:bg-accent hover:text-paper uppercase font-bold text-[9px]"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        </table>
      </div>
    </UiCard>

    <!-- New Novel Modal -->
    <component :is="AsyncModal" v-model:open="isCreateModalOpen" size="xl" title="New Novel">
      <form @submit.prevent="handleCreateNovel" class="space-y-4 font-mono text-xs max-h-[75vh] overflow-y-auto pr-1">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Title</label>
            <UiInput v-model="form.title" placeholder="e.g. Lora of the Antigravity..." required class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Original title</label>
            <UiInput v-model="form.originalTitle" placeholder="e.g. Japanese Title..." class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Author</label>
            <UiInput v-model="form.author" required class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Illustrator</label>
            <UiInput v-model="form.illustrator" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Status</label>
            <UiSelect v-model="form.status" :options="[{label:'Ongoing',value:'ongoing'},{label:'Hiatus',value:'hiatus'},{label:'Completed',value:'completed'}]" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Year</label>
            <UiInput v-model="form.year" type="text" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Publisher</label>
            <UiInput v-model="form.publisher" class="w-full" />
          </div>
        </div>

        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Cover image</label>
          <input type="file" accept="image/*" @change="handleCreateFileChange" class="w-full p-2 border border-rule bg-surface-sunken text-xs font-mono" />
          <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">Upload directly from your device.</p>
        </div>

        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Cover preview</label>
          <div class="w-full max-w-55 aspect-3/4 border border-rule bg-surface-sunken overflow-hidden">
            <img v-if="createCoverPreviewUrl" :src="createCoverPreviewUrl" alt="New cover preview" class="h-full w-full object-cover" />
            <div v-else class="flex h-full w-full items-center justify-center text-center px-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
              Preview appears here
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Genres</label>
          <UiInput v-model="form.genres" placeholder="Action, Fantasy, Romance..." class="w-full" />
        </div>

        <!-- NSFW & Spoiler tags -->
        <div class="flex items-center gap-6 py-2.5 border-y border-rule">
          <div class="flex items-center gap-2">
            <input type="checkbox" id="create-nsfw" v-model="form.isNsfw" class="h-4.5 w-4.5 text-accent focus:ring-accent border-ink cursor-pointer" />
            <label for="create-nsfw" class="uppercase font-bold text-ink cursor-pointer select-none">Mark NSFW</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="create-spoiler" v-model="form.isSpoiler" class="h-4.5 w-4.5 text-accent focus:ring-accent border-ink cursor-pointer" />
            <label for="create-spoiler" class="uppercase font-bold text-ink cursor-pointer select-none">Mark Spoiler</label>
          </div>
        </div>

        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Synopsis</label>
          <component :is="AsyncTextarea" v-model="form.synopsis" placeholder="Write a short synopsis..." :rows="4" required class="w-full" />
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-rule">
          <UiButton type="button" variant="secondary" @click="isCreateModalOpen = false">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :loading="isSubmitting">Save Novel</UiButton>
        </div>
      </form>
    </component>

    <!-- Edit Novel Modal -->
    <component :is="AsyncModal" v-model:open="isEditModalOpen" size="xl" title="Edit Novel">
      <form @submit.prevent="handleUpdateNovel" class="space-y-4 font-mono text-xs max-h-[75vh] overflow-y-auto pr-1">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Title</label>
            <UiInput v-model="formEdit.title" placeholder="e.g. Lora of the Antigravity..." required class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Original title</label>
            <UiInput v-model="formEdit.originalTitle" placeholder="e.g. Japanese Title..." class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Author</label>
            <UiInput v-model="formEdit.author" required class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Illustrator</label>
            <UiInput v-model="formEdit.illustrator" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Status</label>
            <UiSelect v-model="formEdit.status" :options="[{label:'Ongoing',value:'ongoing'},{label:'Hiatus',value:'hiatus'},{label:'Completed',value:'completed'}]" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Year</label>
            <UiInput v-model="formEdit.year" type="text" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block uppercase font-bold text-ink-muted mb-0.5">Publisher</label>
            <UiInput v-model="formEdit.publisher" class="w-full" />
          </div>
        </div>

        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Cover image</label>
          <input type="file" accept="image/*" @change="handleEditFileChange" class="w-full p-2 border border-rule bg-surface-sunken text-xs font-mono" />
          <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">Upload a new image to replace the current cover.</p>
        </div>

        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Cover preview</label>
          <div class="w-full max-w-55 aspect-3/4 border border-rule bg-surface-sunken overflow-hidden">
            <img v-if="editCoverPreviewUrl" :src="editCoverPreviewUrl" alt="Current cover preview" class="h-full w-full object-cover" />
            <div v-else class="flex h-full w-full items-center justify-center text-center px-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
              Preview appears here
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Genres</label>
          <UiInput v-model="formEdit.genres" placeholder="Action, Fantasy, Romance..." class="w-full" />
        </div>

        <!-- Featured, NSFW, and Spoiler checkboxes -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 py-2 border-y border-rule">
          <div v-if="authStore.isAdmin" class="flex items-center gap-2">
            <input type="checkbox" id="edit-isfeatured" v-model="formEdit.isFeatured" class="h-4.5 w-4.5 text-accent focus:ring-accent border-ink cursor-pointer" />
            <label for="edit-isfeatured" class="uppercase font-bold text-ink cursor-pointer select-none">Pin Featured</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="edit-nsfw" v-model="formEdit.isNsfw" class="h-4.5 w-4.5 text-accent focus:ring-accent border-ink cursor-pointer" />
            <label for="edit-nsfw" class="uppercase font-bold text-ink cursor-pointer select-none">Mark NSFW</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="edit-spoiler" v-model="formEdit.isSpoiler" class="h-4.5 w-4.5 text-accent focus:ring-accent border-ink cursor-pointer" />
            <label for="edit-spoiler" class="uppercase font-bold text-ink cursor-pointer select-none">Mark Spoiler</label>
          </div>
        </div>

        <div class="space-y-1">
          <label class="block uppercase font-bold text-ink-muted mb-0.5">Synopsis</label>
          <component :is="AsyncTextarea" v-model="formEdit.synopsis" placeholder="Write a short synopsis..." :rows="4" required class="w-full" />
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-rule">
          <UiButton type="button" variant="secondary" @click="isEditModalOpen = false">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :loading="isUpdating">Update Novel</UiButton>
        </div>
      </form>
    </component>

    <!-- Delete Confirmation Modal -->
    <component :is="AsyncModal" v-model:open="isDeleteConfirmOpen" title="Purge Light Novel Serial">
      <div v-if="novelToDelete" class="space-y-4 font-mono text-xs text-ink-light">
        <div class="p-3.5 bg-red-50 border border-accent text-accent uppercase font-bold tracking-wider leading-snug">
          Warning: This action is highly destructive and cannot be undone.
        </div>
        <p class="font-body text-sm text-ink leading-relaxed">
          You are preparing to purge <strong>{{ novelToDelete.title }}</strong> along with all its cataloged chapters, reviews, bookmarks, and associated assets from the platform database.
        </p>
        <div class="space-y-1.5">
          <label class="block uppercase font-bold text-ink-muted">Please type the name of the novel to confirm: <strong class="text-ink text-sm">"{{ novelToDelete.title }}"</strong></label>
          <UiInput v-model="deleteConfirmationInput" placeholder="Type novel title exactly..." class="w-full" />
        </div>
        
        <div class="flex justify-end gap-2 pt-4 border-t border-rule">
          <UiButton variant="secondary" @click="isDeleteConfirmOpen = false">Cancel</UiButton>
          <UiButton 
            variant="primary" 
            class="bg-accent hover:bg-accent-dark text-white border-accent disabled:opacity-50 disabled:cursor-not-allowed" 
            @click="handleDeleteNovel" 
            :loading="isDeleting"
            :disabled="deleteConfirmationInput.trim() !== novelToDelete.title"
          >
            Purge Catalog Item
          </UiButton>
        </div>
      </div>
    </component>
  </div>
</template>
