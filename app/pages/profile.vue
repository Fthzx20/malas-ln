<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

const authStore = useAuthStore()
const toast = useToast()

const displayName = ref('')
const bio = ref('')
const avatarUrl = ref('')
const avatarPreviewUrl = ref('')
const avatarFileName = ref('')
const avatarCropOpen = ref(false)
const avatarCropImageRef = ref<HTMLImageElement | null>(null)
const avatarCropViewportRef = ref<HTMLElement | null>(null)
const isUpdating = ref(false)
const isUploadingAvatar = ref(false)
const avatarInputRef = ref<HTMLInputElement | null>(null)
const pendingAvatarObjectUrl = ref('')
const pendingAvatarFile = ref<File | null>(null)

const cropViewportSize = ref(0)
const cropZoom = ref(1)
const cropPanX = ref(0)
const cropPanY = ref(0)
const cropNaturalWidth = ref(0)
const cropNaturalHeight = ref(0)
const cropBaseScale = ref(1)
const cropDragging = ref(false)

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

let cropResizeObserver: ResizeObserver | null = null
let cropDragOrigin = { x: 0, y: 0, panX: 0, panY: 0 }

const displayAvatarUrl = computed(() => avatarPreviewUrl.value || avatarUrl.value || '')
const cropSourceUrl = computed(() => pendingAvatarObjectUrl.value || displayAvatarUrl.value)

