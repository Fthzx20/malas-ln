<template>
  <div class="flex flex-col gap-1.5">
    <!-- Label -->
    <label
      v-if="label"
      :for="textareaId"
      class="font-ui text-sm font-medium text-ink tracking-wide"
    >
      {{ label }}
      <span v-if="required" class="text-accent ml-0.5" aria-hidden="true">*</span>
    </label>

    <!-- Textarea -->
    <textarea
      :id="textareaId"
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :rows="rows"
      :maxlength="maxLength"
      :aria-invalid="!!error"
      :aria-describedby="describedBy"
      class="w-full min-h-[88px] px-3 py-2.5 font-body text-sm text-ink bg-surface border border-ink-faint rounded-none transition-colors duration-[--duration-fast] ease-[--ease-smooth] placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed resize-y"
      :class="{
        'border-danger focus:border-danger focus:ring-danger': error,
        'resize-none overflow-hidden': autoResize,
      }"
      @input="onInput"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
    />

    <!-- Footer: helper/error + character count -->
    <div class="flex items-start justify-between gap-2">
      <!-- Error message -->
      <p
        v-if="error && textareaId"
        :id="`${textareaId}-error`"
        class="font-ui text-xs text-danger"
        role="alert"
      >
        {{ error }}
      </p>

      <!-- Helper text -->
      <p
        v-else-if="helperText && textareaId"
        :id="`${textareaId}-helper`"
        class="font-ui text-xs text-ink-muted"
      >
        {{ helperText }}
      </p>

      <span v-else />

      <!-- Character count -->
      <span
        v-if="maxLength"
        class="font-mono text-xs text-ink-muted whitespace-nowrap"
        :class="{ 'text-danger': charCount > maxLength }"
        :aria-label="`${charCount} of ${maxLength} characters used`"
      >
        {{ charCount }}/{{ maxLength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

interface Props {
  id?: string
  modelValue?: string
  label?: string
  placeholder?: string
  error?: string
  helperText?: string
  rows?: number
  maxLength?: number
  autoResize?: boolean
  disabled?: boolean
  readonly?: boolean
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  rows: 3,
  autoResize: false,
  disabled: false,
  readonly: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const textareaId = computed(() => props.id || undefined)

const charCount = computed(() => props.modelValue?.length ?? 0)

const describedBy = computed(() => {
  if (!textareaId.value) return undefined
  if (props.error) return `${textareaId.value}-error`
  if (props.helperText) return `${textareaId.value}-helper`
  return undefined
})

function adjustHeight() {
  if (!props.autoResize || !textareaRef.value) return
  const el = textareaRef.value
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  nextTick(adjustHeight)
}

watch(
  () => props.modelValue,
  () => nextTick(adjustHeight),
)

onMounted(() => {
  if (props.autoResize) adjustHeight()
})

defineExpose({
  focus: () => textareaRef.value?.focus(),
  textareaRef,
})
</script>
