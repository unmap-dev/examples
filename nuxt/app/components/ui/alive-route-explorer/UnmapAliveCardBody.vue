<script setup lang="ts">
/** A highlight card's picture and caption, on the map or in a marker's popover. Part of the alive-route-explorer block. */
import { computed } from "vue";
import { Coffee, Landmark, Trees } from "@lucide/vue";
import { ALIVE_COPY, type AliveLang, type HighlightCard } from "@/lib/alive-route-explorer/alive-view";
import UnmapAliveIllustration from "./UnmapAliveIllustration.vue";

const props = defineProps<{ lang: AliveLang; card: HighlightCard; picture?: string }>();

const KIND_ICON = { park: Trees, life: Coffee, landmark: Landmark } as const;
const copy = computed(() => ALIVE_COPY[props.lang]);
const detail = computed(() =>
  props.card.kind === "park" && props.card.metres ? copy.value.through(props.card.metres) : props.card.extra > 0 ? copy.value.more_(props.card.extra) : null,
);
</script>

<template>
  <UnmapAliveIllustration :kind="card.kind" :lang="lang" :src="picture" :alt="copy.pictureAlt(card.kind)" class="h-35 w-full" />
  <div class="flex items-center gap-2.5 px-3 py-2.5">
    <span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <component :is="KIND_ICON[card.kind]" class="size-4" />
    </span>
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-sm leading-tight font-bold">{{ copy.highlights[card.kind] }}</span>
      <span class="truncate text-xs leading-snug text-muted-foreground">{{ card.names.join(", ") }}{{ detail ? `, ${detail}` : "" }}</span>
    </div>
  </div>
</template>
