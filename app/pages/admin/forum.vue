<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'admin',
  ssr: false
})

const toast = useToast()
const authStore = useAuthStore()
const AsyncModal = defineAsyncComponent(() => import('~/components/ui/UiModal.vue'))

interface Category {
  id: string
  name: string
  slug: string
  description: string
  sortOrder: number
}

const getAdminHeaders = () => authStore.getAuthHeaders().then(headers => headers || {})

const {
  data: categoriesData,
  pending: isLoading,
  refresh: refreshCategories,
  error: categoriesError,
} = await useAsyncData(
  'admin-forum-categories',
  async () => {
    const headers = await getAdminHeaders()
    const response = await $fetch<{ categories: Category[] }>('/api/admin/forum/categories', { headers })
    return response?.categories || []
  },
  {
    default: () => [],
    lazy: false,
  },
)

const categories = computed(() => categoriesData.value || [])

watch(categoriesError, (err) => {
  if (err) {
    toast.error('Failed to load categories')
  }
})

const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)

const form = ref<Partial<Category>>({
  name: '',
  slug: '',
  description: '',
  sortOrder: 0
})

const openCreateModal = () => {
  isEditing.value = false
  form.value = { name: '', slug: '', description: '', sortOrder: 0 }
  showModal.value = true
}

const handleNameInput = (value: string) => {
  form.value.name = value
  if (!isEditing.value && !form.value.slug?.trim()) {
    form.value.slug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
  }
}

const openEditModal = (cat: Category) => {
  isEditing.value = true
  form.value = { ...cat }
  showModal.value = true
}

const saveCategory = async () => {
  isSaving.value = true
  try {
    const headers = await getAdminHeaders()
    const method = isEditing.value ? 'PUT' : 'POST'
    
    await $fetch('/api/admin/forum/categories', {
      method,
      headers,
      body: form.value
    })
    
    toast.success(`Category ${isEditing.value ? 'updated' : 'created'} successfully`)
    showModal.value = false
    await refreshCategories()
  } catch (err: any) {
    toast.error(err.data?.message || 'Failed to save category')
  } finally {
    isSaving.value = false
  }
}

const deleteCategory = async (id: string) => {
  if (!confirm('Are you sure you want to delete this category? This will delete all posts and replies inside it!')) return
  
  try {
    const headers = await getAdminHeaders()
    await $fetch('/api/admin/forum/categories', {
      method: 'DELETE',
      headers,
      body: { id }
    })
    toast.success('Category deleted')
    await refreshCategories()
  } catch (err) {
    toast.error('Failed to delete category')
  }
}

useHead({ title: 'Forum Categories | Admin' })
</script>

<template>
  <div class="space-y-6 font-ui">
    <div class="flex items-center justify-between border-b-4 border-ink pb-4">
      <div>
        <h2 class="font-heading text-3xl font-black uppercase tracking-tight">Forum Setup</h2>
        <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">Manage Categories & Divisions</p>
      </div>
      <button
        @click="openCreateModal"
        class="border border-ink bg-ink text-paper px-6 py-2.5 font-bold text-sm hover:bg-accent hover:border-accent transition-colors uppercase tracking-wider font-mono"
      >
        + New Category
      </button>
    </div>

    <div v-if="isLoading" class="p-12 text-center text-ink-muted flex flex-col items-center justify-center space-y-4">
      <UiSkeleton class="w-12 h-12 rounded-full" />
      <span class="font-mono text-sm uppercase">Loading categories...</span>
    </div>

    <main v-else class="border border-ink bg-surface overflow-x-auto">
      <table class="w-full text-left font-mono text-xs border-collapse min-w-175">
        <thead>
          <tr class="bg-surface-raised border-b border-ink uppercase text-ink-muted font-bold tracking-wider">
            <th class="p-3 w-16">Sort</th>
            <th class="p-3">Category Name</th>
            <th class="p-3">Slug</th>
            <th class="p-3">Description</th>
            <th class="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-rule">
          <tr v-if="!categories.length">
            <td colspan="5" class="p-8 text-center italic text-ink-muted font-body">
              No categories found. Create one to start your forum.
            </td>
          </tr>
          <tr 
            v-else 
            v-for="cat in categories" 
            :key="cat.id"
            class="hover:bg-surface-raised transition-colors"
          >
            <td class="p-3 font-bold text-ink text-center">{{ cat.sortOrder }}</td>
            <td class="p-3 font-bold text-ink">{{ cat.name }}</td>
            <td class="p-3 text-ink-light">{{ cat.slug }}</td>
            <td class="p-3 max-w-70 truncate text-ink-light" :title="cat.description">{{ cat.description }}</td>
            <td class="p-3 text-right">
              <div class="flex justify-end gap-2">
                <button @click="openEditModal(cat)" class="px-2 py-1 bg-ink text-paper hover:bg-accent uppercase font-bold text-[9px]">Edit</button>
                <button @click="deleteCategory(cat.id)" class="px-2 py-1 border border-accent bg-paper text-accent hover:bg-accent hover:text-paper uppercase font-bold text-[9px]">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </main>

    <AsyncModal
      :open="showModal"
      size="xl"
      :title="isEditing ? 'Edit Category' : 'Create Category'"
      @update:open="showModal = $event"
    >
      <form @submit.prevent="saveCategory" class="space-y-5">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">Category Name</label>
            <UiInput :model-value="form.name || ''" placeholder="e.g. General Discussion" required @update:model-value="handleNameInput" />
          </div>

          <div class="space-y-2">
            <label class="font-mono text-xs uppercase tracking-wider font-bold">URL Slug</label>
            <UiInput v-model="form.slug" placeholder="e.g. general" required />
            <p class="text-[10px] text-ink-muted">Must be lowercase, no spaces.</p>
          </div>
        </div>

        <div class="space-y-2">
          <label class="font-mono text-xs uppercase tracking-wider font-bold">Description</label>
          <textarea v-model="form.description" class="w-full min-h-30 px-3 py-2 border border-rule bg-surface font-body text-sm focus:border-accent focus:outline-none" rows="4" placeholder="Brief description of this division" />
        </div>

        <div class="space-y-2">
          <label class="font-mono text-xs uppercase tracking-wider font-bold">Sort Order</label>
          <UiInput
            :model-value="String(form.sortOrder ?? 0)"
            type="number"
            required
            @update:model-value="(value) => { form.sortOrder = Number(value || 0) }"
          />
          <p class="text-[10px] text-ink-muted">Lower numbers appear first.</p>
        </div>
      </form>

      <template #footer>
        <div class="flex items-center justify-end gap-3">
          <UiButton variant="secondary" @click="showModal = false">Cancel</UiButton>
          <UiButton variant="primary" :loading="isSaving" @click="saveCategory">
            {{ isEditing ? 'Update Category' : 'Create Category' }}
          </UiButton>
        </div>
      </template>
    </AsyncModal>
  </div>
</template>
