<template>
  <div
    :class="[
      'inline-flex items-center justify-center rounded-none border border-rule bg-surface-sunken overflow-hidden shrink-0',
      sizeClasses,
    ]"
    role="img"
    :aria-label="alt || `Avatar for ${name}`"
  >
    <img
      v-if="src && !imgError"
      :src="src"
      :alt="alt || name"
      class="w-full h-full object-cover"
      :loading="loading"
      decoding="async"
      @error="onImgError"
    />

    <!-- Initials fallback -->
    <span
      v-else
      :class="[
        'font-ui font-semibold uppercase select-none',
        textSizeClasses,
        fallbackColorClasses,
      ]"
      aria-hidden="true"
    >
      {{ initials }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type AvatarSize = 'sm' | 'md' | 'lg'

interface Props {
  src?: string
  name?: string
  alt?: string
  size?: AvatarSize
  loading?: 'lazy' | 'eager'
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  size: 'md',
  loading: 'eager',
})

const imgError = ref(false)

function onImgError() {
  imgError.value = true
}

watch(() => props.src, () => {
  imgError.value = false
})

const initials = computed(() => {
  if (!props.name) return '?'
  const parts = props.name.trim().split(/\s+/)
  const first = parts[0]
  if (!first) return '?'
  const second = parts[1]
  if (parts.length >= 2 && second && second[0]) {
    return `${first[0] || ''}${second[0]}`
  }
  return first.slice(0, 2)
})

const sizeClasses = computed(() => {
  const map: Record<AvatarSize, string> = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  }
  return map[props.size]
})

const textSizeClasses = computed(() => {
  const map: Record<AvatarSize, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }
  return map[props.size]
})

const fallbackColorClasses = 'bg-surface-sunken text-ink-muted'
</script>
