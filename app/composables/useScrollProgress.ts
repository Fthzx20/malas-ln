// app/composables/useScrollProgress.ts
export function useScrollProgress() {
  const scrollPct = ref(0)
  const showFloatingNav = ref(false)
  let ticking = false

  const onScroll = () => {
    if (ticking) return
    ticking = true

    requestAnimationFrame(() => {
      const el = document.documentElement
      const scrollRange = Math.max(1, el.scrollHeight - el.clientHeight)
      const pct = el.scrollTop / scrollRange
      scrollPct.value = Math.round(pct * 100)
      showFloatingNav.value = pct > 0.10
      ticking = false
    })
  }

  onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
  onUnmounted(() => window.removeEventListener('scroll', onScroll))

  return { scrollPct, showFloatingNav }
}
