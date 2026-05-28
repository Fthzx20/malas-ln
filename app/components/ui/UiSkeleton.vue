<template>
  <div
    :class="['skeleton rounded-none', variantClasses]"
    :style="dimensionStyles"
    role="status"
    aria-label="Loading..."
    aria-busy="true"
  >
    <span class="sr-only">Loading...</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SkeletonVariant = 'text' | 'circle' | 'rect'

interface Props {
  width?: string
  height?: string
  variant?: SkeletonVariant
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
})

const variantClasses = computed(() => {
  const map: Record<SkeletonVariant, string> = {
    text: 'rounded-none',
    circle: 'rounded-full!',
    rect: 'rounded-none',
  }
  return map[props.variant]
})

const dimensionStyles = computed(() => {
  const styles: Record<string, string> = {}

  if (props.variant === 'circle') {
    const size = props.width || props.height || '40px'
    styles.width = size
    styles.height = size
  } else if (props.variant === 'text') {
    styles.width = props.width || '100%'
    styles.height = props.height || '1em'
  } else {
    styles.width = props.width || '100%'
    styles.height = props.height || '100px'
  }

  return styles
})
</script>
