<template>
  <div class="flex flex-col gap-1.5">
    <!-- Label -->
    <label
      v-if="label"
      :for="inputId"
      class="font-ui text-sm font-medium text-ink tracking-wide"
    >
      {{ label }}
      <span v-if="required" class="text-accent ml-0.5" aria-hidden="true">*</span>
    </label>

    <!-- Input wrapper -->
    <div class="relative">
      <!-- Prefix slot (e.g., search icon) -->
      <div
        v-if="$slots.prefix"
        class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </div>

      <input
        :id="inputId || undefined"
        ref="inputRef"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :aria-invalid="!!error"
        :aria-describedby="describedBy"
        :autocomplete="autocomplete"
        class="w-full min-h-[44px] px-3 py-2.5 font-body text-sm text-ink bg-surface border border-ink-faint rounded-none transition-colors duration-[--duration-fast] ease-[--ease-smooth] placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{
          'border-danger focus:border-danger focus:ring-danger': error,
          'pr-10': $slots.trailing,
          'pl-10': $slots.prefix,
        }"
        @input="onInput"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
      />

      <!-- Trailing slot (e.g., icon) -->
      <div
        v-if="$slots.trailing"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      >
        <slot name="trailing" />
      </div>
    </div>

    <!-- Error message -->
    <p
      v-if="error && inputId"
      :id="`${inputId}-error`"
      class="font-ui text-xs text-danger mt-0.5"
      role="alert"
    >
      {{ error }}
    </p>

    <!-- Helper text -->
    <p
      v-else-if="helperText && inputId"
      :id="`${inputId}-helper`"
      class="font-ui text-xs text-ink-muted mt-0.5"
    >
      {{ helperText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type InputType = 'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | 'number' | 'datetime-local'

interface Props {
  id?: string
  modelValue?: string
  type?: InputType
  label?: string
  placeholder?: string
  error?: string
  helperText?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  autocomplete?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  readonly: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const inputId = computed(() => props.id || undefined)

const describedBy = computed(() => {
  if (!inputId.value) return undefined
  if (props.error) return `${inputId.value}-error`
  if (props.helperText) return `${inputId.value}-helper`
  return undefined
})

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  inputRef,
})
</script>
