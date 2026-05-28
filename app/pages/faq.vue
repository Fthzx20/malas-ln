<script setup lang="ts">
useHead({
  title: 'Frequently Asked Questions',
  meta: [
    { name: 'description', content: 'Find answers about account management, offline storage, reading preferences, and translation guidelines on Rano LN.' }
  ]
})
</script>

<template>
  <div class="container-editorial py-8 sm:py-12 max-w-4xl">
    <!-- Header -->
    <div class="border-b-4 border-ink pb-4 mb-8">
      <span class="font-mono text-xs uppercase tracking-widest text-accent font-bold">Reader Assistance Desk</span>
      <h1 class="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight mt-1">
        Frequently Asked Questions
      </h1>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        Inquiries and Guides for Readers and Translators alike
      </p>
    </div>

    <!-- FAQ Accordion List -->
    <main class="space-y-6">
      <div class="border border-ink p-6 bg-paper space-y-4">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-2">1. Reading & Settings</h2>
        
        <UiAccordion title="How do I change the reader font and themes?">
          <p class="text-sm font-body text-ink-light leading-relaxed">
            While reading a chapter, click the gear icon in the top header. You can customize the font family (Lora, Inter, or JetBrains Mono), line height, font sizing, and select one of our premium ambient themes: Day (paper), Night (charcoal), Sepia (parchment), or Editorial (newsprint). These settings are persisted to your browser.
          </p>
        </UiAccordion>

        <UiAccordion title="What is the 'Tautologi Tautan' checkmark?">
          <p class="text-sm font-body text-ink-light leading-relaxed">
            It is a reading tracker indicator. When you click it or view the chapter list on a novel's page, a checkbox indicates whether the chapter has been logged as read, either in your authenticated Supabase profile or your local browser history log.
          </p>
        </UiAccordion>
      </div>

      <div class="border border-ink p-6 bg-paper space-y-4">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-2">2. Offline Storage & PWA</h2>
        
        <UiAccordion title="Can I read light novels offline?">
          <p class="text-sm font-body text-ink-light leading-relaxed">
            Yes! Rano LN has a built-in offline engine. On any novel detail page, you can click the <strong>Download Offline</strong> button to prefetch and save all published chapters to your local browser storage (IndexedDB). Additionally, the reader automatically pre-fetches the subsequent 2 chapters silently in the background while you read.
          </p>
        </UiAccordion>

        <UiAccordion title="How do I know if I am in offline mode?">
          <p class="text-sm font-body text-ink-light leading-relaxed">
            When your network connection is interrupted, the site will display a yellow <strong>OFFLINE</strong> badge in the header, and the chapters cached in your IndexedDB will load seamlessly with full customizer configurations still active.
          </p>
        </UiAccordion>
      </div>

      <div class="border border-ink p-6 bg-paper space-y-4">
        <h2 class="font-heading text-xl font-bold uppercase border-b border-rule pb-2">3. Publishing & Uploading</h2>
        
        <UiAccordion title="How can I upload my translations?">
          <p class="text-sm font-body text-ink-light leading-relaxed">
            Register an account and contact the site editors via our contact page to request a <strong>Translator/Uploader</strong> role. Once approved, you will gain access to the Admin & Translator Desk, where you can manage your light novels ledger, upload covers, schedule release times, and compose manuscripts using our live split-screen Markdown editor.
          </p>
        </UiAccordion>

        <UiAccordion title="Are images supported inside chapters?">
          <p class="text-sm font-body text-ink-light leading-relaxed">
            Yes! In the manuscript editor, you can drag and drop high-resolution illustrations. They will automatically compile and stream to our Cloudflare R2 bucket via the S3 asset pipeline and render inside your chapter content.
          </p>
        </UiAccordion>
      </div>
    </main>
  </div>
</template>
