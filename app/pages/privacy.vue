<script setup lang="ts">
const { data: publicSettingsRaw, pending } = await useFetch('/api/settings/public')
const privacyHtml = computed(() => {
  const pages = (publicSettingsRaw.value as any)?.settings?.pages
  if (pages?.privacy) return pages.privacy
  
  // Default fallback content if not set
  return `
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">1. Information We Collect</h2>
        <p>Malaz Scans is built to minimize data collection. If you browse the catalog as a guest, we collect zero personal identifiers. When you register an account, we store your email, username, display name, and avatar URL in our secure Supabase database.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">2. Local Storage and IndexedDB</h2>
        <p>To facilitate offline reading, we utilize your browser's local storage and IndexedDB. We cache chapter text, bookmarks, and font preferences. This data remains on your local machine and can be cleared at any time by resetting your browser data or logging out.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">3. Cookies</h2>
        <p>We use functional session cookies provided by Supabase for authentication and session validation. We do not place third-party tracking, profiling, or advertising cookies on your system.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">4. Third-Party Services</h2>
        <p>Our images are hosted on Cloudflare R2 and requested via CDN. When loading cover illustrations, Cloudflare may collect standard server handshake metadata (e.g. IP address, user-agent) strictly for security and load distribution purposes.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">5. Data Deletion</h2>
        <p>If you wish to delete your account and all associated profile, bookmark, and forum data, you may submit a request through our correspondence desk or clear your account profile directly in your settings panel.</p>
      </section>
  `
})

useHead({
  title: 'Privacy Policy',
  meta: [
    { name: 'description', content: 'Understand how Malaz Scans manages local storage, session cookies, and user profiles.' }
  ]
})
</script>

<template>
  <div class="container-curated py-8 sm:py-12 max-w-4xl">
    <div class="border-b-4 border-ink pb-4 mb-8">
      <span class="font-mono text-xs uppercase tracking-widest text-accent font-bold">Privacy Gazette</span>
      <h1 class="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight mt-1">
        Privacy Policy
      </h1>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        Transparency regarding local storage and user metadata
      </p>
    </div>

    <main class="border border-ink p-6 sm:p-8 bg-paper space-y-6 font-body text-base text-ink-light">
      <div v-if="pending" class="space-y-4">
        <UiSkeleton class="h-6 w-full" />
        <UiSkeleton class="h-6 w-5/6" />
        <UiSkeleton class="h-6 w-4/6" />
      </div>
      <div v-else v-html="privacyHtml" class="malaz-rich-text text-ink leading-relaxed font-body"></div>
    </main>
  </div>
</template>
