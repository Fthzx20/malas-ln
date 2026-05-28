// app/composables/useSwipeNav.ts
export function useSwipeNav(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 60
) {
  let startX = 0

  const onTouchStart = (e: TouchEvent) => { startX = e.touches[0]!.clientX }
  const onTouchEnd = (e: TouchEvent) => {
    const delta = e.changedTouches[0]!.clientX - startX
    if (Math.abs(delta) < threshold) return
    if (delta < 0) onSwipeLeft()
    else onSwipeRight()
  }

  onMounted(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
  })
  onUnmounted(() => {
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchend', onTouchEnd)
  })
}
