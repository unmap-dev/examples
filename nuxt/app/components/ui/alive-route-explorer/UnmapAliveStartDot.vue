<script setup lang="ts">
/** The start of a walk: a ring dot in your --primary with a card-coloured ring. Part of the alive-route-explorer block. */
import type { HTMLAttributes } from "vue";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <span aria-hidden="true" :class="['block size-4 rounded-full bg-primary shadow-sm ring-4 ring-card', props.class]" />
</template>
