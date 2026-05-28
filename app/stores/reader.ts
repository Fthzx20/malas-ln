import { defineStore } from 'pinia'

export type AmbientTheme = 'day' | 'night' | 'sepia' | 'editorial'
export type ReaderFont = 'Lora' | 'Inter' | 'JetBrains Mono'

interface ReaderState {
  fontSize: number // 14-26
  lineHeight: number // 1.5-2.0
  fontFamily: ReaderFont
  theme: AmbientTheme
  maxWidth: number // 600-900
  showFootnotes: boolean
}

export const useReaderStore = defineStore('reader', {
  state: (): ReaderState => ({
    fontSize: 18,
    lineHeight: 1.75,
    fontFamily: 'Lora',
    theme: 'day',
    maxWidth: 720,
    showFootnotes: true,
  }),

  getters: {
    cssVars: (state) => ({
      '--reader-font-size': `${state.fontSize}px`,
      '--reader-line-height': `${state.lineHeight}`,
      '--reader-font-family': state.fontFamily === 'Lora'
        ? "'Lora', Georgia, serif"
        : state.fontFamily === 'Inter'
          ? "'Inter', -apple-system, sans-serif"
          : "'JetBrains Mono', monospace",
      '--reader-max-width': `${state.maxWidth}px`,
    }),
  },

  actions: {
    setFontSize(size: number) {
      this.fontSize = Math.min(26, Math.max(14, size))
    },

    setLineHeight(height: number) {
      this.lineHeight = Math.min(2.0, Math.max(1.5, Math.round(height * 10) / 10))
    },

    setFontFamily(font: ReaderFont) {
      this.fontFamily = font
    },

    setTheme(theme: AmbientTheme) {
      this.theme = theme
    },

    setMaxWidth(width: number) {
      // Allow smaller max widths for mobile devices (min 280px)
      this.maxWidth = Math.min(900, Math.max(280, width))
    },

    increaseFontSize() {
      this.setFontSize(this.fontSize + 1)
    },

    decreaseFontSize() {
      this.setFontSize(this.fontSize - 1)
    },

    resetDefaults() {
      this.fontSize = 18
      this.lineHeight = 1.75
      this.fontFamily = 'Lora'
      this.theme = 'day'
      this.maxWidth = 720
      this.showFootnotes = true
    },
  },

  // Persist reader preferences only on client to avoid SSR hydration mismatches
  persist: import.meta.client ? {
    key: 'reader',
    paths: ['fontSize', 'lineHeight', 'fontFamily', 'theme', 'maxWidth', 'showFootnotes'],
  } : undefined,
})
