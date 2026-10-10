<script lang="ts">
// --- coordinate helpers (kept identical across both lanes) ---

/** Autocomplete has no server-side box, so a `bbox` search asks for this many times `limit`. */
export const BBOX_OVERFETCH = 4;

/**
 * Coordinates typed into the search box, as [longitude, latitude], or null when the text is not a
 * pair. Read as `lat, lng` (the order Google and Mapbox use), except that a first number beyond 90,
 * or a negative first and a positive second, is read as `lng, lat`: all of Canada has a positive
 * latitude and a negative longitude, so `-114.07, 51.05` and `51.05, -114.07` are both Calgary.
 *
 * Two numbers split by a comma, a semicolon, or spaces. A decimal point or a French decimal comma
 * both work, but not mixed in one pair. The comma is the hard case:
 * - Spaces alone split a pair only when a number has a decimal, so "10 12" stays a text search.
 * - A comma with no space around it between two unsigned whole numbers is a decimal comma:
 *   "51,05" and "12,5" are one number, not a pair, and stay a text search. "12, 5" is a pair.
 * - Decimal commas split by a comma parse only as "51,05, -114,07": both numbers with a decimal
 *   comma and a space after the separating comma, the one spelling with a single reading.
 *   "51,05,-114,07" and "51,05, -114" are null. Use a space or ";" to be sure: "51,05; -114,07".
 * U+2212, the minus sign Wikipedia prints, counts as "-". Degrees-minutes-seconds stay text.
 */
export function parseCoordinates(text: string): [number, number] | null {
  const match = /^\s*([+-]?\d+(?:[.,]\d+)?)(\s*[,;]\s*|\s+)([+-]?\d+(?:[.,]\d+)?)\s*$/.exec(
    text.replace(/\u2212/g, "-"),
  );
  if (!match) return null;
  const [, first, separator, second] = match as unknown as [string, string, string, string];
  const mark = separator.trim();
  const dot = first.includes(".") || second.includes(".");
  const commaDecimals = Number(first.includes(",")) + Number(second.includes(","));
  if (dot && commaDecimals) return null;
  if (!mark && !dot && !commaDecimals) return null;
  if (mark === ",") {
    if (commaDecimals && (commaDecimals < 2 || !/,\s/.test(separator))) return null;
    if (separator === "," && !dot && !/^[+-]/.test(second)) return null;
  }
  const a = Number(first.replace(",", "."));
  const b = Number(second.replace(",", "."));
  const [lng, lat] = Math.abs(a) > 90 || (a < 0 && b > 0) ? [a, b] : [b, a];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lng, lat] : null;
}

/** True when a point lies inside `bbox` ([west, south, east, north]), edges included. */
export function inBox(point: { lng: number; lat: number }, bbox: [number, number, number, number]): boolean {
  const [west, south, east, north] = bbox;
  return point.lng >= west && point.lng <= east && point.lat >= south && point.lat <= north;
}

/** A `proximity` prop as a primitive, so an inline tuple does not search again on every render. */
export function proximityKey(proximity: [number, number] | "map" | undefined): string {
  return proximity === "map" ? "map" : proximity ? proximity.join(",") : "";
}

/**
 * The `focus` to send for a `proximityKey`: `"map"` reads the map's centre now, `"lng,lat"` is that
 * point, and `""` is none.
 */
export function focusOf(
  proximity: string,
  map: { getCenter(): { lng: number; lat: number } } | null,
): [number, number] | undefined {
  if (proximity === "map") {
    const centre = map?.getCenter();
    return centre ? [wrapLongitude(centre.lng), centre.lat] : undefined;
  }
  if (!proximity) return undefined;
  const [lng, lat] = proximity.split(",").map(Number);
  return [wrapLongitude(lng!), lat!];
}

/**
 * A longitude brought back into [-180, 180]. MapLibre can report a centre past the antimeridian
 * after a pan or `flyTo`, and the gateway rejects such a `focus` with a 400.
 */
