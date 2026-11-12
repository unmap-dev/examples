<script setup lang="ts">
/**
 * The alive-route-explorer block's panel: the title, start and destination, the routes (the
 * `routes` slot), the route options (five dials, the extra time, more options), and the `footer`
 * slot with the button and the call counter. Drawn from the state <UnmapAliveRouteExplorer> holds;
 * installed beside it. Edit freely.
 */
import { computed, shallowRef, useId } from "vue";
import { ArrowUpDown, ChevronDown, Coffee, Landmark, Navigation, Trees, VolumeX, Waves } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { UnmapGeocoder } from "@/components/ui/geocoder";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_WEIGHTS, type Weights } from "@/lib/alive-route-explorer/alive-rank";
import type { LngLat } from "@/lib/alive-route-explorer/alive-signals";
import { ALIVE_COPY, ALIVE_MAP_ID, MAX_BUDGET, SAMPLE_COMMUTES, WEIGHT_KEYS, type AliveLang, type Endpoint, type Method, type WeightKey } from "@/lib/alive-route-explorer/alive-view";
import UnmapAliveDial from "./UnmapAliveDial.vue";
import UnmapAliveEndPin from "./UnmapAliveEndPin.vue";
import UnmapAliveStartDot from "./UnmapAliveStartDot.vue";

const props = defineProps<{
  lang: AliveLang;
  apiKey: string;
  title?: string;
  badge?: string;
  commute: string;
  isSample: boolean;
  from: Endpoint;
  to: Endpoint;
  /** Changes when the ends move by any other way than typing: the search boxes start over. */
  boxes: number;
  sampleId: string | null;
  weights: Weights;
  budget: number;
  minGain: number;
  method: Method;
  /** Street life and landmarks could not be read: their dials are off. */
  placesUnavailable: boolean;
  /** The basemap tiles were not read: the parks, water and traffic dials are off. */
  basemapUnavailable: boolean;
  /** In the phone sheet, which scrolls as a whole: the button sticks to its bottom instead. */
  inSheet?: boolean;
}>();
const emit = defineEmits<{
  sample: [id: string];
  swap: [];
  from: [at: LngLat, name: string];
  to: [at: LngLat, name: string];
  weights: [next: Weights];
  budget: [next: number];
  minGain: [next: number];
  method: [next: Method];
}>();

const WEIGHT_ICONS = { green: Trees, water: Waves, quiet: VolumeX, life: Coffee, landmarks: Landmark } as const;
/** The signals that come from /places/along, off when it is unavailable. */
const PLACE_SIGNALS: readonly WeightKey[] = ["life", "landmarks"];
/** The signals that come from the basemap tiles, off when they were not read. */
const BASEMAP_SIGNALS: readonly WeightKey[] = ["green", "water", "quiet"];
const METHODS = ["both", "detour", "graph"] as const;

const copy = computed(() => ALIVE_COPY[props.lang]);
const uid = useId();
const options = shallowRef(true);
const more = shallowRef(false);
const ends = computed(() => [
  { key: "from" as const, placeholder: props.from.name ? copy.value.from(props.from.name) : copy.value.start },
  { key: "to" as const, placeholder: props.to.name ? copy.value.to(props.to.name) : copy.value.destination },
]);

