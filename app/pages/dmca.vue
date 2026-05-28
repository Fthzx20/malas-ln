<script setup lang="ts">
useHead({
  title: 'DMCA & Copyright Clearance',
  meta: [
    { name: 'description', content: 'Submit copyright claims or DMCA takedown requests to the Rano LN editors.' }
  ]
})
</script>

<template>
  <div class="container-editorial py-8 sm:py-12 max-w-4xl">
    <!-- Header -->
    <div class="border-b-4 border-ink pb-4 mb-8">
      <span class="font-mono text-xs uppercase tracking-widest text-accent font-bold">Copyright Office</span>
      <h1 class="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight mt-1">
        DMCA & Copyright Policy
      </h1>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        Procedures for submitting copyright infringement notices
      </p>
    </div>

    <!-- Content -->
    <main class="border border-ink p-6 sm:p-8 bg-paper space-y-6 font-body text-base text-ink-light">
      <p class="font-body text-lg italic text-ink-light leading-relaxed">
        Rano LN respects the intellectual property rights of authors, publishers, and creators. We expect our hosting translators to adhere to standard fair-use, fan-translation, and licensing ethics.
      </p>

      <section class="space-y-3">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">1. Takedown Requests</h2>
        <p>
          If you are an official publisher, author, or legal representative of a light novel series hosted on this platform, and you wish to request the removal of a fan-translation, you may submit a formal takedown request to our legal correspondence desk.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">2. Required Information</h2>
        <p>
          To process a copyright notice, please compile a written letter containing:
        </p>
        <ul class="list-disc pl-6 space-y-2 text-sm font-ui">
          <li>Identification of the copyrighted work claimed to have been infringed.</li>
          <li>Links to the specific URLs on the Platform where the alleged infringing material is located.</li>
          <li>Your contact details, including name, email address, physical address, and telephone number.</li>
          <li>A statement indicating that you have a good-faith belief that the use is not authorized.</li>
          <li>A statement confirming under penalty of perjury that the information in your notice is accurate and that you are the copyright owner or authorized representative.</li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-1 text-ink">3. Submission Desk</h2>
        <p>
          Please submit all formal notices via our <NuxtLink to="/contact" class="text-accent underline font-bold">Correspondence Desk</NuxtLink> under the "Legal / Copyright" subject, or send a signed email directly to <span class="font-mono font-bold">legal@ranoln.org</span>. Formally compiled notices are processed within 48 business hours.
        </p>
      </section>
    </main>
  </div>
</template>
