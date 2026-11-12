<script setup lang="ts">
/**
 * <UnmapAliveRouteExplorer> - walking directions that trade a minute for a nicer walk. Pick a start
 * and a destination (or one of three Calgary samples), get directions, and the block finds the
 * fastest walk, then detours past parks, the river, streets away from traffic, cafés and public
 * art, and scores them all. Five dials say what makes a walk alive to you and how much extra time
 * you will take; moving them re-ranks the walks at once and calls nothing. The pick is drawn in
 * your --primary over a --card casing, the fastest walk dashed in your --muted-foreground, with a
 * time bubble beside each, up to three cards for what the pick passes, and a "Why this route" card
 * with the five scores. A full-bleed map with a floating panel, a bottom sheet on a phone.
 *
 * Props: `apiKey`, `lang` ("en" | "fr"), `class`, `initial` ({ from, to, label? }), `title` (the
 * panel heading, default "Find a livelier walk"), `badge` (a short tag beside it, such as "BETA"),
 * and `pictures` (image URLs for the highlight cards, keyed by highlight kind or place category id,
 * each a list of variants; see `AlivePictures`). It emits `ends-change` with the start and
 * destination whenever the reader changes them, not at mount, so a page can keep them in its URL.
 * A card shows its places' most common category's picture, else its kind's, else the drawn
 * illustration; the variant is chosen from the place so a walk keeps its picture.
 *
 * Honest about its sources: the signals are parks, water and streets from the basemap tiles, and
 * cafés, shops and landmarks from unmap places. When `/places/along` is unavailable the ranking
 * uses parks, water and streets away from traffic only, and when the basemap tiles were not read it
 * leaves those three out; either way their dials are off, the Why card says "Unavailable" and the
 * panel says so. A walk found on the walking graph says it was found in your browser and snapped by
 * map matching. Every picture, drawn or passed in, is tagged "Illustration", and a passed-in one has
 * alt text saying it is AI-generated.
 *
 * Metering: every authenticated request is one call. "Get directions" spends at most 40: one
 * `/route` for the fastest walk, up to 24 basemap tiles read for scoring (not the map's own display
 * tiles), two `POST /places/along`, then `/route` pairs for detours and `/match` for walking-graph
 * paths, within the budget. The answer is kept per start and destination, so asking again costs
 * nothing, unless a source was unavailable, and the dials never call. The search boxes call
 * `/geocode/autocomplete` as you type; the map makes its own style and tile requests.
 *
 * Composes the map, map-context, map-layers and geocoder items on your shadcn-vue Card, Button,
 * Field, Slider, ToggleGroup, RadioGroup, Badge, Alert, Spinner, Separator, Sheet, Popover and
 * Collapsible. Installed by `npx shadcn-vue add` with its page at app/pages/alive-route-explorer.vue.
 * Edit freely.
 */
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch, type HTMLAttributes } from "vue";
import { Unmap } from "@unmap/sdk";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UnmapMap } from "@/components/ui/map";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_WEIGHTS, rank, type Weights } from "@/lib/alive-route-explorer/alive-rank";
import type { LngLat } from "@/lib/alive-route-explorer/alive-signals";
import {
  ALIVE_COPY,
  ALIVE_MAP_ID,
  DEFAULT_BUDGET,
  DEFAULT_MIN_GAIN,
  KEY_URL,
  NARROW_QUERY,
  PHONE_QUERY,
  SAMPLE_COMMUTES,
  cacheable,
  isAbort,
  requestError,
  usableWeights,
  walkDeps,
  walkNotes,
  type AliveLang,
  type AlivePictures,
  type Endpoint,
  type Method,
  type Search,
} from "@/lib/alive-route-explorer/alive-view";
import { findWalks, type Candidate, type WalkResult } from "@/lib/alive-route-explorer/alive-walks";
import UnmapAliveCamera from "./UnmapAliveCamera.vue";
import UnmapAliveControls from "./UnmapAliveControls.vue";
import UnmapAliveLayers from "./UnmapAliveLayers.vue";
import UnmapAliveOverlay from "./UnmapAliveOverlay.vue";
import UnmapAliveRoutesList from "./UnmapAliveRoutesList.vue";
import UnmapAliveWhyCard from "./UnmapAliveWhyCard.vue";

