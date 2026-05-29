<script setup lang="ts">
const { data: publicSettingsRaw, pending } = await useFetch('/api/settings/public')
const aboutHtml = computed(() => {
  const pages = (publicSettingsRaw.value as any)?.settings?.pages
  if (pages?.about) return pages.about
  
  // Default fallback content if not set
  return `
    <article class="space-y-6 text-ink leading-relaxed">
      <p class="font-body text-lg sm:text-xl text-ink-light italic drop-cap">
        Malaz Scans was founded on a simple premise: that translation is a literary craft, and the digital medium should honor it with curated authority. We reject the cluttered, low-contrast, and pop-up ridden design of generic serial sites in favor of stark geometry, premium typography, and a newsprint aesthetic.
      </p>
      <p class="font-body text-base">
        Every aspect of the platform—from our customizable serif reader engine to our interactive popover footnote system—has been engineered to place the text at the forefront. We believe that a translation does not merely copy words; it translates souls, bridging cultures with commitment.
      </p>
      <div class="border-y-2 border-ink py-6 my-8 quote-block">
        <blockquote class="font-heading text-xl sm:text-2xl font-bold text-center text-accent italic">
          "We treat light novels not as disposable web content, but as modern literature deserving of high typographic standards."
        </blockquote>
        <cite class="block text-center font-mono text-xs uppercase tracking-wider text-ink-muted mt-3">
          — The Admin, Malaz Scans
        </cite>
      </div>
      <h3 class="font-heading text-2xl font-black uppercase tracking-tight pt-4 border-b border-rule pb-1.5">
        Our Three Pillars
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div class="space-y-2">
          <h4 class="font-heading text-lg font-bold text-accent">1. Typographic Comfort</h4>
          <p class="text-sm font-body">Adjust font sizing, line height, and color palettes. Our serif-first layout reduces reading fatigue during long sessions.</p>
        </div>
        <div class="space-y-2">
          <h4 class="font-heading text-lg font-bold text-accent">2. Local-First Caching</h4>
          <p class="text-sm font-body">We prefetch subsequent chapters in the background. Load novels instantly, and read offline without a connection.</p>
        </div>
        <div class="space-y-2">
          <h4 class="font-heading text-lg font-bold text-accent">3. Translator Sovereignty</h4>
          <p class="text-sm font-body">Translators manage their releases with markdown publishing desks, S3 media pipelines, and schedules.</p>
        </div>
      </div>
    </article>
  `
})

useHead({
  title: 'About the Gazette',
  meta: [
    { name: 'description', content: 'Learn about the philosophy, design standards, and translation commitment behind the Malaz Scans platform.' }
  ]
})
</script>

<template>
  <div class="container-curated py-8 sm:py-12">
    <div class="border-b-4 border-ink pb-4 mb-8 text-center sm:text-left">
      <span class="font-mono text-xs uppercase tracking-widest text-accent font-bold">Volume I &middot; curated Statement</span>
      <h1 class="font-heading text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight mt-1">
        About MALAZ SCANS
      </h1>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        Dedicated to the Preservation and Dissemination of Exceptional Translations
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <main class="lg:col-span-8 space-y-6">
        <div v-if="pending" class="space-y-4">
          <UiSkeleton class="h-6 w-full" />
          <UiSkeleton class="h-6 w-5/6" />
          <UiSkeleton class="h-6 w-4/6" />
        </div>
        <div v-else v-html="aboutHtml" class="malaz-rich-text text-ink leading-relaxed font-body"></div>
      </main>

      <aside class="lg:col-span-4 border border-ink p-5 bg-surface-raised space-y-6">
        <h3 class="font-heading text-lg font-black uppercase border-b border-ink pb-2 text-ink">
          Gazette Details
        </h3>
        <div class="space-y-4 font-mono text-xs">
          <div class="flex justify-between border-b border-rule pb-2"><span class="text-ink-muted uppercase">Framework</span><span class="font-bold text-ink">Nuxt 4 (Hybrid SSR)</span></div>
          <div class="flex justify-between border-b border-rule pb-2"><span class="text-ink-muted uppercase">Style Engine</span><span class="font-bold text-ink">Tailwind CSS v4</span></div>
          <div class="flex justify-between border-b border-rule pb-2"><span class="text-ink-muted uppercase">Database Layer</span><span class="font-bold text-ink">Supabase + Drizzle</span></div>
          <div class="flex justify-between border-b border-rule pb-2"><span class="text-ink-muted uppercase">Asset Pipeline</span><span class="font-bold text-ink">Cloudflare R2 (S3 API)</span></div>
          <div class="flex justify-between pb-2"><span class="text-ink-muted uppercase">License Model</span><span class="font-bold text-ink">Free & Open Source</span></div>
        </div>
        <div class="p-4 bg-paper border border-rule">
          <h4 class="font-heading text-base font-bold mb-2">Want to Contribute?</h4>
          <p class="text-xs font-body text-ink-light leading-relaxed mb-3">Whether you are a translator looking to host your chapters, or a developer wanting to contribute to the engine, our doors are open.</p>
          <NuxtLink to="/contact" class="font-mono text-[10px] uppercase font-bold text-accent hover:underline flex items-center gap-0.5">Contact the Editors &rarr;</NuxtLink>
        </div>
      </aside>
    </div>
  </div>
</template>
