<template>
  <div ref="containerRef" :class="['relative inline-block']">
    <!-- Trigger -->
    <div
      ref="triggerRef"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
      @keydown.arrow-down.prevent="open"
    >
      <slot name="trigger" :is-open="isOpen">
        <button
          type="button"
          class="touch-target inline-flex items-center gap-2 px-4 py-2 font-ui text-sm text-ink bg-surface border border-ink-faint rounded-none hover:border-ink transition-colors min-h-[44px]"
          :aria-expanded="isOpen"
          aria-haspopup="true"
        >
          {{ label }}
          <svg
            class="w-4 h-4 transition-transform duration-[--duration-fast]"
            :class="{ 'rotate-180': isOpen }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="square"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </slot>
    </div>

    <!-- Dropdown panel -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        ref="menuRef"
        role="menu"
        :aria-label="label"
        tabindex="-1"
        :class="[
          'absolute z-40 mt-1 min-w-[180px] w-max bg-surface border border-rule rounded-none shadow-lg py-1 overflow-auto max-h-64',
          alignClasses,
        ]"
        @keydown.escape.prevent="close"
        @keydown.arrow-down.prevent="focusNext"
        @keydown.arrow-up.prevent="focusPrev"
        @keydown.tab="close"
        @keydown.enter.prevent="selectFocused"
      >
        <slot name="items" :close="close" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type DropdownAlign = 'left' | 'right'

interface Props {
  label?: string
  align?: DropdownAlign
  mobileOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Menu',
  align: 'left',
  mobileOnly: false,
})

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(-1)

const alignClasses = computed(() => {
  return props.align === 'right' ? 'right-0' : 'left-0'
})

function getMenuItems(): HTMLElement[] {
  if (!menuRef.value) return []
  return Array.from(menuRef.value.querySelectorAll('[role="menuitem"]:not([disabled])'))
}

function toggle() {
  isOpen.value ? close() : open()
}

async function open() {
  isOpen.value = true
  focusedIndex.value = -1
  await nextTick()
  menuRef.value?.focus()
}

function close() {
  isOpen.value = false
  focusedIndex.value = -1
  // Return focus to trigger
  const trigger = triggerRef.value?.querySelector('button') ?? triggerRef.value
  ;(trigger as HTMLElement)?.focus()
}

function focusNext() {
  const items = getMenuItems()
  if (!items.length) return
  focusedIndex.value = (focusedIndex.value + 1) % items.length
  items[focusedIndex.value]?.focus()
}

function focusPrev() {
  const items = getMenuItems()
  if (!items.length) return
  focusedIndex.value = focusedIndex.value <= 0 ? items.length - 1 : focusedIndex.value - 1
  items[focusedIndex.value]?.focus()
}

function selectFocused() {
  const items = getMenuItems()
  const focusedItem = items[focusedIndex.value]
  if (focusedItem) {
    focusedItem.click()
  }
}

function onClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside, true)
})

defineExpose({ open, close, toggle })
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
