<script setup lang="ts">
const { data: publicSettingsRaw, pending } = await useFetch('/api/settings/public')
const termsHtml = computed(() => {
  const pages = (publicSettingsRaw.value as any)?.settings?.pages
  if (pages?.terms) return pages.terms
  
  // Default fallback content if not set
  return `
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">1. Acceptance of Terms</h2>
        <p>By accessing and reading serials on Malaz Scans ("the Platform"), you agree to be bound by this Charter. If you do not accept these conditions, you must cease using the Platform immediately. We reserve the right to revise this Charter at any time, with updates reflected by the date above.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">2. Permitted Use</h2>
        <p>All reading content on the Platform is intended strictly for personal, non-commercial use. Users are prohibited from utilizing automated scraping, mirroring tools, or data mining engines to copy chapters or media assets without explicit permission from the hosting translation group.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">3. Translation Hosting & IP</h2>
        <p>Malaz Scans does not own the light novel chapters hosted on the site. All translations remain the intellectual property of their respective translation groups. We act as a platform coordinator, providing storage, offline databases, and typesetting layouts for the preservation of these serials.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">4. Code of Conduct</h2>
        <p>Discussion threads, reviews, and comments must remain civil. Spam, harassment, un-flagged spoilers, or hate speech will result in immediate content removal and potential role revocation or IP bans at the discretion of the moderation team.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">5. Disclaimer</h2>
        <p>The Platform is provided "as is" and "as available". We do not guarantee uninterrupted access, especially given our reliance on free-tier database resources. We are not responsible for any data loss, including reading progress sync failures.</p>
      </section>
  `
})

useHead({
  title: 'Terms of Service',
  meta: [
    { name: 'description', content: 'Review the terms of service governing user behavior, translations hosting, and reading conditions on Malaz Scans.' }
  ]
})
</script>

<template>
  <div class="container-curated py-8 sm:py-12 max-w-4xl">
    <div class="border-b-4 border-ink pb-4 mb-8">
      <span class="font-mono text-xs uppercase tracking-widest text-accent font-bold">Gazette Charter</span>
      <h1 class="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight mt-1">
        Terms of Service
      </h1>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        Last Updated &middot; May 24, 2026
      </p>
    </div>

    <main class="border border-ink p-6 sm:p-8 bg-paper space-y-6 font-body text-base text-ink-light">
      <div v-if="pending" class="space-y-4">
        <UiSkeleton class="h-6 w-full" />
        <UiSkeleton class="h-6 w-5/6" />
        <UiSkeleton class="h-6 w-4/6" />
      </div>
      <div v-else v-html="termsHtml" class="malaz-rich-text text-ink leading-relaxed font-body"></div>
    </main>
  </div>
</template>
