import { inject, provide, ref, type Ref } from 'vue'
import { clientLogger } from '~/utils/client-logger'

export interface ToastItem {
  id: string
  variant: 'success' | 'error' | 'warning' | 'info'
  message: string
  title?: string
  duration?: number
}

export interface ToastOptions {
  variant?: ToastItem['variant']
  title?: string
  duration?: number
}

let toastCounter = 0

export function useToastProvider() {
  const toasts = ref<ToastItem[]>([])

  function addToast(message: string, options: ToastOptions = {}) {
    const id = `toast-${++toastCounter}-${Date.now()}`
    const duration = options.duration ?? 5000

    const toast: ToastItem = {
      id,
      message,
      variant: options.variant ?? 'info',
      title: options.title,
      duration,
    }

    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  function removeToast(id: string) {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  function clearAll() {
    toasts.value = []
  }

  // Provide to descendants
  provide('toast-items', toasts)
  provide('toast-remove', removeToast)
  provide('toast-add', addToast)
  provide('toast-clear', clearAll)

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
      addToast(message, { ...options, variant: 'success' }),
    error: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
      addToast(message, { ...options, variant: 'error' }),
    warning: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
      addToast(message, { ...options, variant: 'warning' }),
    info: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
      addToast(message, { ...options, variant: 'info' }),
  }
}

export function useToast() {
  const addToast = inject<(message: string, options?: ToastOptions) => string>('toast-add')
  const removeToast = inject<(id: string) => void>('toast-remove')
  const clearAll = inject<() => void>('toast-clear')

  if (!addToast) {
    clientLogger.warn('[useToast] Toast provider not found. Make sure useToastProvider() is called in a parent component.')
    return {
      addToast: (_message: string, _options?: ToastOptions) => '',
      removeToast: (_id: string) => {},
      clearAll: () => {},
      success: (_message: string, _options?: Omit<ToastOptions, 'variant'>) => '',
      error: (_message: string, _options?: Omit<ToastOptions, 'variant'>) => '',
      warning: (_message: string, _options?: Omit<ToastOptions, 'variant'>) => '',
      info: (_message: string, _options?: Omit<ToastOptions, 'variant'>) => '',
    }
  }

  return {
    addToast,
    removeToast: removeToast!,
    clearAll: clearAll!,
    success: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
      addToast(message, { ...options, variant: 'success' }),
    error: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
      addToast(message, { ...options, variant: 'error' }),
    warning: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
      addToast(message, { ...options, variant: 'warning' }),
    info: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
      addToast(message, { ...options, variant: 'info' }),
  }
}
