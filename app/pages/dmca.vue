<script setup lang="ts">
const { data: publicSettingsRaw, pending } = await useFetch('/api/settings/public')
const dmcaHtml = computed(() => {
  const pages = (publicSettingsRaw.value as any)?.settings?.pages
  if (pages?.dmca) return pages.dmca
  
  // Default fallback content if not set
  return `
      <p class="font-body text-lg italic text-ink-light leading-relaxed mb-6">
        Malaz Scans respects the intellectual property rights of authors, publishers, and creators. We expect our hosting translators to adhere to standard fair-use, fan-translation, and licensing ethics.
      </p>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">1. Takedown Requests</h2>
        <p>If you are an official publisher, author, or legal representative of a light novel series hosted on this platform, and you wish to request the removal of a fan-translation, you may submit a formal takedown request to our legal correspondence desk.</p>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">2. Required Information</h2>
        <p>To process a copyright notice, please compile a written letter containing:</p>
        <ul class="list-disc pl-6 space-y-2 text-sm font-ui">
          <li>Identification of the copyrighted work claimed to have been infringed.</li>
          <li>Links to the specific URLs on the Platform where the alleged infringing material is located.</li>
          <li>Your contact details, including name, email address, physical address, and telephone number.</li>
          <li>A statement indicating that you have a good-faith belief that the use is not authorized.</li>
          <li>A statement confirming under penalty of perjury that the information in your notice is accurate and that you are the copyright owner or authorized representative.</li>
        </ul>
      </section>
      <section class="space-y-3 mb-6">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">3. Submission Desk</h2>
        <p>Please submit all formal notices via our Correspondence Desk under the "Legal / Copyright" subject, or send a signed email directly to <span class="font-mono font-bold">malazscans@gmail.com</span>.</p>
      </section>
  `
})

useHead({
  title: 'DMCA & Copyright Clearance',
  meta: [
    { name: 'description', content: 'Submit copyright claims or DMCA takedown requests to the Malaz Scans editors.' }
  ]
})
</script>

<template>
  <div class="container-curated py-8 sm:py-12 max-w-4xl">
    <div class="border-b-4 border-ink pb-4 mb-8">
      <span class="font-mono text-xs uppercase tracking-widest text-accent font-bold">Copyright Office</span>
      <h1 class="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight mt-1">
        DMCA & Copyright Policy
      </h1>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        Procedures for submitting copyright infringement notices
      </p>
    </div>

    <main class="border border-ink p-6 sm:p-8 bg-paper space-y-6 font-body text-base text-ink-light">
      <div v-if="pending" class="space-y-4">
        <UiSkeleton class="h-6 w-full" />
        <UiSkeleton class="h-6 w-5/6" />
        <UiSkeleton class="h-6 w-4/6" />
      </div>
      <div v-else v-html="dmcaHtml" class="malaz-rich-text text-ink leading-relaxed font-body"></div>
    </main>
  </div>
</template>
