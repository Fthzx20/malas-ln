<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { clientLogger } from '~/utils/client-logger'
import { idbGet, idbSet } from '~/utils/idb'
import { Editor as EditorClass } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import BubbleMenuExt from '@tiptap/extension-bubble-menu'
import Placeholder from '@tiptap/extension-placeholder'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  modelValue: { type: String, default: '' },
  storageKey: { type: String, default: 'tiptap-draft' },
  debounceMs: { type: Number, default: 1500 },
})

const emit = defineEmits(['update:modelValue'])

const authStore = useAuthStore()
const toast = useToast()

let editor: any = null
const editorReady = ref(false)
const root = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const editorError = ref<string | null>(null)
const isFullscreen = ref(false)
const isFocusMode = ref(false) // distraction-free mode
const isUploadingImage = ref(false)
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const lastSavedAt = ref<number | null>(null)
const wordCount = ref(0)
const characterCount = ref(0)
const shortcutHintsOpen = ref(false)

// Slash Command states
const showSlashMenu = ref(false)
const slashMenuX = ref(0)
const slashMenuY = ref(0)
const selectedSlashIndex = ref(0)

const slashItems = [
  { label: 'Heading 1', desc: 'Large section heading', icon: 'H1', action: (ed: any) => applyBlockFormat(ed, 'h1') },
  { label: 'Heading 2', desc: 'Medium section heading', icon: 'H2', action: (ed: any) => applyBlockFormat(ed, 'h2') },
  { label: 'Blockquote', desc: 'Insert an curated quote', icon: '“', action: (ed: any) => applyBlockFormat(ed, 'blockquote') },
  { label: 'Bullet List', desc: 'Simple bullet list', icon: '•', action: (ed: any) => applyBlockFormat(ed, 'bullet') },
  { label: 'Numbered List', desc: 'Sequential numbered list', icon: '1.', action: (ed: any) => applyBlockFormat(ed, 'number') },
  { label: 'Divider Line', desc: 'Crisp structural border rule', icon: '—', action: (ed: any) => applyBlockFormat(ed, 'rule') },
  { label: 'Upload Illustration', desc: 'Embed Cloudflare R2 image asset', icon: '🖼️', action: (ed: any) => triggerImagePicker() }
]

const runCommand = (command: (instance: any) => void) => {
  if (!editor) return
  command(editor)
}

const updateMetrics = (instance: any) => {
  const text = instance?.getText?.() || ''
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  wordCount.value = words
  characterCount.value = text.replace(/\s+/g, ' ').trim().length
}

const markSaved = () => {
  saveState.value = 'saved'
  lastSavedAt.value = Date.now()
  window.setTimeout(() => {
    if (saveState.value === 'saved') {
      saveState.value = 'idle'
    }
  }, 2000)
}

const toggleBold = () => runCommand(instance => instance.chain().focus().toggleBold().run())
const toggleItalic = () => runCommand(instance => instance.chain().focus().toggleItalic().run())
const toggleHeading = (level: 1 | 2) => runCommand(instance => instance.chain().focus().toggleHeading({ level }).run())
const toggleBulletList = () => runCommand(instance => instance.chain().focus().toggleBulletList().run())
const toggleOrderedList = () => runCommand(instance => instance.chain().focus().toggleOrderedList().run())
const toggleBlockquote = () => runCommand(instance => instance.chain().focus().toggleBlockquote().run())
const undo = () => runCommand(instance => instance.chain().focus().undo().run())
const redo = () => runCommand(instance => instance.chain().focus().redo().run())

const triggerImagePicker = () => {
  showSlashMenu.value = false
  fileInput.value?.click()
}

// Dialog-based illustration caption uploader
const isCaptionModalOpen = ref(false)
const imageToCaptionUrl = ref('')
const imageCaptionText = ref('')

