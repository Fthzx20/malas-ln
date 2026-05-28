// Development helper: automatically unregister service workers on local preview hosts
// This prevents stale SW from intercepting asset requests during local testing.
export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      void navigator.serviceWorker.getRegistrations()
        .then((regs) => {
          regs.forEach((registration) => {
            void registration.unregister()
          })
        })
        .catch(() => {})

      if (window.caches) {
        void window.caches.keys()
          .then((keys) => Promise.all(keys.map(key => window.caches.delete(key))))
          .catch(() => {})
      }
    }
  }
})