function dialValue(key: WeightKey) {
  return props.weights[key].toLocaleString(props.lang === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function dialOff(key: WeightKey) {
  return (props.placesUnavailable && PLACE_SIGNALS.includes(key)) || (props.basemapUnavailable && BASEMAP_SIGNALS.includes(key));
}
function pick(end: "from" | "to", result: { lng: number; lat: number; name: string }) {
  if (end === "from") emit("from", [result.lng, result.lat], result.name);
  else emit("to", [result.lng, result.lat], result.name);
}
function chooseSample(next: unknown) {
  if (typeof next === "string") emit("sample", next);
}
function chooseMethod(next: unknown) {
  if (next === "both" || next === "detour" || next === "graph") emit("method", next);
}
</script>

<template>
  <div :class="['flex flex-col gap-6 p-7', inSheet ? '' : 'min-h-0 flex-1 overflow-y-auto overscroll-contain']">
    <header class="flex flex-col gap-2">
      <div class="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Navigation class="size-5 fill-current" />
        </span>
        <h2 class="min-w-0 truncate text-3xl leading-tight font-extrabold tracking-tight">{{ title ?? copy.title }}</h2>
        <Badge v-if="badge" variant="secondary" class="shrink-0 rounded-full px-2.5 font-bold">{{ badge }}</Badge>
      </div>
      <p class="text-base text-muted-foreground">{{ copy.subtitle }}</p>
    </header>

    <section class="flex flex-col gap-3" :aria-label="`${copy.start}, ${copy.destination}`">
      <div class="flex items-center gap-2">
        <div :key="boxes" class="flex min-w-0 flex-1 flex-col gap-2.5">
          <!-- A search box for each end of the walk, 52 px tall, with the end's mark where the combobox's search icon was. -->
          <div v-for="end in ends" :key="end.key" class="relative min-w-0 flex-1">
            <span class="pointer-events-none absolute top-[26px] left-4 z-10 flex -translate-y-1/2 items-center">
              <UnmapAliveStartDot v-if="end.key === 'from'" class="size-3.5" />
              <UnmapAliveEndPin v-else class="h-5" />
            </span>
            <UnmapGeocoder
              :api-key="apiKey"
              :map-id="ALIVE_MAP_ID"
              :lang="lang"
              proximity="map"
              :placeholder="end.placeholder"
              class="[&_[data-slot=input-group]]:h-13 [&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group-addon]]:hidden [&_input]:pl-11! [&_input]:text-base [&>p]:sr-only"
              @select="pick(end.key, $event)"
            />
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-lg" :aria-label="copy.swap" @click="emit('swap')">
          <ArrowUpDown />
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted-foreground">{{ copy.samples }}</span>
        <ToggleGroup type="single" :aria-label="copy.samples" variant="outline" size="sm" :spacing="1" :model-value="sampleId ?? undefined" @update:model-value="chooseSample">
          <ToggleGroupItem v-for="s in SAMPLE_COMMUTES" :key="s.id" :value="s.id" :title="s.name[lang]" class="rounded-full px-3">
            {{ s.ends[lang][0] }}
          </ToggleGroupItem>
        </ToggleGroup>
        <Badge v-if="isSample" variant="secondary">{{ copy.sample }}</Badge>
      </div>
    </section>

    <Separator />
    <slot name="routes" />
    <Separator />

    <Collapsible v-model:open="options" class="flex flex-col gap-4">
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="text-lg font-bold">{{ copy.routeOptions }}</h3>
        <CollapsibleTrigger as-child>
          <Button type="button" variant="link" class="h-auto px-0 text-base">{{ options ? copy.hide : copy.show }}</Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent class="flex flex-col gap-5">
        <FieldSet class="gap-3">
          <div class="flex items-baseline justify-between gap-3">
            <FieldLegend class="mb-0 text-base font-semibold">{{ copy.dials }}</FieldLegend>
            <Button type="button" variant="link" size="sm" class="h-auto px-0" @click="emit('weights', DEFAULT_WEIGHTS)">{{ copy.reset }}</Button>
          </div>
          <UnmapAliveDial
            v-for="key in WEIGHT_KEYS"
            :key="key"
            :icon="WEIGHT_ICONS[key]"
            :label="copy.weights[key]"
            :value="weights[key]"
            :shown="dialValue(key)"
            :min="0"
            :max="2"
            :step="0.1"
            :disabled="dialOff(key)"
            @change="emit('weights', { ...weights, [key]: $event })"
          />
          <p v-if="basemapUnavailable" class="text-xs text-muted-foreground">{{ copy.dialsBasemapUnavailable }}</p>
          <p v-if="placesUnavailable" class="text-xs text-muted-foreground">{{ copy.dialsUnavailable }}</p>
        </FieldSet>

        <UnmapAliveDial :label="copy.budget" :value="budget" :shown="copy.budgetValue(budget)" :min="0" :max="MAX_BUDGET" :step="0.5" wide @change="emit('budget', $event)" />

        <Collapsible v-model:open="more" class="flex flex-col gap-3">
          <CollapsibleTrigger as-child>
            <Button type="button" variant="ghost" size="sm" class="-ml-2 w-fit text-muted-foreground">
              <ChevronDown :class="['transition-transform motion-reduce:transition-none', more ? 'rotate-180' : '']" />
              {{ more ? copy.fewer : copy.more }}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <UnmapAliveDial :label="copy.minGain" :value="minGain" :shown="copy.minGainValue(minGain)" :min="0" :max="20" :step="1" wide @change="emit('minGain', $event)" />
              <p class="text-xs text-muted-foreground">{{ copy.minGainHint }}</p>
            </div>
            <div class="flex flex-col gap-2">
              <span :id="`${uid}-method`" class="text-sm font-medium">{{ copy.method }}</span>
              <ToggleGroup type="single" :aria-labelledby="`${uid}-method`" variant="outline" size="sm" :model-value="method" @update:model-value="chooseMethod">
                <ToggleGroupItem v-for="m in METHODS" :key="m" :value="m">{{ copy.methodFilter[m] }}</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CollapsibleContent>
    </Collapsible>
  </div>
  <div :class="['flex flex-col gap-2 bg-card px-7 pt-4 pb-6', inSheet ? 'sticky bottom-0 z-10 border-t' : '']">
    <slot name="footer" />
    <p class="text-center text-xs text-muted-foreground">{{ copy.sources }}</p>
  </div>
</template>
