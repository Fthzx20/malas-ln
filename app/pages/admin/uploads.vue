<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'admin'
})

const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadedUrl = ref('')

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const formData = new FormData()
  formData.append('image', file)

  isUploading.value = true
  uploadedUrl.value = ''
  
  toast.info('Committing image asset to Cloudflare R2...')

  try {
    const data = await $fetch<any>('/api/upload/image?folder=covers', {
      method: 'POST',
      body: formData
    })

    if (data?.success) {
      uploadedUrl.value = data.url
      toast.success('Asset successfully uploaded to R2!')
    }
  } catch (err: any) {
    toast.error(err.data?.statusMessage || 'Upload failed')
  } finally {
    isUploading.value = false
  }
}

const selectUrl = (event: Event) => {
  (event.target as HTMLInputElement)?.select()
}

const triggerSelect = () => {
  fileInput.value?.click()
}

useHead({
  title: 'Upload Assets Desk'
})
</script>

<template>
  <div class="space-y-8 font-ui">
    <!-- ===== HEADER ===== -->
    <div class="border-b-4 border-ink pb-4">
      <h2 class="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight">
        The Upload Desk
      </h2>
      <p class="font-mono text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">
        Asset Pipeline &bull; Cloudflare R2 S3 Uploads Manager
      </p>
    </div>

    <!-- ===== DRAG & DROP UPLOAD ZONE ===== -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- Uploader (Col span 7) -->
      <main class="lg:col-span-7 space-y-6">
        <div 
          @click="triggerSelect"
          class="border-2 border-dashed border-ink hover:border-accent p-12 text-center bg-paper cursor-pointer transition-colors space-y-4"
        >
          <input 
            type="file" 
            ref="fileInput"
            class="hidden" 
            accept="image/*"
            @change="handleFileUpload"
          />
          
          <div class="flex flex-col items-center justify-center text-ink-muted space-y-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="square" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="font-heading text-sm font-bold text-ink">Select Asset to Commit</span>
            <span class="font-mono text-[9px] uppercase">JPEG, PNG, WEBP, AVIF up to 5MB</span>
          </div>

          <div v-if="isUploading" class="pt-4 flex items-center justify-center gap-2 font-mono text-xs text-accent animate-pulse font-bold">
            <span>Uploading...</span>
          </div>
        </div>

        <!-- Result URL Panel -->
        <div v-if="uploadedUrl" class="border border-ink p-5 bg-surface space-y-3 font-mono text-xs">
          <h3 class="font-heading text-base font-black border-b border-ink pb-1.5 uppercase">Asset Committed</h3>
          <div>
            <span class="block text-ink-muted uppercase text-[9px] font-bold mb-0.5">Asset Public URL</span>
            <input 
              type="text" 
              readonly
              :value="uploadedUrl"
              class="w-full p-2 bg-surface-sunken border border-rule focus:outline-none text-[10px] text-ink"
              @click="selectUrl"
            />
          </div>
            <div class="aspect-3/4 max-w-37.5 border border-rule overflow-hidden bg-surface-sunken">
            <NuxtImg :src="uploadedUrl" width="150" height="200" class="w-full h-full object-cover" loading="lazy" />
          </div>
        </div>
      </main>

      <!-- Context box (Col span 5) -->
      <aside class="lg:col-span-5 border border-ink p-5 bg-paper font-mono text-xs text-ink-muted space-y-4">
        <h4 class="font-heading text-sm font-black text-ink border-b border-rule pb-1.5 uppercase">Direct S3 Pipeline</h4>
        <p class="font-body leading-relaxed text-ink-light">
          This desk interfaces directly with your Cloudflare R2 bucket. Assets committed here generate instantaneous S3 API urls.
        </p>
        <p class="font-body leading-relaxed text-ink-light">
          Copy the generated URL and paste it into the **Catalog New Series** cover input to complete publication indexing.
        </p>
      </aside>
    </div>
  </div>
</template>