const insertUploadedImage = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.warning('Please select an image file')
    return
  }

  isUploadingImage.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)

    const headers = await authStore.getAuthHeaders()
    const data = await $fetch<any>('/api/upload/image?folder=illustrations', {
      method: 'POST',
      body: formData,
      headers,
    })

    if (!data?.url) {
      throw new Error('Upload did not return a public URL')
    }

    // Open caption dialog instead of inserting instantly
    imageToCaptionUrl.value = data.url
    imageCaptionText.value = ''
    isCaptionModalOpen.value = true
    toast.success('Illustration uploaded to pipeline!')
  } catch (err: any) {
    toast.error(err?.data?.statusMessage || err?.message || 'Image upload failed')
  } finally {
    isUploadingImage.value = false
  }
}

const commitImageWithCaption = () => {
  if (!editor || !imageToCaptionUrl.value) return

  // Format as a complete semantic figure markup
  const caption = imageCaptionText.value.trim()
  const figureHtml = caption 
    ? `<figure class="curated-figure"><img src="${imageToCaptionUrl.value}" alt="${caption}" /><figcaption>${caption}</figcaption></figure><p></p>`
    : `<img src="${imageToCaptionUrl.value}" alt="Illustration" />`

  editor.chain().focus().insertContent(figureHtml).run()
  isCaptionModalOpen.value = false
  imageToCaptionUrl.value = ''
  imageCaptionText.value = ''
  toast.success('Illustration embedded with caption!')
}

const handleImageInputChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    await insertUploadedImage(file)
  }
  target.value = ''
}

function applyBlockFormat(ed: any, type: string) {
  showSlashMenu.value = false
  const { selection } = ed.state
  const { $from } = selection
  
  // Delete the slash character '/' typed
  ed.chain().focus().deleteRange({ from: $from.pos - 1, to: $from.pos }).run()

  if (type === 'h1') ed.chain().focus().toggleHeading({ level: 1 }).run()
  else if (type === 'h2') ed.chain().focus().toggleHeading({ level: 2 }).run()
  else if (type === 'blockquote') ed.chain().focus().toggleBlockquote().run()
  else if (type === 'bullet') ed.chain().focus().toggleBulletList().run()
  else if (type === 'number') ed.chain().focus().toggleOrderedList().run()
  else if (type === 'rule') ed.chain().focus().setHorizontalRule().run()
}

// Watch key presses for slash command menu & shortcuts
const handleEditorKeyDown = (view: any, event: KeyboardEvent) => {
  if (showSlashMenu.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedSlashIndex.value = (selectedSlashIndex.value + 1) % slashItems.length
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedSlashIndex.value = (selectedSlashIndex.value - 1 + slashItems.length) % slashItems.length
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const selected = slashItems[selectedSlashIndex.value]
      if (selected) selected.action(editor)
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      showSlashMenu.value = false
      return true
    }
  }
  return false
}

// Check if slash command typed
const checkSlashCommand = (instance: any) => {
  const { state } = instance
  const { selection } = state
  const { $from } = selection
  
  // Get text of current block up to cursor
  const textBefore = $from.parent.textContent
  const posInBlock = $from.parentOffset

  if (textBefore.substring(0, posInBlock) === '/') {
    // Determine positioning coordinates
    const coords = instance.view.coordsAtPos($from.pos)
    
    // Position menu just below the cursor line
    slashMenuX.value = Math.max(16, coords.left - 8)
    slashMenuY.value = coords.top + window.scrollY + 20
    selectedSlashIndex.value = 0
    showSlashMenu.value = true
  } else {
    showSlashMenu.value = false
  }
}

