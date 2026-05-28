<script setup lang="ts">
interface Props {
  padded?: boolean
  variant?: string
  accentBorder?: boolean
  hoverable?: boolean
  containerClass?: string
  contentClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  padded: true,
  variant: 'default',
  accentBorder: false,
  hoverable: true,
  containerClass: '',
  contentClass: ''
})
</script>

<template>
  <article
    :class="[
      'bg-surface border border-rule rounded-none transition-shadow duration-[--duration-normal] ease-[--ease-smooth]',
      props.variant === 'default' ? 'bg-paper' : '',
      { 'border-b-4 border-b-accent': props.accentBorder },
      { 'hover:shadow-md': props.hoverable },
      props.containerClass,
    ]"
  >
    <header v-if="$slots.header" class="px-4 py-3 border-b border-rule">
      <slot name="header" />
    </header>

    <div :class="[props.padded ? 'px-4 py-4' : '', props.contentClass]">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="px-4 py-3 border-t border-rule bg-surface-raised">
      <slot name="footer" />
    </footer>
  </article>
</template>

<style scoped></style>
