<template>
  <div class="flex flex-col gap-1.5">
    <!-- Label -->
    <label
      v-if="label"
      :for="selectId || undefined"
      class="font-ui text-sm font-medium text-ink tracking-wide"
    >
      {{ label }}
      <span v-if="required" class="text-accent ml-0.5" aria-hidden="true">*</span>
    </label>

    <!-- Select wrapper -->
    <div class="relative">
      <select
        :id="selectId || undefined"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        :aria-invalid="!!error"
        :aria-describedby="selectId && error ? `${selectId}-error` : undefined"
        class="w-full min-h-[44px] px-3 py-2.5 pr-10 font-ui text-sm text-ink bg-surface border border-ink-faint rounded-none appearance-none cursor-pointer transition-colors duration-[--duration-fast] ease-[--ease-smooth] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{
          'border-danger focus:border-danger focus:ring-danger': error,
          'text-ink-faint': !modelValue && placeholder,
        }"
        @change="onChange"
      >
        <option v-if="placeholder" value="" disabled :selected="!modelValue">
          {{ placeholder }}
        </option>
        <option
          v-for="option in normalizedOptions"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>

      <!-- Chevron icon -->
      <div
        class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted"
        aria-hidden="true"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>

    <!-- Error message -->
    <p
      v-if="error && selectId"
      :id="`${selectId}-error`"
      class="font-ui text-xs text-danger"
      role="alert"
    >
      {{ error }}
    </p>

    <!-- Helper text -->
    <p
      v-else-if="helperText"
      class="font-ui text-xs text-ink-muted"
    >
      {{ helperText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

interface Props {
  id?: string
  modelValue?: string | number
  options: (SelectOption | string)[]
  label?: string
  placeholder?: string
  error?: string
  helperText?: string
  disabled?: boolean
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const selectId = computed(() => props.id || undefined)

const normalizedOptions = computed<SelectOption[]>(() => {
  return props.options.map((opt) => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt }
    }
    return opt
  })
})

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>
