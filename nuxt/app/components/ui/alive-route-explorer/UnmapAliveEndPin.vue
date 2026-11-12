<script setup lang="ts">
/** The end of a walk: a map pin in your --destructive, outlined in --card. Part of the alive-route-explorer block. */
import type { HTMLAttributes } from "vue";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <svg aria-hidden="true" viewBox="0 0 36 46" :class="['block h-[1.4em] w-auto', props.class]">
    <path d="M18 44C18 44 34 28 34 17A16 16 0 0 0 2 17C2 28 18 44 18 44Z" stroke-width="2.5" class="fill-destructive stroke-card" />
    <circle cx="18" cy="17" r="6" class="fill-card" />
  </svg>
</template>
