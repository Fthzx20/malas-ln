<template>
  <div
    class="inline-flex items-center gap-0.5"
    role="radiogroup"
    :aria-label="ariaLabel"
    @mouseleave="hoveredValue = 0"
  >
    <button
      v-for="star in 5"
      :key="star"
      type="button"
      :class="[
        'transition-colors duration-[--duration-fast] ease-[--ease-smooth]',
        readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
      ]"
      :style="{ width: `${sizeMap[size]}px`, height: `${sizeMap[size]}px` }"
      role="radio"
      :aria-checked="star === Math.ceil(displayValue)"
      :aria-label="`${star} star${star > 1 ? 's' : ''}`"
      :tabindex="readonly ? -1 : 0"
      :disabled="readonly"
      @click="!readonly && selectStar(star)"
      @mouseenter="!readonly && (hoveredValue = star)"
      @keydown.arrow-right.prevent="!readonly && selectStar(Math.min(5, Math.ceil(displayValue) + 1))"
      @keydown.arrow-left.prevent="!readonly && selectStar(Math.max(1, Math.ceil(displayValue) - 1))"
    >
      <svg
        :width="sizeMap[size]"
        :height="sizeMap[size]"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <clipPath v-if="componentId" :id="`half-${componentId}-${star}`">
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>

        <!-- Empty star (background) -->
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          :fill="emptyColor"
          stroke="none"
        />

        <!-- Filled star -->
        <path
          v-if="getStarState(star) === 'full'"
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          :fill="fillColor"
          stroke="none"
        />

        <!-- Half star -->
        <path
          v-else-if="getStarState(star) === 'half'"
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          :fill="fillColor"
          :clip-path="componentId ? `url(#half-${componentId}-${star})` : undefined"
          stroke="none"
        />
      </svg>
    </button>

    <!-- Text display -->
    <span
      v-if="showValue"
      class="ml-1.5 font-mono text-xs text-ink-muted"
    >
      {{ displayValue.toFixed(1) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type StarSize = 'sm' | 'md' | 'lg'

interface Props {
  modelValue?: number
  readonly?: boolean
  size?: StarSize
  showValue?: boolean
  ariaLabel?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  readonly: false,
  size: 'md',
  showValue: false,
  ariaLabel: 'Star rating',
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const componentId = computed(() => props.id || undefined)
const hoveredValue = ref(0)

const sizeMap: Record<StarSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
}

const fillColor = '#CC0000'
const emptyColor = '#DDDDDD'

const displayValue = computed(() => {
  return hoveredValue.value > 0 ? hoveredValue.value : props.modelValue
})

function getStarState(star: number): 'full' | 'half' | 'empty' {
  const val = displayValue.value
  if (star <= Math.floor(val)) return 'full'
  if (star === Math.ceil(val) && val % 1 >= 0.25 && val % 1 < 0.75) return 'half'
  if (star === Math.ceil(val) && val % 1 >= 0.75) return 'full'
  return 'empty'
}

function selectStar(star: number) {
  emit('update:modelValue', star)
}
</script>