const props = withDefaults(
  defineProps<{
    /** Your unmap key. The page passes NUXT_PUBLIC_UNMAP_KEY. Without one the block shows how to get one and calls nothing. */
    apiKey: string;
    /** Language of the copy and the map labels. Defaults to "en". */
    lang?: AliveLang;
    /** Where the walk starts and ends. Default: the Bridgeland sample. */
    initial?: { from: LngLat; to: LngLat; label?: string };
    /** The panel's heading. Default: "Find a livelier walk" (fr "Trouver une marche plus vivante"). */
    title?: string;
    /** A short tag beside the heading, such as "BETA". None by default. */
    badge?: string;
    /**
     * Pictures for the highlight cards, by highlight kind or place category id, each a list of URLs
     * to vary between walks (see `AlivePictures`). Shown tagged "Illustration" with AI-generated alt
     * text; without one a card draws its inline illustration.
     */
    pictures?: AlivePictures;
    class?: HTMLAttributes["class"];
  }>(),
  { lang: "en", initial: undefined, title: undefined, badge: undefined, pictures: undefined },
);

const emit = defineEmits<{
  /**
   * The start and destination, each time the reader changes them (a sample, a search, the swap),
   * never at mount. A page can write them into its URL so a link opens the same walk.
   */
  "ends-change": [ends: { from: LngLat; to: LngLat }];
}>();

const same = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];
const pairKey = (a: LngLat, b: LngLat) => `${a.join(",")}|${b.join(",")}`;

/** True while a media query matches; false on the server and until the block mounts. */
function useMedia(query: string) {
  const matches = shallowRef(false);
  let list: MediaQueryList | undefined;
  const update = () => {
    matches.value = list?.matches === true;
  };
  onMounted(() => {
    list = typeof window !== "undefined" ? window.matchMedia?.(query) : undefined;
    update();
    list?.addEventListener?.("change", update);
  });
  onBeforeUnmount(() => list?.removeEventListener?.("change", update));
  return matches;
}

// The opening walk, kept: after this the reader moves the ends, not the props.
const opening = (() => {
  const initial = props.initial;
  const sample = initial ? SAMPLE_COMMUTES.find((s) => same(s.from, initial.from) && same(s.to, initial.to)) : SAMPLE_COMMUTES[0]!;
  return { sample: sample?.id ?? null, from: initial?.from ?? sample!.from, to: initial?.to ?? sample!.to, label: initial?.label ?? null };
})();

const copy = computed(() => ALIVE_COPY[props.lang]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const sampleId = shallowRef<string | null>(opening.sample);
const ends = shallowRef<{ from: LngLat; to: LngLat; names: [string | null, string | null] }>({ from: opening.from, to: opening.to, names: [null, null] });
const weights = shallowRef<Weights>(DEFAULT_WEIGHTS);
const budget = shallowRef(DEFAULT_BUDGET);
const minGain = shallowRef(DEFAULT_MIN_GAIN);
const method = shallowRef<Method>("both");
const search = shallowRef<Search>({ state: "idle" });
const selectedId = shallowRef<string | null>(null);
const hoveredId = shallowRef<string | null>(null);
/** The walk whose cards found no room at the first framing, so the camera gave it wider margins. */
const roomyFor = shallowRef<string | null>(null);
/** Remounts the search boxes when the endpoints change by any other way than typing. */
const boxes = shallowRef(0);
const cache = new globalThis.Map<string, WalkResult>();
let flight: AbortController | null = null;
const panel = useTemplateRef<HTMLElement>("panel");
const whyBox = useTemplateRef<HTMLElement>("why");
const panelEl = () => panel.value ?? null;
const whyEl = () => whyBox.value ?? null;
const phone = useMedia(PHONE_QUERY);
// The Why card opens by default on a wide screen (1280 px or more), where it has room.
const narrow = useMedia(NARROW_QUERY);

const deps = computed(() =>
  hasKey.value ? walkDeps(new Unmap({ key: props.apiKey, fetch: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init) }), props.apiKey) : null,
);
onBeforeUnmount(() => flight?.abort());

// Tell the page when the ends move, once per change and not for the opening walk.
let announced = pairKey(opening.from, opening.to);
watch(
  () => pairKey(ends.value.from, ends.value.to),
  (key) => {
    if (key === announced) return;
    announced = key;
    emit("ends-change", { from: ends.value.from, to: ends.value.to });
  },
);