const cropImageStyle = computed(() => {
  if (!cropNaturalWidth.value || !cropNaturalHeight.value || !cropViewportSize.value) {
    return {}
  }

  const width = cropNaturalWidth.value * cropBaseScale.value * cropZoom.value
  const height = cropNaturalHeight.value * cropBaseScale.value * cropZoom.value

  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(-50%, -50%) translate(${cropPanX.value}px, ${cropPanY.value}px)`,
  }
})

const clampCropPan = (nextPanX: number, nextPanY: number) => {
  if (!cropViewportSize.value || !cropNaturalWidth.value || !cropNaturalHeight.value) {
    return { panX: nextPanX, panY: nextPanY }
  }

  const width = cropNaturalWidth.value * cropBaseScale.value * cropZoom.value
  const height = cropNaturalHeight.value * cropBaseScale.value * cropZoom.value
  const maxPanX = Math.max(0, (width - cropViewportSize.value) / 2)
  const maxPanY = Math.max(0, (height - cropViewportSize.value) / 2)

  return {
    panX: Math.min(maxPanX, Math.max(-maxPanX, nextPanX)),
    panY: Math.min(maxPanY, Math.max(-maxPanY, nextPanY)),
  }
}

const syncCropMetrics = () => {
  if (!avatarCropViewportRef.value || !cropNaturalWidth.value || !cropNaturalHeight.value) return

  const size = avatarCropViewportRef.value.clientWidth
  if (!size) return

  cropViewportSize.value = size
  cropBaseScale.value = Math.max(size / cropNaturalWidth.value, size / cropNaturalHeight.value)

  const clampedPan = clampCropPan(cropPanX.value, cropPanY.value)
  cropPanX.value = clampedPan.panX
  cropPanY.value = clampedPan.panY
}

const resetCropTransform = () => {
  cropZoom.value = 1
  cropPanX.value = 0
  cropPanY.value = 0
}

const setCropZoom = (nextZoom: number) => {
  const clampedZoom = Math.min(3, Math.max(1, nextZoom))
  cropZoom.value = clampedZoom

  const clampedPan = clampCropPan(cropPanX.value, cropPanY.value)
  cropPanX.value = clampedPan.panX
  cropPanY.value = clampedPan.panY
}

const revokePendingAvatar = () => {
  if (pendingAvatarObjectUrl.value) {
    URL.revokeObjectURL(pendingAvatarObjectUrl.value)
    pendingAvatarObjectUrl.value = ''
  }
}

const closeAvatarCrop = () => {
  avatarCropOpen.value = false
  revokePendingAvatar()
  pendingAvatarFile.value = null
  avatarFileName.value = ''
  cropResizeObserver?.disconnect()
  cropResizeObserver = null
  cropNaturalWidth.value = 0
  cropNaturalHeight.value = 0
  cropViewportSize.value = 0
  resetCropTransform()
  avatarPreviewUrl.value = authStore.profile?.avatarUrl || ''
  if (avatarInputRef.value) {
    avatarInputRef.value.value = ''
  }
}

const initAvatarCropper = async () => {
  await nextTick()
  if (!avatarCropViewportRef.value || !avatarCropImageRef.value) return

  cropResizeObserver?.disconnect()
  cropResizeObserver = new ResizeObserver(() => {
    syncCropMetrics()
  })
  cropResizeObserver.observe(avatarCropViewportRef.value)
  syncCropMetrics()
}

const syncProfileData = () => {
  if (!authStore.profile) return

  displayName.value = authStore.profile.displayName || ''
  bio.value = authStore.profile.bio || ''
  avatarUrl.value = authStore.profile.avatarUrl || ''
  avatarPreviewUrl.value = ''
  avatarFileName.value = ''
  pendingAvatarFile.value = null
  revokePendingAvatar()
}

watch(() => authStore.profile, syncProfileData)

onMounted(async () => {
  if (!authStore.profile && !authStore.isLoading) {
    try {
      const supabase = useSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await authStore.fetchProfile(session.access_token)
      }
    } catch {
      // Global middleware handles unauthenticated users.
    }
  }

  if (!authStore.isAuthenticated) {
    toast.warning('Authentication required. Redirecting to Login Desk...')
    navigateTo('/auth/login')
    return
  }

  syncProfileData()
})

const handleUpdateProfile = async () => {
  if (!displayName.value.trim()) {
    toast.warning('Display Name cannot be blank')
    return
  }

  isUpdating.value = true
  try {
    await authStore.updateProfile({
      displayName: displayName.value.trim(),
      bio: bio.value.trim(),
      avatarUrl: avatarUrl.value.trim() || null
    })
    toast.success('Gazette profile log updated')
  } catch (err) {
    toast.error('Failed to update profile logs')
  } finally {
    isUpdating.value = false
  }
}

const triggerAvatarPicker = () => {
  avatarInputRef.value?.click()
}

const handleAvatarUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.warning('Please select an image file')
    input.value = ''
    return
  }

  pendingAvatarFile.value = file
  avatarFileName.value = file.name
  revokePendingAvatar()
  pendingAvatarObjectUrl.value = URL.createObjectURL(file)
  avatarPreviewUrl.value = pendingAvatarObjectUrl.value
  avatarCropOpen.value = true
  input.value = ''
}

watch(avatarCropOpen, async (isOpen) => {
  if (isOpen) {
    await initAvatarCropper()
    return
  }

  cropResizeObserver?.disconnect()
  cropResizeObserver = null
})

const handleCropImageLoad = () => {
  if (!avatarCropImageRef.value) return
  cropNaturalWidth.value = avatarCropImageRef.value.naturalWidth || 0
  cropNaturalHeight.value = avatarCropImageRef.value.naturalHeight || 0
  syncCropMetrics()
  resetCropTransform()
}

const beginCropDrag = (event: PointerEvent) => {
  if (event.button !== 0) return
  cropDragging.value = true
  cropDragOrigin = {
    x: event.clientX,
    y: event.clientY,
    panX: cropPanX.value,
    panY: cropPanY.value,
  }
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
}

const moveCropDrag = (event: PointerEvent) => {
  if (!cropDragging.value) return
  const clampedPan = clampCropPan(
    cropDragOrigin.panX + (event.clientX - cropDragOrigin.x),
    cropDragOrigin.panY + (event.clientY - cropDragOrigin.y),
  )

  cropPanX.value = clampedPan.panX
  cropPanY.value = clampedPan.panY
}

watch(cropZoom, () => {
  const clampedPan = clampCropPan(cropPanX.value, cropPanY.value)
  cropPanX.value = clampedPan.panX
  cropPanY.value = clampedPan.panY
})

const handleCropZoomInput = (event: Event) => {
  const nextZoom = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(nextZoom)) return
  setCropZoom(nextZoom)
}

const endCropDrag = (event?: PointerEvent) => {
  cropDragging.value = false
  if (event?.currentTarget && 'releasePointerCapture' in event.currentTarget) {
    try {
      ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    } catch {
      // ignore capture release errors
    }
  }
}

const confirmAvatarCrop = async () => {
  if (!avatarCropImageRef.value || !pendingAvatarFile.value || !cropViewportSize.value || !cropNaturalWidth.value || !cropNaturalHeight.value) return

  isUploadingAvatar.value = true

  try {
    const outputSize = 512
    const scaleFactor = outputSize / cropViewportSize.value
    const canvas = document.createElement('canvas')
    canvas.width = outputSize
    canvas.height = outputSize

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to prepare crop canvas')
    }

    const drawWidth = cropNaturalWidth.value * cropBaseScale.value * cropZoom.value * scaleFactor
    const drawHeight = cropNaturalHeight.value * cropBaseScale.value * cropZoom.value * scaleFactor
    const drawX = (outputSize / 2) - (drawWidth / 2) + (cropPanX.value * scaleFactor)
    const drawY = (outputSize / 2) - (drawHeight / 2) + (cropPanY.value * scaleFactor)

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, outputSize, outputSize)
    context.drawImage(avatarCropImageRef.value, drawX, drawY, drawWidth, drawHeight)

    const croppedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    if (!croppedBlob) {
      throw new Error('Failed to export cropped avatar')
    }

    const baseName = pendingAvatarFile.value.name.replace(/\.[^.]+$/, '') || 'avatar'
    const croppedFile = new File([croppedBlob], `${baseName}-avatar.jpg`, { type: 'image/jpeg' })
    const formData = new FormData()
    formData.append('image', croppedFile)

    const headers = await authStore.getAuthHeaders().catch(() => undefined)
    const response = await withTimeout(
      $fetch<{ url: string }>('/api/user/avatar', {
        method: 'POST',
        body: formData,
        headers,
      }),
      20000,
      'Avatar upload timed out. Please try again.',
    )

    // Ensure the upload call includes auth headers if available
    // (some runtimes may not automatically include cookies in fetch)

    avatarUrl.value = response.url
    avatarPreviewUrl.value = response.url
    const updatedProfile = await withTimeout(
      authStore.updateProfile({ avatarUrl: response.url }),
      15000,
      'Avatar saved to storage, but profile update timed out. Please retry.',
    )
    if (updatedProfile?.avatarUrl) {
      avatarUrl.value = updatedProfile.avatarUrl
      avatarPreviewUrl.value = updatedProfile.avatarUrl
    }
    toast.success('Profile picture updated')
    closeAvatarCrop()
  } catch (err) {
    avatarPreviewUrl.value = authStore.profile?.avatarUrl || ''
    avatarFileName.value = ''
    pendingAvatarFile.value = null
    revokePendingAvatar()
    avatarCropOpen.value = false
    toast.error(err instanceof Error ? err.message : 'Failed to upload avatar')
  } finally {
    isUploadingAvatar.value = false
  }
}

onBeforeUnmount(() => {
  cropResizeObserver?.disconnect()
  revokePendingAvatar()
  if (avatarPreviewUrl.value && avatarPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
})

const AsyncTextarea = defineAsyncComponent(() => import('~/components/ui/UiTextarea.vue'))

useHead({
  title: 'Profile Settings',
  meta: [
    { name: 'description', content: 'Edit your literary profile credentials.' }
  ]
})
</script>

<template>
  <div class="container-curated py-8 sm:py-10">
    <div class="mx-auto max-w-5xl space-y-8">
      
      <!-- ===== SECTION HEADER ===== -->
      <div class="border-b-4 border-ink pb-4">
        <h2 class="font-heading text-3xl sm:text-4xl font-black uppercase tracking-tight">
          User Profile
        </h2>
        <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
          Identity logs &bull; Public bio settings
        </p>
      </div>

      <!-- Loading skeleton -->
      <div v-if="authStore.isLoading" class="space-y-4">
        <UiSkeleton class="h-10 w-full" />
        <UiSkeleton class="h-32 w-full" />
      </div>

      <div v-else-if="authStore.profile" class="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8 items-start">
        <aside class="border border-ink bg-paper p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
          <div class="flex items-center gap-4">
            <UiAvatar
              :src="displayAvatarUrl"
              :name="displayName"
              size="lg"
              class="border-2 border-ink"
            />
            <div class="min-w-0">
              <h3 class="font-heading text-xl font-black leading-tight wrap-break-word">{{ displayName }}</h3>
              <span class="font-mono text-[10px] text-accent uppercase font-bold tracking-wider">
                {{ authStore.userRole }}
              </span>
            </div>
          </div>

          <p class="text-sm font-body text-ink-muted leading-relaxed">
            {{ bio || 'No public log biography submitted yet.' }}
          </p>

          <div class="space-y-3 border-t border-rule pt-4">
            <div>
              <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted">Profile Picture</p>
              <p class="mt-1 text-sm text-ink">Upload a new image, then crop it to a square before saving.</p>
            </div>

            <input
              ref="avatarInputRef"
              type="file"
              accept="image/*"
              class="block w-full text-sm text-ink file:mr-3 file:border-0 file:bg-ink file:px-4 file:py-2 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.2em] file:text-paper hover:file:bg-accent-dark"
              @change="handleAvatarUpload"
            />

            <div v-if="avatarFileName" class="text-xs font-mono uppercase tracking-[0.18em] text-ink-muted">
              Selected: {{ avatarFileName }}
            </div>

            <UiButton type="button" variant="secondary" class="w-full" :loading="isUploadingAvatar" @click="triggerAvatarPicker">
              Choose & Crop Image
            </UiButton>
          </div>

          <div class="pt-2 border-t border-rule font-mono text-[10px] text-ink-muted uppercase space-y-2">
            <span class="block text-ink font-bold border-b border-rule pb-1">Activity Log</span>
            <div class="flex justify-between gap-3">
              <span>Account Status:</span>
              <span class="text-success font-bold">Active</span>
            </div>
            <div class="flex justify-between gap-3">
              <span>System Role:</span>
              <span class="text-ink font-bold">{{ authStore.userRole }}</span>
            </div>
          </div>
        </aside>

        <form @submit.prevent="handleUpdateProfile" class="border border-rule bg-surface p-5 sm:p-6 lg:p-8 space-y-6">
          <div class="flex items-start justify-between gap-4 border-b border-rule pb-3">
            <div>
              <h3 class="font-heading text-xl sm:text-2xl font-black uppercase tracking-tight">
                Modify Profile Logs
              </h3>
              <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted mt-1">
                Public metadata and bio
              </p>
            </div>
            <span class="hidden sm:inline-flex border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Live profile
            </span>
          </div>

          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div class="space-y-2 md:col-span-1">
              <label for="displayName" class="font-mono text-xs uppercase tracking-wider text-ink-muted block">
                curated Display Name
              </label>
              <UiInput
                id="displayName"
                v-model="displayName"
                type="text"
                required
                class="w-full"
              />
            </div>

            <div class="space-y-2 md:col-span-1">
              <label class="font-mono text-xs uppercase tracking-wider text-ink-muted block">
                Avatar Preview
              </label>
              <div class="flex items-center gap-3 border border-rule bg-paper p-3">
                <UiAvatar
                  :src="displayAvatarUrl"
                  :name="displayName"
                  size="md"
                  class="border border-ink"
                />
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-ink truncate">{{ avatarFileName || 'Current profile image' }}</p>
                  <p class="text-xs text-ink-muted">Changes are saved with the profile update.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <label for="bio" class="font-mono text-xs uppercase tracking-wider text-ink-muted block">
              Public Bio Statement
            </label>
            <component
              :is="AsyncTextarea"
              id="bio"
              v-model="bio"
              placeholder="Submit details of your literary journey or credentials..."
              :rows="6"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-xs font-mono uppercase tracking-[0.2em] text-ink-muted">
              Profile updates will remove the previous avatar from storage when a new image is saved.
            </p>
            <UiButton
              type="submit"
              variant="primary"
              :loading="isUpdating"
              class="w-full sm:w-auto"
            >
              Update Profile Logs
            </UiButton>
          </div>
        </form>
      </div>
    </div>

    <UiModal
      v-model:open="avatarCropOpen"
      title="Crop Profile Image"
      aria-label="Crop profile image"
      size="full"
      :closable="!isUploadingAvatar"
      :close-on-backdrop="!isUploadingAvatar"
    >
      <div class="mx-auto grid max-w-7xl gap-4 px-0 sm:px-2 lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_260px]">
        <div class="space-y-3 sm:space-y-4">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Crop box is fixed. Drag the image to reposition, then zoom to fit.
          </p>

          <div class="overflow-hidden border border-rule bg-surface-raised p-2 sm:p-3 lg:p-3.5">
            <div class="mx-auto w-full max-w-[min(56vw,300px)] space-y-3 sm:space-y-3.5">
              <div
                ref="avatarCropViewportRef"
                class="relative mx-auto aspect-square w-full overflow-hidden border border-rule bg-paper shadow-sm select-none touch-none cursor-grab active:cursor-grabbing"
                @pointerdown="beginCropDrag"
                @pointermove="moveCropDrag"
                @pointerup="endCropDrag"
                @pointercancel="endCropDrag"
                @pointerleave="endCropDrag"
              >
                <img
                  ref="avatarCropImageRef"
                  :src="cropSourceUrl"
                  alt="Avatar crop source"
                  class="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
                  :style="cropImageStyle"
                  draggable="false"
                  @load="handleCropImageLoad"
                />

                <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_calc(33.333%-0.5px),rgba(17,17,17,0.42)_calc(33.333%-0.5px),rgba(17,17,17,0.42)_calc(33.333%+0.5px),transparent_calc(33.333%+0.5px)),linear-gradient(to_right,transparent_calc(66.666%-0.5px),rgba(17,17,17,0.42)_calc(66.666%-0.5px),rgba(17,17,17,0.42)_calc(66.666%+0.5px),transparent_calc(66.666%+0.5px)),linear-gradient(to_bottom,transparent_calc(33.333%-0.5px),rgba(17,17,17,0.42)_calc(33.333%-0.5px),rgba(17,17,17,0.42)_calc(33.333%+0.5px),transparent_calc(33.333%+0.5px)),linear-gradient(to_bottom,transparent_calc(66.666%-0.5px),rgba(17,17,17,0.42)_calc(66.666%-0.5px),rgba(17,17,17,0.42)_calc(66.666%+0.5px),transparent_calc(66.666%+0.5px))] opacity-90" />
                <div class="pointer-events-none absolute inset-3 border border-ink/30 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]" />
              </div>

              <div class="space-y-2 rounded-none border border-rule bg-paper p-3 sm:p-4">
                <div class="flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-ink-muted">
                  <span>Zoom</span>
                  <button type="button" class="text-accent" @click="resetCropTransform">Reset</button>
                </div>
                <input :value="cropZoom" type="range" min="1" max="3" step="0.01" class="w-full accent-(--color-accent)" @input="handleCropZoomInput" />
                <div class="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-ink-muted">
                  <span>1x</span>
                  <span>{{ cropZoom.toFixed(2) }}x</span>
                  <span>3x</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4 border border-rule bg-paper p-4 sm:p-5 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">Preview</p>
            <div class="mt-3 space-y-3 border border-rule bg-surface p-3">
              <div class="relative aspect-square overflow-hidden border border-rule bg-paper">
                <img
                  :src="cropSourceUrl"
                  alt="Live crop preview"
                  class="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
                  :style="cropImageStyle"
                  draggable="false"
                />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-ink truncate">{{ avatarFileName || 'Profile avatar' }}</p>
                <p class="text-xs text-ink-muted">Live preview follows drag and zoom in real time.</p>
              </div>
            </div>
          </div>

          <div class="space-y-2 text-xs font-mono uppercase tracking-[0.18em] text-ink-muted">
            <p>Crop box: fixed square</p>
            <p>Image: draggable and zoomable</p>
            <p>Responsive width: up to 760px</p>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <UiButton type="button" variant="secondary" :disabled="isUploadingAvatar" @click="closeAvatarCrop">
            Cancel
          </UiButton>
          <UiButton type="button" variant="primary" :loading="isUploadingAvatar" @click="confirmAvatarCrop">
            Use Cropped Photo
          </UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>
