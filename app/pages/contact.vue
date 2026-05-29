<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'
import { useToast } from '~/composables/useToast'

const toast = useToast()

const AsyncTextarea = defineAsyncComponent(() => import('~/components/ui/UiTextarea.vue'))

const form = ref({
  name: '',
  email: '',
  subject: 'general',
  message: ''
})

const isSubmitting = ref(false)

const handleSubmit = () => {
  if (!form.value.name || !form.value.email || !form.value.message) {
    toast.warning('Please fill in all required fields.')
    return
  }

  isSubmitting.value = true
  setTimeout(() => {
    toast.success('Your letter has been sent to the curated Board!')
    form.value = {
      name: '',
      email: '',
      subject: 'general',
      message: ''
    }
    isSubmitting.value = false
  }, 1000)
}

useHead({
  title: 'Correspondence Desk',
  meta: [
    { name: 'description', content: 'Send a message or manuscript hosting request to the editors at Malaz Scans.' }
  ]
})
</script>

<template>
  <div class="container-curated py-8 sm:py-12 max-w-4xl">
    <!-- Header -->
    <div class="border-b-4 border-ink pb-4 mb-8">
      <span class="font-mono text-xs uppercase tracking-widest text-accent font-bold">Correspondence Desk</span>
      <h1 class="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight mt-1">
        Letters to the Editor
      </h1>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mt-1">
        Inquiries, hosting requests, or curated suggestions
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
      <!-- Form (Col span 7) -->
      <main class="md:col-span-7">
        <form @submit.prevent="handleSubmit" class="border border-ink p-6 bg-paper space-y-4">
          <h3 class="font-heading text-xl font-bold uppercase border-b border-ink pb-2">Send a Letter</h3>
          
          <div class="space-y-1">
            <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Name / Pseudonym</label>
            <UiInput v-model="form.name" placeholder="John Doe" required class="w-full" />
          </div>

          <div class="space-y-1">
            <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Email Address</label>
            <UiInput v-model="form.email" type="email" placeholder="john@example.com" required class="w-full" />
          </div>

          <div class="space-y-1">
            <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Subject / Department</label>
            <UiSelect 
              v-model="form.subject"
              :options="[
                { label: 'General curated Inquiry', value: 'general' },
                { label: 'Translator Hosting Request', value: 'translator' },
                { label: 'Technical Report / Bug', value: 'bug' },
                { label: 'Legal / Copyright Issues', value: 'legal' }
              ]"
              class="w-full"
            />
          </div>

          <div class="space-y-1">
            <label class="block font-mono text-[10px] uppercase font-bold text-ink-muted">Your Message</label>
            <AsyncTextarea v-model="form.message" placeholder="Write your message with clarity..." required class="w-full h-32" />
          </div>

          <div class="pt-2">
            <UiButton type="submit" variant="primary" :loading="isSubmitting" class="w-full">
              Dispatch Message
            </UiButton>
          </div>
        </form>
      </main>

      <!-- Sidebar (Col span 5) -->
      <aside class="md:col-span-5 space-y-6">
        <div class="border border-ink p-5 bg-surface-raised space-y-4">
          <h4 class="font-heading text-lg font-bold uppercase border-b border-ink pb-2">Office Guidelines</h4>
          <p class="text-xs font-body text-ink-light leading-relaxed">
            Please be precise and concise. The curated board reviews incoming messages daily. For translation hosting requests, please provide links to past translations or translation samples.
          </p>
        </div>

        <div class="border border-ink p-5 bg-surface-raised space-y-3 font-mono text-xs">
          <h4 class="font-heading text-base font-bold uppercase border-b border-ink pb-2 text-ink-light">Office Details</h4>
          <div>
            <span class="block text-ink-muted uppercase text-[9px] font-bold">Email Contact</span>
            <span class="font-bold">editors@malazscans.com</span>
          </div>
          <div>
            <span class="block text-ink-muted uppercase text-[9px] font-bold">Operating Hours</span>
            <span class="font-bold">Monday - Friday (GMT+7)</span>
          </div>
          <div>
            <span class="block text-ink-muted uppercase text-[9px] font-bold">PGP Fingerprint</span>
            <span class="font-mono break-all font-bold">8937 1B6B D710 4148 825B 84D3 4D1F 4EC7</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