const sample = computed(() => SAMPLE_COMMUTES.find((s) => s.id === sampleId.value) ?? null);
const from = computed<Endpoint>(() => ({ at: ends.value.from, name: ends.value.names[0] ?? sample.value?.ends[props.lang][0] ?? null }));
const to = computed<Endpoint>(() => ({ at: ends.value.to, name: ends.value.names[1] ?? sample.value?.ends[props.lang][1] ?? null }));
const commute = computed(() =>
  sample.value ? sample.value.name[props.lang] : (opening.label ?? copy.value.commute(from.value.name ?? copy.value.start, to.value.name ?? copy.value.destination)),
);

const result = computed(() => (search.value.state === "done" ? search.value.result : null));
const placesUnavailable = computed(() => (result.value ? !result.value.placesAvailable : false));
const basemapUnavailable = computed(() => (result.value ? !result.value.basemapAvailable : false));
const ranked = computed(() => {
  const found = result.value;
  if (!found) return null;
  const visible = found.candidates.filter((c) => method.value === "both" || c.method === "fastest" || c.method === method.value);
  // A signal whose source could not be read is unknown, not zero: it leaves the ranking.
  return rank(visible, usableWeights(weights.value, found), budget.value, minGain.value / 100);
});
const rows = computed(() => ranked.value?.rows ?? []);
const fastest = computed(() => rows.value.find((row) => row.method === "fastest") ?? null);
const pick = computed(() => rows.value.find((row) => row.id === ranked.value?.pickId) ?? null);
const shown = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? pick.value);
// Once per walk: when a card cannot fit at the first framing, frame again with wider margins.
const walkKey = computed(() => (shown.value ? `${pairKey(ends.value.from, ends.value.to)}:${shown.value.id}` : null));
const frame = computed<LngLat[]>(() => (shown.value && fastest.value ? [...shown.value.coords, ...fastest.value.coords] : [ends.value.from, ends.value.to]));
const frameKey = computed(() => (shown.value ? `walks:${pairKey(ends.value.from, ends.value.to)}:${shown.value.id}` : `ends:${pairKey(ends.value.from, ends.value.to)}`));
const center = computed<[number, number]>(() => [(opening.from[0] + opening.to[0]) / 2, (opening.from[1] + opening.to[1]) / 2]);

const titleOf = (row: Candidate) =>
  row.id === pick.value?.id && row.id !== fastest.value?.id ? copy.value.livelier : row.id === fastest.value?.id ? copy.value.fastest : copy.value.another;
const said = computed(() =>
  shown.value && fastest.value
    ? copy.value.said(titleOf(shown.value), copy.value.minutes(shown.value.durationS), shown.value.id === fastest.value.id ? null : copy.value.extra(shown.value.extraMin))
    : "",
);
const busy = computed(() => search.value.state === "loading");
const partial = computed(() => (result.value ? walkNotes(result.value, fastest.value?.distanceM ?? null, props.lang).partial : false));
const calls = computed(() => result.value?.calls ?? null);

function moveEnds(next: typeof ends.value, nextSample: string | null) {
  flight?.abort();
  ends.value = next;
  sampleId.value = nextSample;
  selectedId.value = null;
  search.value = { state: "idle" };
}
function pickSample(id: string) {
  const next = SAMPLE_COMMUTES.find((s) => s.id === id);
  if (!next) return;
  moveEnds({ from: next.from, to: next.to, names: [null, null] }, next.id);
  boxes.value += 1;
}
function swap() {
  moveEnds({ from: ends.value.to, to: ends.value.from, names: [to.value.name, from.value.name] }, null);
  boxes.value += 1;
}
function setFrom(at: LngLat, name: string) {
  moveEnds({ ...ends.value, from: at, names: [name, to.value.name] }, null);
}
function setTo(at: LngLat, name: string) {
  moveEnds({ ...ends.value, to: at, names: [from.value.name, name] }, null);
}
// A dial re-ranks the walks it has, so the reader's pick gives way to the new one.
function setWeights(next: Weights) {
  weights.value = next;
  selectedId.value = null;
}
function setBudget(next: number) {
  budget.value = next;
  selectedId.value = null;
}
function setMinGain(next: number) {
  minGain.value = next;
  selectedId.value = null;
}
function setMethod(next: Method) {
  method.value = next;
  selectedId.value = null;
}
function select(id: string) {
  selectedId.value = id;
}
function crowded() {
  roomyFor.value = walkKey.value;
}