function debounce(fn: (...args: any[]) => void, ms = 1500) {
  let t: any
  return (...args: any[]) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

onMounted(async () => {
  try {
    let initial = props.modelValue || ''
    try {
      const saved = await idbGet('malaz-editor', 'drafts', props.storageKey)
      if (saved && !initial) initial = saved
    } catch (e) {
      // ignore
    }

    const debouncedSave = debounce(async (val: string) => {
      try {
        saveState.value = 'saving'
        await idbSet('malaz-editor', 'drafts', props.storageKey, val)
        markSaved()
      } catch (err) {
        saveState.value = 'error'
      }
    }, props.debounceMs)

    await nextTick()

    editor = new EditorClass({
      element: root.value as any,
      content: initial,
      extensions: [
        StarterKit, 
        Image.configure({
          inline: false,
          allowBase64: false,
        }),
        BubbleMenuExt.configure({
          element: document.getElementById('malaz-bubble-menu'),
          tippyOptions: { duration: 150 },
        }),
        Placeholder.configure({
          placeholder: 'Type "/" to trigger curated slash commands, or start writing your serial manuscript...',
        })
      ],
      editorProps: {
        handleDrop(_view: any, event: DragEvent) {
          const files = Array.from(event.dataTransfer?.files || [])
          const imageFile = files.find(file => file.type.startsWith('image/'))
          if (!imageFile) return false

          event.preventDefault()
          void insertUploadedImage(imageFile)
          return true
        },
        handleKeyDown: handleEditorKeyDown
      },
      onUpdate: ({ editor: ed }: any) => {
        const html = ed.getHTML()
        updateMetrics(ed)
        checkSlashCommand(ed)
        emit('update:modelValue', html)
        debouncedSave(html)
      },
      onSelectionUpdate: ({ editor: ed }: any) => {
        checkSlashCommand(ed)
      }
    })

    updateMetrics(editor)
    saveState.value = initial ? 'saved' : 'idle'
    if (initial) {
      lastSavedAt.value = Date.now()
    }

    editorReady.value = true
  } catch (err: any) {
    clientLogger.error('[TiptapEditor] load error', err)
    editorError.value = String(err && (err.message || err))
  }
})

onBeforeUnmount(() => {
  if (editor && editor.destroy) editor.destroy()
  document.body.style.overflow = ''
})

watch([isFullscreen, isFocusMode], () => {
  if (!import.meta.client) return
  document.body.style.overflow = (isFullscreen.value || isFocusMode.value) ? 'hidden' : ''
})

const saveLabel = () => {
  if (saveState.value === 'saving') return 'Saving draft…'
  if (saveState.value === 'error') return 'Autosave error'
  if (saveState.value === 'saved') return lastSavedAt.value ? `Saved ${new Date(lastSavedAt.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved'
  return 'Ready'
}
</script>

<template>
  <div :class="[
    isFullscreen ? 'fixed inset-0 z-[60] bg-surface flex flex-col h-screen' : '',
    isFocusMode ? 'fixed inset-0 z-[60] bg-paper-warm text-ink flex flex-col h-screen overflow-y-auto' : 'relative'
  ]">
    <!-- ===== EDITOR HEAD/TOOLBAR ===== -->
    <div class="sticky top-0 z-20 border-b border-rule bg-surface/98 backdrop-blur px-4 py-3 flex flex-col gap-3">
      <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="handleImageInputChange" />

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-muted">
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" title="Bold (Ctrl+B)" @click="toggleBold">Bold</button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" title="Italic (Ctrl+I)" @click="toggleItalic">Italic</button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" title="Heading 1" @click="toggleHeading(1)">H1</button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" title="Heading 2" @click="toggleHeading(2)">H2</button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" title="Blockquote" @click="toggleBlockquote">Quote</button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" title="Bullet list" @click="toggleBulletList">Bullets</button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" title="Numbered list" @click="toggleOrderedList">Numbers</button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" title="Insert image" @click="triggerImagePicker">
            {{ isUploadingImage ? 'Uploading...' : 'Image' }}
          </button>
        </div>

        <div class="ml-auto flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider">
          <button 
            type="button" 
            class="px-2.5 py-1.5 border hover:bg-ink hover:text-paper transition-colors"
            :class="isFocusMode ? 'bg-ink text-paper border-ink' : 'border-rule bg-paper'"
            title="Toggle distraction-free focus mode" 
            @click="isFocusMode = !isFocusMode"
          >
            {{ isFocusMode ? 'Exit Focus Mode' : 'Focus Mode' }}
          </button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" @click="shortcutHintsOpen = !shortcutHintsOpen">
            Shortcuts
          </button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" @click="isFullscreen = !isFullscreen">
            {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
          </button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" @click="undo">Undo</button>
          <button type="button" class="px-2.5 py-1.5 border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors" @click="redo">Redo</button>
        </div>
      </div>

      <div class="flex flex-col gap-2 text-[10px] font-mono uppercase tracking-wider text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1">
            <span class="h-1.5 w-1.5 rounded-full" :class="saveState === 'saving' ? 'bg-amber-500' : saveState === 'error' ? 'bg-red-500' : 'bg-emerald-500'"></span>
            {{ saveLabel() }}
          </span>
          <span class="inline-flex items-center rounded-full border border-rule bg-paper px-2.5 py-1">{{ wordCount }} words</span>
          <span class="inline-flex items-center rounded-full border border-rule bg-paper px-2.5 py-1">{{ characterCount }} chars</span>
        </div>

        <p class="hidden sm:block text-ink-faint">
          Tip: Type <kbd class="rounded border border-rule bg-paper px-1 py-0.5">/</kbd> on an empty line for quick layout slash commands.
        </p>
      </div>

      <div v-if="shortcutHintsOpen" class="grid gap-2 rounded border border-rule bg-paper p-3 text-[10px] font-mono uppercase tracking-wider text-ink-muted sm:grid-cols-2">
        <span>Ctrl+B · Bold</span>
        <span>Ctrl+I · Italic</span>
        <span>Ctrl+Alt+1 · Heading 1</span>
        <span>Ctrl+Alt+2 · Heading 2</span>
        <span>/ · Slash Command Menu</span>
        <span>Drag &amp; Drop illustration file here · commits instantly</span>
      </div>
    </div>

    <!-- ===== WRITING CANVAS ===== -->
    <div :class="[
      isFullscreen ? 'flex-1 overflow-y-auto' : '',
      isFocusMode ? 'flex-1 max-w-3xl mx-auto w-full px-6 py-12 bg-paper-warm' : 'min-h-[60vh]'
    ]">
      <div v-if="editorError" class="m-3 rounded border border-rule bg-paper p-4 text-red-600">Editor failed to load: {{ editorError }}</div>
      <div v-else-if="!editorReady" class="m-3 rounded border border-rule bg-paper p-4">Loading editor…</div>
      
      <!-- Editor Root -->
      <div ref="root" class="malaz-rich-text malaz-rich-text--editor min-h-80 select-text max-w-3xl mx-auto leading-relaxed prose prose-ink focus:outline-none" />
    </div>

    <!-- ===== NOTION-STYLE INTERACTIVE SLASH COMMANDS MENU ===== -->
    <Teleport to="body">
      <div 
        v-if="showSlashMenu" 
        class="fixed z-[100] w-64 border border-ink bg-paper shadow-lg font-mono text-[11px] uppercase overflow-hidden divide-y divide-rule"
        :style="{ left: `${slashMenuX}px`, top: `${slashMenuY}px` }"
      >
        <div class="px-3 py-1.5 bg-surface-raised text-ink-muted text-[9px] tracking-wider leading-none">
          curated Blocks
        </div>
        <div class="max-h-56 overflow-y-auto">
          <button
            v-for="(item, idx) in slashItems"
            :key="item.label"
            type="button"
            class="w-full text-left px-3 py-2 flex items-center gap-3 transition-colors hover:bg-surface-raised"
            :class="idx === selectedSlashIndex ? 'bg-ink text-paper hover:bg-ink hover:text-paper font-bold' : 'text-ink-light bg-paper'"
            @click="item.action(editor)"
          >
            <span class="w-6 h-6 border flex items-center justify-center font-heading text-xs" :class="idx === selectedSlashIndex ? 'border-paper' : 'border-rule'">
              {{ item.icon }}
            </span>
            <div class="min-w-0 flex-1 leading-tight">
              <p class="font-bold truncate text-[11px]">{{ item.label }}</p>
              <p class="text-[8px] truncate mt-0.5" :class="idx === selectedSlashIndex ? 'text-paper-warm/80' : 'text-ink-faint'">{{ item.desc }}</p>
            </div>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- ===== FLOATING curated BUBBLE FORMATTING MENU ===== -->
    <div 
      id="malaz-bubble-menu" 
      v-show="editor?.isActive"
      class="z-50 bg-ink text-paper border border-ink shadow-md flex items-center gap-0.5 overflow-hidden p-1 font-mono text-[9px] uppercase tracking-wider"
    >
      <button type="button" class="px-2 py-1 hover:bg-accent transition-colors" @click="toggleBold">Bold</button>
      <button type="button" class="px-2 py-1 hover:bg-accent transition-colors" @click="toggleItalic">Italic</button>
      <button type="button" class="px-2 py-1 hover:bg-accent transition-colors" @click="toggleHeading(1)">H1</button>
      <button type="button" class="px-2 py-1 hover:bg-accent transition-colors" @click="toggleHeading(2)">H2</button>
      <button type="button" class="px-2 py-1 hover:bg-accent transition-colors" @click="toggleBlockquote">Quote</button>
    </div>

    <!-- ===== ILLUSTRATION CAPTION MODAL ===== -->
    <UiModal v-model:open="isCaptionModalOpen" title="Illustration Details">
      <div class="font-mono text-xs space-y-4">
        <div class="aspect-video max-h-48 border border-rule overflow-hidden bg-surface-sunken flex items-center justify-center">
          <NuxtImg :src="imageToCaptionUrl" class="max-w-full max-h-full object-contain" />
        </div>
        
        <div class="space-y-1.5">
          <label class="block uppercase font-bold text-ink-muted">Illustration Caption (Optional)</label>
          <UiInput v-model="imageCaptionText" placeholder="e.g. Volume 2 Chapter 1 Scene 3. The dual battle begins..." class="w-full" />
          <p class="text-[9px] text-ink-faint leading-tight">Captions are styled inline underneath illustrations in centered reading panels.</p>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-rule">
          <UiButton variant="secondary" @click="isCaptionModalOpen = false">Skip Caption</UiButton>
          <UiButton variant="primary" @click="commitImageWithCaption">Embed Illustration</UiButton>
        </div>
      </div>
    </UiModal>
  </div>
</template>

<style>
/* Tiptap Placeholder Styling */
.ProseMirror p.is-editor-empty:first-child::before {
  color: var(--color-ink-faint);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  font-style: italic;
  font-family: var(--font-body);
}

/* ProseMirror focus rings disabled (handled by editor wrappers) */
.ProseMirror:focus {
  outline: none !important;
}

/* Nice spacing inside editor ProseMirror area */
.ProseMirror {
  min-height: 50vh;
  padding: 1.5rem;
}

.ProseMirror p {
  margin-bottom: 1.25em !important;
  line-height: 1.85 !important;
}

.ProseMirror blockquote {
  border-left: 4px solid var(--color-accent) !important;
  padding-left: 1.25rem !important;
  margin: 1.5rem 0 !important;
  font-style: italic !important;
  color: var(--color-ink-muted) !important;
  background-color: var(--color-surface-raised) !important;
  padding: 0.75rem 1.25rem !important;
}

.ProseMirror img {
  max-width: 100%;
  height: auto;
  margin: 2rem auto !important;
  border: 1px solid var(--color-rule);
  display: block;
}

.ProseMirror figure {
  margin: 2rem auto !important;
  border: 1px solid var(--color-rule);
  background-color: var(--color-surface-raised);
  padding: 0.75rem;
  max-width: 90%;
}

.ProseMirror figure img {
  margin: 0 auto !important;
  border: none !important;
}

.ProseMirror figcaption {
  text-align: center;
  font-size: 0.85em;
  color: var(--color-ink-muted);
  margin-top: 0.5rem;
  font-family: var(--font-ui);
}

.ProseMirror hr {
  margin: 2.5rem 0 !important;
  border: none;
  border-top: 1px solid var(--color-rule-dark) !important;
}

/* Distraction-free focus mode styling override */
.bg-paper-warm .ProseMirror {
  font-family: var(--font-body) !important;
  font-size: 1.15rem !important;
  line-height: 1.95 !important;
}
</style>