function wrapLongitude(lng: number): number {
  return lng >= -180 && lng <= 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** The gateway's answer for a point outside Canada: status 422, code `outside_coverage`. */
export function isOutsideCoverage(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "outside_coverage";
}
// --- end coordinate helpers ---
</script>

<script setup lang="ts">
/**
 * <UnmapGeocoder> - an unmap search box for Vue.
 *
 * Calls the unmap gateway geocode API through `@unmap/geocoding` and flies the shared map
 * (from `map-context`) to the chosen result. Server results are rendered through your
 * shadcn-vue Combobox so pointer, keyboard and screen-reader behaviour stay aligned with the
 * rest of your interface. 200 ms debounce; superseded requests are cancelled.
 *
 * Coordinates typed into the box (`51.05, -114.07`, or `-114.07, 51.05`) are reverse geocoded
 * rather than searched; `:reverse-geocode="false"` turns that off. `bbox` keeps results inside a
 * rectangle, `proximity` prefers results near a point (or the map's centre, with `"map"`), and
 * the `result` slot draws each option your way.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 * Import it as `import { UnmapGeocoder } from "@/components/ui/geocoder"`; Nuxt auto-imports it
 * as `<UiUnmapGeocoder>` through shadcn-nuxt.
 */

import { computed, ref, shallowRef, watch, type HTMLAttributes } from "vue";
import { Geocoder as GeocoderClient, type GeocodeResult } from "@unmap/geocoding";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    /** unmap API key. */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** Map id to control when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Placeholder text, also used as the accessible label. */
    placeholder?: string;
    /** Max suggestions to request. Defaults to 5. */
    limit?: number;
    /** Result language. */
    lang?: "en" | "fr";
    /** Zoom level to fly to on selection. Defaults to 15. */
    flyToZoom?: number;
    /** Reverse geocode coordinates typed into the box instead of searching for them. Defaults to true. */
    reverseGeocode?: boolean;
    /**
     * [west, south, east, north]: only results inside it are shown. Autocomplete has no
     * server-side box, so more suggestions are requested and filtered here, and fewer than
     * `limit` can show. A typed coordinate is looked up wherever it is.
     */
    bbox?: [number, number, number, number];
    /**
     * Prefer results near [lng, lat], or near the map's centre at the moment of each search with
     * `"map"`. Moves the ranking only; nothing is excluded.
     */
    proximity?: [number, number] | "map";
    /** What the list says when a search finds nothing. Defaults to a line saying search covers Canada. */
    emptyText?: string;
    /**
     * What the list says when a search fails, from the error (a gateway error carries `status` and
     * `code`). Defaults to the outside-Canada line for a point abroad, else a generic failure line.
     */
    errorText?: (error: unknown) => string;
    class?: HTMLAttributes["class"];
  }>(),
  // An absent Vue boolean is `false`, so the default must be spelled out.
  { placeholder: "Search places", limit: 5, flyToZoom: 15, reverseGeocode: true },
);

const emit = defineEmits<{
  /** Emitted after a result is chosen (before the map flies). */
  select: [result: GeocodeResult];
}>();

defineSlots<{
  /** An option's content. Defaults to the name over the city. */
  result?: (props: { result: GeocodeResult }) => unknown;
}>();

const map = useMap(() => props.mapId);
const coverageHint = computed(() =>
  props.lang === "fr" ? "La recherche couvre le Canada." : "Search covers Canada.",
);
const emptyHint = computed(() =>
  props.lang === "fr"
    ? "Aucun lieu trouvé. La recherche couvre le Canada."
    : "No places found. Search covers Canada.",
);
const outsideHint = computed(() =>
  props.lang === "fr"
    ? "Ce point est hors du Canada. La recherche couvre le Canada."
    : "That point is outside Canada. Search covers Canada.",
);
const client = computed(() => new GeocoderClient({ key: props.apiKey, gateway: props.gateway }));
const boxKey = computed(() => (props.bbox ? props.bbox.join(",") : ""));
const focusKey = computed(() => proximityKey(props.proximity));

/** What the input shows; also what the debounce watcher searches for. */
const term = ref("");
const selected = ref<GeocodeResult | null>(null);
const results = shallowRef<GeocodeResult[]>([]);
const open = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
let abort: AbortController | null = null;
// Monotonic request id: a late response from a superseded request is ignored even if its
// abort did not land in time.
let request = 0;

function reducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