function run() {
  const walk = deps.value;
  if (!walk) return;
  flight?.abort();
  selectedId.value = null;
  const key = pairKey(ends.value.from, ends.value.to);
  const cached = cache.get(key);
  if (cached) {
    search.value = { state: "done", result: cached };
    return;
  }
  const controller = new AbortController();
  flight = controller;
  search.value = { state: "loading" };
  findWalks(walk, ends.value.from, ends.value.to, controller.signal).then(
    (found) => {
      if (controller.signal.aborted) return;
      // A result an outage degraded is not kept, so asking again tries the sources again.
      if (cacheable(found)) cache.set(key, found);
      search.value = { state: "done", result: found };
    },
    (caught: unknown) => {
      if (controller.signal.aborted || isAbort(caught)) return;
      search.value = { state: "error", error: caught };
    },
  );
}

// The panel's state, the same in the floating card and in the phone's sheet.
const controls = computed(() => ({
  lang: props.lang,
  inSheet: phone.value,
  apiKey: props.apiKey,
  title: props.title,
  badge: props.badge,
  placesUnavailable: placesUnavailable.value,
  basemapUnavailable: basemapUnavailable.value,
  commute: commute.value,
  isSample: sample.value !== null,
  from: from.value,
  to: to.value,
  boxes: boxes.value,
  sampleId: sampleId.value,
  weights: weights.value,
  budget: budget.value,
  minGain: minGain.value,
  method: method.value,
}));
const routesList = computed(() => ({
  lang: props.lang,
  search: search.value,
  rows: rows.value,
  pickId: pick.value?.id ?? null,
  fastestId: fastest.value?.id ?? null,
  shownId: shown.value?.id ?? null,
  budget: budget.value,
  pictures: props.pictures,
}));
</script>

