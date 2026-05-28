<template>
  <div>
    <!-- Mobile tab selector -->
    <div class="sm:hidden mb-3">
      <label class="sr-only" :for="componentId ? `tabs-select-${componentId}` : undefined">{{ ariaLabel }}</label>
      <select
        :id="componentId ? `tabs-select-${componentId}` : undefined"
        :aria-label="ariaLabel"
        class="w-full min-h-11 px-3 py-2 border border-rule bg-paper text-ink font-ui text-sm font-medium"
        :value="modelValue"
        @change="selectTab(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="tab in tabs" :key="tab.value" :value="tab.value">
          {{ tab.label }}
        </option>
      </select>
    </div>

    <!-- Tab list -->
    <div
      role="tablist"
      :aria-label="ariaLabel"
      class="hidden sm:flex gap-2 sm:gap-3 border-b border-rule overflow-x-auto pb-1"
    >
      <button
        v-for="(tab, index) in tabs"
        :key="tab.value"
        :id="componentId ? `tab-${componentId}-${tab.value}` : undefined"
        role="tab"
        type="button"
        :aria-selected="modelValue === tab.value"
        :aria-controls="componentId ? `panel-${componentId}-${tab.value}` : undefined"
        :tabindex="modelValue === tab.value ? 0 : -1"
        class="touch-target relative mx-0.5 inline-flex items-center justify-center min-w-max px-4 py-2.5 sm:px-5 sm:py-3 min-h-11 font-ui text-[11px] sm:text-sm font-medium tracking-wide sm:tracking-wider leading-none whitespace-nowrap transition-colors duration-[--duration-fast] ease-[--ease-smooth] shrink-0"
        :class="
          modelValue === tab.value
            ? 'text-ink border-b-4 border-b-accent -mb-px'
            : 'text-ink-muted hover:text-ink border-b-4 border-b-transparent -mb-px'
        "
        @click="selectTab(tab.value)"
        @keydown.arrow-right.prevent="focusTab(index + 1)"
        @keydown.arrow-left.prevent="focusTab(index - 1)"
        @keydown.home.prevent="focusTab(0)"
        @keydown.end.prevent="focusTab(tabs.length - 1)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab panel -->
    <div
      v-for="tab in tabs"
      :key="`panel-${tab.value}`"
      :id="componentId ? `panel-${componentId}-${tab.value}` : undefined"
      role="tabpanel"
      :aria-labelledby="componentId ? `tab-${componentId}-${tab.value}` : undefined"
      :hidden="modelValue !== tab.value"
      :tabindex="0"
      class="py-3 sm:py-4"
    >
      <slot :name="tab.value" :activeTab="modelValue" v-if="modelValue === tab.value" />
      <slot :activeTab="modelValue" v-if="modelValue === tab.value && !$slots[tab.value]" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TabItem {
  label: string
  value: string
}

interface Props {
  tabs: TabItem[]
  modelValue: string
  ariaLabel?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  ariaLabel: 'Tabs',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const componentId = computed(() => props.id || undefined)

function selectTab(value: string) {
  emit('update:modelValue', value)
}

function focusTab(index: number) {
  if (!props.tabs.length) return
  const wrappedIndex = ((index % props.tabs.length) + props.tabs.length) % props.tabs.length
  const tab = props.tabs[wrappedIndex]
  if (tab) {
    selectTab(tab.value)
    if (componentId.value) {
      const el = document.getElementById(`tab-${componentId.value}-${tab.value}`)
      el?.focus()
    }
  }
}
</script>
