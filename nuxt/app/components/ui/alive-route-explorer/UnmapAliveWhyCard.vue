<script setup lang="ts">
/**
 * "Why this route": the shown walk's aliveness against the fastest walk's, its description, and a
 * bar per signal with the fastest walk's value as a tick. A signal whose source could not be read
 * says "Unavailable", never an empty bar. Part of the alive-route-explorer block. Edit freely.
 */
import { computed, shallowRef } from "vue";
import { ChevronDown } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { describe } from "@/lib/alive-route-explorer/alive-signals";
import { ALIVE_COPY, WEIGHT_KEYS, type AliveLang, type RankedWalk, type WeightKey } from "@/lib/alive-route-explorer/alive-view";

const props = defineProps<{
  lang: AliveLang;
  shown: RankedWalk;
  fastest: RankedWalk;
  /** Street life and landmarks could not be read: say so rather than draw an empty bar. */
  placesUnavailable: boolean;
  /** The basemap tiles were not read: parks, water and traffic say so rather than draw a guess. */
  basemapUnavailable: boolean;
  defaultOpen: boolean;
}>();

const PLACE_SIGNALS: readonly WeightKey[] = ["life", "landmarks"];
const BASEMAP_SIGNALS: readonly WeightKey[] = ["green", "water", "quiet"];

const copy = computed(() => ALIVE_COPY[props.lang]);
const open = shallowRef(props.defaultOpen);
const rows = computed(() =>
  WEIGHT_KEYS.map((key) => ({
    key,
    off: (props.placesUnavailable && PLACE_SIGNALS.includes(key)) || (props.basemapUnavailable && BASEMAP_SIGNALS.includes(key)),
    value: Math.round(props.shown.scores[key] * 100),
    base: Math.round(props.fastest.scores[key] * 100),
  })),
);
</script>

<template>
  <Card class="gap-0 overflow-hidden rounded-2xl py-0 shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger as-child>
        <Button type="button" variant="ghost" class="h-auto w-full justify-between gap-3 px-4 py-3 text-left whitespace-normal">
          <span class="flex min-w-0 flex-col">
            <span class="text-base font-bold">{{ copy.why }}</span>
            <span class="text-xs font-normal text-muted-foreground tabular-nums">{{ copy.aliveness(Math.round(shown.score * 100), Math.round(fastest.score * 100)) }}</span>
          </span>
          <ChevronDown aria-hidden="true" :class="['transition-transform motion-reduce:transition-none', open ? 'rotate-180' : '']" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent class="flex flex-col gap-3 px-4 pb-4">
        <p class="text-sm text-muted-foreground first-letter:uppercase">{{ describe(shown.scores, lang, { basemap: !basemapUnavailable }) }}</p>
        <dl class="grid grid-cols-[6rem_minmax(0,1fr)_2.75rem] items-center gap-x-2.5 gap-y-2 text-sm">
          <div v-for="row in rows" :key="row.key" class="contents">
            <dt>{{ copy.signals[row.key] }}</dt>
            <dd v-if="row.off" class="col-span-2 text-muted-foreground">{{ copy.signalUnavailable }}</dd>
            <template v-else>
              <dd aria-hidden="true" class="relative h-2 rounded-full bg-muted">
                <span class="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" :style="{ width: `${row.value}%` }" />
                <span class="absolute -inset-y-1 w-0.5 rounded-full bg-muted-foreground" :style="{ left: `calc(${row.base}% - 1px)` }" />
              </dd>
              <dd class="text-right text-muted-foreground tabular-nums">{{ row.value }}%</dd>
            </template>
          </div>
        </dl>
        <p class="text-xs text-muted-foreground">{{ copy.barsKey }}</p>
        <p v-if="shown.method === 'graph'" class="text-xs text-muted-foreground">{{ copy.graphNote }}</p>
      </CollapsibleContent>
    </Collapsible>
  </Card>
</template>