<template>
  <!-- Where the map would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="alive-route-explorer"
    data-state="no-key"
    :class="['flex h-full min-h-[480px] items-start justify-center bg-muted/40 p-4 sm:items-center sm:p-6', props.class]"
  >
    <Alert role="alert" class="w-full max-w-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      <AlertTitle class="line-clamp-none">{{ copy.noKeyTitle }}</AlertTitle>
      <AlertDescription class="flex flex-col items-start gap-3">
        <a class="font-medium text-primary underline underline-offset-4" :href="KEY_URL" target="_blank" rel="noreferrer">{{ copy.getKey }}</a>
        <p>{{ copy.noKey }}</p>
      </AlertDescription>
    </Alert>
  </div>
  <div v-else data-unmap-block="alive-route-explorer" :class="['relative h-full min-h-[480px]', props.class]">
    <UnmapMap :id="ALIVE_MAP_ID" :api-key="props.apiKey" :lang="props.lang" map-style="tropic" :center="center" :zoom="14" class="h-full">
      <UnmapAliveLayers :rows="rows" :shown-id="shown?.id ?? null" :fastest-id="fastest?.id ?? null" :hovered-id="hoveredId" @select="select" />
      <UnmapAliveCamera :roomy="!!walkKey && roomyFor === walkKey" :frame="frame" :frame-key="frameKey" :panel="panelEl" :phone="phone" />
      <UnmapAliveOverlay
        :lang="props.lang"
        :shown="shown"
        :fastest="fastest"
        :is-pick="!!shown && shown.id === pick?.id"
        :phone="phone"
        :from="{ at: ends.from, label: from.name ?? copy.start }"
        :to="{ at: ends.to, label: to.name ?? copy.destination }"
        :pictures="props.pictures"
        :panel="panelEl"
        :why="whyEl"
        @select="select"
        @crowded="crowded"
      />
      <p aria-live="polite" class="sr-only">{{ said }}</p>
      <!-- z-20: above the map item's loading overlay (z-10), which would otherwise take the first clicks on the panel while the style loads; a search needs no map. -->
      <div v-if="phone" ref="panel" class="absolute inset-x-4 bottom-10 z-20 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
        <Card class="gap-3 rounded-3xl p-4 shadow-xl">
          <div class="flex min-w-0 items-center gap-2">
            <p class="min-w-0 truncate text-sm font-medium">{{ commute }}</p>
            <Badge v-if="sample" variant="secondary">{{ copy.sample }}</Badge>
          </div>
          <p v-if="search.state === 'error'" role="alert" class="text-sm text-destructive">{{ requestError(search.error, props.lang) }}</p>
          <p v-else class="text-sm text-muted-foreground tabular-nums">{{ said || (busy ? copy.going : copy.noResult) }}</p>
          <p v-if="partial" class="text-xs text-muted-foreground">{{ copy.partial }}</p>
          <div class="flex gap-2">
            <Button type="button" class="h-11 flex-1 rounded-full" :aria-busy="busy" @click="run">
              <Spinner v-if="busy" aria-hidden="true" />
              {{ copy.go }}
            </Button>
            <Sheet>
              <SheetTrigger as-child>
                <Button type="button" variant="outline" class="h-11 rounded-full">{{ copy.options }}</Button>
              </SheetTrigger>
              <SheetContent side="bottom" class="max-h-[85dvh] gap-0 overflow-y-auto p-0">
                <SheetTitle class="sr-only">{{ copy.options }}</SheetTitle>
                <SheetDescription class="sr-only">{{ copy.description }}</SheetDescription>
                <UnmapAliveControls
                  v-bind="controls"
                  @sample="pickSample"
                  @swap="swap"
                  @from="setFrom"
                  @to="setTo"
                  @weights="setWeights"
                  @budget="setBudget"
                  @min-gain="setMinGain"
                  @method="setMethod"
                >
                  <template #routes>
                    <UnmapAliveRoutesList v-bind="routesList" @select="select" @hover="hoveredId = $event" @retry="run" />
                    <UnmapAliveWhyCard
                      v-if="shown && fastest"
                      :lang="props.lang"
                      :shown="shown"
                      :fastest="fastest"
                      :places-unavailable="placesUnavailable"
                      :basemap-unavailable="basemapUnavailable"
                      :default-open="!narrow"
                    />
                  </template>
                  <template #footer>
                    <Button type="button" size="lg" class="h-14 w-full rounded-full text-lg font-semibold" :aria-busy="busy" @click="run">
                      <Spinner v-if="busy" aria-hidden="true" />
                      {{ copy.go }}
                    </Button>
                    <p class="text-center text-sm text-muted-foreground tabular-nums">{{ calls === null ? copy.callsBefore : copy.calls(calls) }}</p>
                  </template>
                </UnmapAliveControls>
              </SheetContent>
            </Sheet>
          </div>
        </Card>
      </div>
      <template v-else>
        <!-- A card floating on the map at the gutter, scrolling inside itself; the button stays in reach. -->
        <div
          ref="panel"
          class="absolute top-6 bottom-6 left-6 z-20 flex w-[440px] max-w-[calc(100%-3rem)] flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-4 motion-safe:duration-300"
        >
          <Card class="flex max-h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-3xl py-0 shadow-2xl">
            <UnmapAliveControls
              v-bind="controls"
              @sample="pickSample"
              @swap="swap"
              @from="setFrom"
              @to="setTo"
              @weights="setWeights"
              @budget="setBudget"
              @min-gain="setMinGain"
              @method="setMethod"
            >
              <template #routes>
                <UnmapAliveRoutesList v-bind="routesList" @select="select" @hover="hoveredId = $event" @retry="run" />
              </template>
              <template #footer>
                <Button type="button" size="lg" class="h-14 w-full rounded-full text-lg font-semibold" :aria-busy="busy" @click="run">
                  <Spinner v-if="busy" aria-hidden="true" />
                  {{ copy.go }}
                </Button>
                <p class="text-center text-sm text-muted-foreground tabular-nums">{{ calls === null ? copy.callsBefore : copy.calls(calls) }}</p>
              </template>
            </UnmapAliveControls>
          </Card>
        </div>
        <div v-if="shown && fastest" ref="why" class="absolute right-6 bottom-10 z-20 w-80 max-w-[calc(100%-32rem)]">
          <UnmapAliveWhyCard
            :lang="props.lang"
            :shown="shown"
            :fastest="fastest"
            :places-unavailable="placesUnavailable"
            :basemap-unavailable="basemapUnavailable"
            :default-open="!narrow"
          />
        </div>
      </template>
    </UnmapMap>
  </div>
</template>
