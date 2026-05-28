import { ref, onMounted } from 'vue'

function initIsMobile() {
  const isMobile = ref(false)

  if (typeof window === 'undefined') {
    return { isMobile }
  }

  const mq = window.matchMedia('(max-width: 639px)')
  isMobile.value = mq.matches
  const update = (e: MediaQueryListEvent) => {
    isMobile.value = e.matches
  }
  mq.addEventListener('change', update)

  onMounted(() => {
    isMobile.value = mq.matches
  })

  return { isMobile }
}

export function useIsMobile() {
  const state = initIsMobile()
  onMounted(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 639px)')
    state.isMobile.value = mq.matches
  })
  return state
}