watch(
  [term, client, () => props.limit, () => props.lang, () => props.reverseGeocode, boxKey, focusKey],
  ([query, geocoder, limit, lang, reverse, box, focus], _previous, onCleanup) => {
    const q = query.trim();
    const current = ++request;
    abort?.abort();

    // Too short, or the text is just the name of what was chosen: nothing to search.
    if (q.length < 2 || (selected.value && q === selected.value.name)) {
      results.value = [];
      loading.value = false;
      error.value = null;
      open.value = false;
      return;
    }

    results.value = [];
    loading.value = true;
    error.value = null;
    open.value = true;
    const coordinates = reverse ? parseCoordinates(q) : null;
    const bbox = box ? (box.split(",").map(Number) as [number, number, number, number]) : undefined;
    let controller: AbortController | null = null;

    const timer = setTimeout(async () => {
      controller = new AbortController();
      abort = controller;
      try {
        let hits: GeocodeResult[];
        if (coordinates) {
          hits = await geocoder.reverse(coordinates[0], coordinates[1], { limit, lang, signal: controller.signal });
        } else {
          // Read now, so `proximity="map"` sees the centre at the moment of the search.
          const near = focusOf(focus, map.value);
          const found = await geocoder.autocomplete(q, {
            limit: bbox ? Math.min(50, limit * BBOX_OVERFETCH) : limit,
            lang,
            ...(near ? { focus: near } : {}),
            signal: controller.signal,
          });
          hits = bbox ? found.filter((hit) => inBox(hit, bbox)).slice(0, limit) : found;
        }
        if (current !== request) return;
        results.value = hits;
        open.value = true;
        loading.value = false;
      } catch (caught) {
        if (current !== request || (caught as Error)?.name === "AbortError") return;
        results.value = [];
        error.value =
          props.errorText?.(caught) ??
          (isOutsideCoverage(caught)
            ? outsideHint.value
            : props.lang === "fr"
              ? "La recherche a échoué. Vérifiez la clé d'API et réessayez."
              : "Search failed. Check the API key and try again.");
        loading.value = false;
        open.value = true;
      }
    }, 200);
    onCleanup(() => {
      clearTimeout(timer);
      controller?.abort();
    });
  },
);

function choose(result: GeocodeResult | null | undefined) {
  if (!result) return;
  request += 1;
  abort?.abort();
  selected.value = result;
  term.value = result.name;
  results.value = [];
  loading.value = false;
  error.value = null;
  open.value = false;
  emit("select", result);
  map.value?.flyTo({
    center: [result.lng, result.lat],
    zoom: props.flyToZoom,
    duration: reducedMotion() ? 0 : 600,
  });
}

function onOpenChange(next: boolean) {
  if (next) {
    const q = term.value.trim();
    if (q.length >= 2 && !(selected.value && q === selected.value.name)) open.value = true;
    return;
  }
  request += 1;
  abort?.abort();
  loading.value = false;
  open.value = false;
}
</script>

<template>
  <div :class="cn('relative w-full min-w-0', props.class)" data-unmap-geocoder="">
    <Combobox
      :model-value="selected"
      :open="open"
      :ignore-filter="true"
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      by="id"
      @update:model-value="choose"
      @update:open="onOpenChange"
    >
      <ComboboxAnchor class="w-full">
        <ComboboxInput
          v-model="term"
          :display-value="(value: GeocodeResult) => value?.name ?? ''"
          :placeholder="placeholder"
          :aria-label="placeholder"
          autocomplete="off"
          class="w-full"
        />
      </ComboboxAnchor>
      <ComboboxList>
        <ComboboxItem v-for="result in results" :key="result.id" :value="result">
          <slot name="result" :result="result">
            <span class="flex min-w-0 flex-col">
              <span class="truncate">{{ result.name }}</span>
              <span v-if="result.address?.city" class="truncate text-xs text-muted-foreground">{{ result.address.city }}</span>
            </span>
          </slot>
        </ComboboxItem>
        <ComboboxEmpty v-if="!results.length">
          <span v-if="loading" role="status">{{ props.lang === "fr" ? "Recherche..." : "Searching..." }}</span>
          <span v-else-if="error" role="alert">{{ error }}</span>
          <span v-else>{{ props.emptyText ?? emptyHint }}</span>
        </ComboboxEmpty>
      </ComboboxList>
    </Combobox>
    <p class="mt-1 text-xs text-muted-foreground">{{ coverageHint }}</p>
  </div>
</template>
