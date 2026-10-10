<script lang="ts">
// --- directions helpers (kept identical across both lanes) ---
export type DirectionsLang = "en" | "fr";
export type DirectionsMode = "auto" | "bicycle" | "pedestrian";

/** A place chosen in one of the search boxes. */
export interface DirectionsStop {
  name: string;
  lng: number;
  lat: number;
}

/** A route for one travel mode, as /route answers it. */
export interface DirectionsTrip {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

/** What /isochrone returns: nested polygons, one per band, each tagged with its `contour` in minutes. */
export interface TravelArea {
  type: "FeatureCollection";
  features: Array<{ properties?: { contour?: number } | null; geometry: { type: string; coordinates: unknown } | null }>;
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface DirectionsRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as fitBounds takes it. */
export interface DirectionsPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DIRECTIONS_MODES: DirectionsMode[] = ["auto", "bicycle", "pedestrian"];

/** The reachable-area bands per mode, inside the API's limit of 4 bands of at most 120 minutes. */
export const AREA_MINUTES: Record<DirectionsMode, number[]> = {
  auto: [10, 20, 30],
  bicycle: [10, 20, 30],
  pedestrian: [5, 10, 15],
};

/** Downtown Calgary. */
export const CALGARY: [number, number] = [-114.0719, 51.0447];

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const DIRECTIONS_MAP_ID = "directions";
/** Source ids (and layer-id prefixes) of what the block draws. */
export const DIRECTIONS_LAYERS = { route: "directions-route", area: "directions-area" };

/**
 * The bands are nested, so one light wash per band stacks: the nearest band, under all of them, is
 * the strongest. A dashed edge marks where each band ends, so the bands differ by more than shade.
 */
export const AREA_FILL = { "fill-opacity": 0.08 };
export const AREA_LINE = { "line-width": 1, "line-opacity": 0.6, "line-dasharray": [2, 2] };
/** Legend swatches, nearest band first, matching the stacked washes (about 22, 15 and 8 %). */
export const AREA_SWATCHES = ["bg-primary/20", "bg-primary/15", "bg-primary/8"];

/** Who the routes and travel times come from, and the licence they carry. */
export const ROUTING_CREDIT = {
  sourceUrl: "https://www.openstreetmap.org/copyright",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/",
};

/** The panel's inset from the map edge, and the gutter the camera keeps. */
export const GUTTER = 24;
/** The gutter a framed route or pair of ends keeps: room for the names beside the pins. */
export const FRAME_GUTTER = 48;
/** Camera moves and the route draw-in, in milliseconds. Reduced motion jumps. */
export const CAMERA_MS = 800;
export const DRAW_MS = 900;
/** The closest a route or a pair of ends is framed. */
export const ROUTE_MAX_ZOOM = 15;
/** The least map, in pixels, a padded camera must have before it tightens its gutter. */
const MIN_FRAME = 120;
/** The tightened gutter, and the least strip the camera keeps to frame in beside a tall panel. */
const TIGHT = 8;
const MIN_STRIP = 32;

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

export const DIRECTIONS_COPY = {
  en: {
    title: "Get directions",
    intro: "Choose a start and a destination, then switch how you travel.",
    from: "Choose a start",
    to: "Choose a destination",
    coverage: "Routing covers Canada.",
    mode: "Travel mode",
    modes: { auto: "Drive", bicycle: "Cycle", pedestrian: "Walk" },
    by: { auto: "by car", bicycle: "by bike", pedestrian: "on foot" },
    needStops: "Choose a start and a destination to see the trip.",
    loadingRoute: "Finding the route...",
    announceTrip: (mode: string, duration: string, distance: string) => `${mode}: ${duration}, ${distance}.`,
    area: "Reachable area",
    needStart: "Choose a start to see how far you can go from it.",
    legend: "Travel time",
    areaCaption: (by: string, minutes: string, place: string) => `Reachable ${by} within ${minutes} of ${place}.`,
    loadingArea: "Drawing the reachable area...",
    fold: "Hide details",
    unfold: "Show details",
    retry: "Try again",
    credit: "Routes and travel times:",
    source: "OpenStreetMap contributors",
    licence: "ODbL",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
    outside: "That place is outside Canada. Routing covers Canada.",
    noRoute: "No road or path connects those places.",
    areaNoRoute: "No road or path starts near there. Choose a start closer to one.",
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The API key was refused. Check it and try again.",
    unavailable: "The service didn't answer. Try again in a moment.",
    failed: "The request failed. Try again.",
  },
  fr: {
    title: "Obtenir un itinéraire",
    intro: "Choisissez un départ et une destination, puis changez de mode de déplacement.",
    from: "Choisir un départ",
    to: "Choisir une destination",
    coverage: "Les itinéraires couvrent le Canada.",
    mode: "Mode de déplacement",
    modes: { auto: "Voiture", bicycle: "Vélo", pedestrian: "À pied" },
    by: { auto: "en voiture", bicycle: "à vélo", pedestrian: "à pied" },
    needStops: "Choisissez un départ et une destination pour voir le trajet.",
    loadingRoute: "Calcul de l'itinéraire...",
    announceTrip: (mode: string, duration: string, distance: string) => `${mode} : ${duration}, ${distance}.`,
    area: "Zone accessible",
    needStart: "Choisissez un départ pour voir jusqu'où vous pouvez aller.",
    legend: "Temps de trajet",
    areaCaption: (by: string, minutes: string, place: string) => `Accessible ${by} en moins de ${minutes} depuis ${place}.`,
    loadingArea: "Tracé de la zone accessible...",
    fold: "Masquer les détails",
    unfold: "Afficher les détails",
    retry: "Réessayer",
    credit: "Itinéraires et temps de trajet :",
    source: "contributeurs d'OpenStreetMap",
    licence: "ODbL",
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
    outside: "Ce lieu est hors du Canada. Les itinéraires couvrent le Canada.",
    noRoute: "Aucune route ni aucun chemin ne relie ces lieux.",
    areaNoRoute: "Aucune route ni aucun chemin ne part de ce point. Choisissez un départ plus près d'une route.",
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La clé API a été refusée. Vérifiez-la et réessayez.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    failed: "La requête a échoué. Réessayez.",
  },
};

export function isMode(value: unknown): value is DirectionsMode {
  return DIRECTIONS_MODES.includes(value as DirectionsMode);
}

/** A stop as a primitive, so the same place chosen again is the same stop. */
export function stopKey(stop: DirectionsStop): string {
  return `${stop.lng},${stop.lat}`;
}

/**
 * Which side of each pin its name sits: toward the other end, so a framed trip keeps both names
 * inside the frame. With one end chosen, its name sits on the right.
 */
export function labelSides(from: DirectionsStop | null, to: DirectionsStop | null): { from: "left" | "right"; to: "left" | "right" } {
  if (!from || !to) return { from: "right", to: "right" };
  return from.lng <= to.lng ? { from: "right", to: "left" } : { from: "left", to: "right" };
}

/** "10, 20 and 30 min" (fr: "10, 20 et 30 min"). */
export function minutesList(minutes: number[], lang: DirectionsLang): string {
  const last = minutes[minutes.length - 1];
  const head = minutes.slice(0, -1).join(", ");
  return head ? `${head} ${lang === "fr" ? "et" : "and"} ${last} min` : `${last} min`;
}

/** A travel time as values and units, so the values can be set larger: 75 min is 1 h, 15 min. Never under a minute. */
export function durationParts(seconds: number): Array<{ value: string; unit: string }> {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return [{ value: String(minutes), unit: "min" }];
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? [{ value: String(hours), unit: "h" }, { value: String(rest), unit: "min" }] : [{ value: String(hours), unit: "h" }];
}

/** "13 min", "1 h 15 min". */
export function formatDuration(seconds: number): string {
  return durationParts(seconds)
    .map((part) => `${part.value} ${part.unit}`)
    .join(" ");
}

export function formatDistance(metres: number, lang: DirectionsLang): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${km.format(metres / 1000)} km`;
}

/** [[west, south], [east, north]] around some points, for fitBounds. A loop: spreading a long route into Math.min overflows the stack. */
export function pointsBounds(points: [number, number][]): [[number, number], [number, number]] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [
    [west, south],
    [east, north],
  ];
}

/** The reachable area's outer bounds, or null when it holds no polygon. */
export function areaBounds(area: TravelArea): [[number, number], [number, number]] | null {
  const points = area.features.flatMap(({ geometry }) => {
    if (geometry?.type === "Polygon") return (geometry.coordinates as [number, number][][])[0] ?? [];
    if (geometry?.type === "MultiPolygon") return (geometry.coordinates as [number, number][][][]).flatMap((polygon) => polygon[0] ?? []);
    return [];
  });
  return points.length > 0 ? pointsBounds(points) : null;
}

/**
 * Where the reachable area goes: under the route's lowest layer when the route is on the map, so
 * the wash never covers the line, and below the labels otherwise. A GeoJSONLayer `beforeId`.
 */
export function belowRoute(map: { getStyle(): { layers?: Array<{ id: string }> } | undefined }): string | undefined {
  return map.getStyle()?.layers?.find((layer) => layer.id.startsWith(`${DIRECTIONS_LAYERS.route}-`))?.id;
}

/**
 * Camera padding that keeps what the camera frames clear of the floating panel: its width on the
 * left when it floats beside the map, its height at the bottom when it is a sheet across it. An
 * even gutter when nothing is measured. When the full gutter would leave too little map (a tall
 * sheet on a small phone), the gutter tightens and the frame stays in the strip the panel leaves,
 * never behind the panel.
 */
export function panelPadding(map: DirectionsRect, panel: DirectionsRect | null, gutter = GUTTER): DirectionsPadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const cover = Math.round(sheet ? map.bottom - panel.top : panel.right - map.left);
  const size = sheet ? map.height : map.width;
  if (size - 2 * gutter - cover >= MIN_FRAME) return sheet ? { ...even, bottom: cover + gutter } : { ...even, left: cover + gutter };
  const near = Math.min(cover + TIGHT, size - TIGHT - MIN_STRIP);
  return sheet ? { ...even, top: TIGHT, bottom: near } : { ...even, left: near, right: TIGHT };
}

/** The pixel offset that centres a point in the padded area: easeTo's `offset`, which, unlike its `padding`, does not stick. */
export function paddingOffset(padding: DirectionsPadding): [number, number] {
  return [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2];
}

/**
 * What to tell the reader about a failed request: the place, the key or the rate when the gateway
 * says so; a service that did not answer for a 5xx or a request that never got an HTTP answer. An
 * area has only a start, so its `no_route` is about the start.
 */
export function requestError(caught: unknown, lang: DirectionsLang, kind: "route" | "area" = "route"): string {
  const copy = DIRECTIONS_COPY[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : null;
  if (failure.code === "outside_coverage") return copy.outside;
  if (failure.code === "no_route") return kind === "area" ? copy.areaNoRoute : copy.noRoute;
  if (status === 429) return copy.busy;
  if (status === 401 || status === 403) return copy.keyRefused;
  if (status === null || status >= 500) return copy.unavailable;
  return copy.failed;
}

export function isAbort(caught: unknown): boolean {
  return typeof caught === "object" && caught !== null && (caught as { name?: unknown }).name === "AbortError";
}

/** True when the reader asked for less motion: the camera jumps and the route appears whole. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** Fast start, soft landing: the route's draw-in. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}
// --- end directions helpers ---
</script>

<script setup lang="ts">
/**
 * <UnmapDirections> - a directions page in one component, for Vue and Nuxt. A full-bleed map with
 * a floating panel (a bottom sheet on a phone): choose a start and a destination and the route
 * draws in, with its travel time as the headline. The travel-mode switch is the point: drive,
 * cycle or walk, and the route redraws for that mode while each mode keeps its time on the switch,
 * so they compare at a glance. "Reachable area" shades how far you can go from the start in the
 * same mode.
 *
 * Composes the registry's map, geocoder, route-line, geojson-layer and marker-popup items on your
 * shadcn-vue Card, ToggleGroup, Button, Alert and Spinner, in your tokens. Each answer is one
 * request to the unmap API, asked once and remembered: the search boxes call
 * /geocode/autocomplete, a route calls /route once per mode, the reachable area calls /isochrone
 * once per start and mode. The routing API returns one route per request, so there are no
 * alternative routes to show.
 *
 * Installed by `npx shadcn-vue add` with its page at app/pages/directions.vue. Edit freely.
 */
import {
  computed,
  defineComponent,
  h,
  onScopeDispose,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
  type HTMLAttributes,
  type PropType,
} from "vue";
import { Router } from "@unmap/routing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnmapGeocoder } from "@/components/ui/geocoder";
import { UnmapGeojsonLayer } from "@/components/ui/geojson-layer";
import { UnmapMap } from "@/components/ui/map";
import { UnmapMarker, UnmapMarkerLabel } from "@/components/ui/marker-popup";
import { UnmapRouteLine } from "@/components/ui/route-line";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMapStore } from "@/lib/map-context";

const props = withDefaults(
  defineProps<{
    /** unmap API key. The page passes NUXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** Where the map opens, [longitude, latitude]. Defaults to downtown Calgary. */
    center?: [number, number];
    /** Opening zoom. Defaults to 11. */
    zoom?: number;
    /** Language of the copy, the numbers and the search results. Defaults to "en". */
    lang?: DirectionsLang;
    class?: HTMLAttributes["class"];
  }>(),
  { center: () => CALGARY, zoom: 11, lang: "en" },
);

// Vue's inject reads only a component's ancestors, so `useMap()` here could not see the map this
// component renders. It resolves the store that map registers in instead (an outer one if there
// is one, else one it provides to it), the way compare-swipe does.
const mapStore = useMapStore();
const map = computed(() => mapStore.get(DIRECTIONS_MAP_ID)?.map ?? null);

/** What was asked for one pair of ends (routes) or one start (areas): answers, requests in flight and failures, by mode. */
type Asked<T> = {
  key: string;
  byMode: Partial<Record<DirectionsMode, T>>;
  pending: DirectionsMode[];
  failed: Partial<Record<DirectionsMode, string>>;
};

function nothingAsked<T>(key = ""): Asked<T> {
  return { key, byMode: {}, pending: [], failed: {} };
}

/**
 * Requests in flight for one key, by mode. A new key (another end, another key) aborts them all;
 * another mode for the same key does not, since a request already sent is already billed.
 */
type Flights = { key: string; byMode: Partial<Record<DirectionsMode, AbortController>> };

function abortAll(flights: Flights) {
  Object.values(flights.byMode).forEach((controller) => controller?.abort());
  flights.byMode = {};
}

/**
 * The route on the map, drawing in. Its own component so the draw-in's frames re-render the line
 * alone, not the panel. A muted line (`active` false) is the last mode's, shown whole while the
 * next mode's route loads.
 */
const DrawnRoute = defineComponent({
  props: {
    line: { type: Object as PropType<DirectionsTrip>, required: true },
    active: { type: Boolean, required: true },
  },
  setup(route) {
    const progress = ref(1);
    let frame = 0;
    const cancel = () => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    };
    // A new route, or another mode's, draws in from its start; under reduced motion it appears whole.
    watch(
      () => (route.active ? route.line : null),
      (next) => {
        cancel();
        if (!next || prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
          progress.value = 1;
          return;
        }
        progress.value = 0;
        const start = performance.now();
        const step = () => {
          const t = Math.min(1, (performance.now() - start) / DRAW_MS);
          progress.value = easeOut(t);
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { immediate: true },
    );
    onScopeDispose(cancel);
    return () =>
      h(UnmapRouteLine, {
        mapId: DIRECTIONS_MAP_ID,
        id: DIRECTIONS_LAYERS.route,
        coordinates: route.line.coordinates,
        active: route.active,
        progress: route.active ? progress.value : undefined,
      });
  },
});

const copy = computed(() => DIRECTIONS_COPY[props.lang]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const router = computed(() => new Router({ key: props.apiKey, gateway: props.gateway }));
const from = shallowRef<DirectionsStop | null>(null);
const to = shallowRef<DirectionsStop | null>(null);
const mode = ref<DirectionsMode>("auto");
const trips = shallowRef<Asked<DirectionsTrip>>(nothingAsked());
const areas = shallowRef<Asked<TravelArea>>(nothingAsked());
const areaOn = ref(false);
// The route last on screen for these ends: it stays, muted, while the next mode's route loads.
const shown = shallowRef<{ pair: string; trip: DirectionsTrip } | null>(null);
// One polite announcement: the trip's time first, then the area, whichever of them answered last.
const said = shallowRef({ trip: "", area: "" });
// On a phone the sheet can fold to the headline, to give the map back.
const folded = ref(false);
const routeFlights: Flights = { key: "", byMode: {} };
const areaFlights: Flights = { key: "", byMode: {} };
const panel = useTemplateRef<HTMLElement>("panel");
const hintId = useId();
const endsId = useId();
const areaId = useId();
const modesId = useId();
const creditId = useId();

const fromKey = computed(() => (from.value ? stopKey(from.value) : ""));
const toKey = computed(() => (to.value ? stopKey(to.value) : ""));
const pair = computed(() => (from.value && to.value ? `${fromKey.value}>${toKey.value}` : null));
const routeAsked = computed(() => (pair.value && trips.value.key === pair.value ? trips.value : null));
const trip = computed(() => routeAsked.value?.byMode[mode.value] ?? null);
const routePending = computed(() => routeAsked.value?.pending.includes(mode.value) ?? false);
const routeError = computed(() => routeAsked.value?.failed[mode.value] ?? null);
const ghost = computed(() =>
  !trip.value && routePending.value && pair.value && shown.value?.pair === pair.value ? shown.value.trip : null,
);
const areaAsked = computed(() => (areaOn.value && from.value && areas.value.key === fromKey.value ? areas.value : null));
const area = computed(() => areaAsked.value?.byMode[mode.value] ?? null);
const areaPending = computed(() => areaAsked.value?.pending.includes(mode.value) ?? false);
const areaError = computed(() => areaAsked.value?.failed[mode.value] ?? null);
const line = computed(() => trip.value ?? ghost.value);
const isFolded = computed(() => folded.value && line.value !== null);
const known = computed<Partial<Record<DirectionsMode, DirectionsTrip>>>(() => routeAsked.value?.byMode ?? {});
const sides = computed(() => labelSides(from.value, to.value));
const announcement = computed(() => [said.value.trip, said.value.area].filter(Boolean).join(" "));
const etaParts = computed(() => (trip.value ? durationParts(trip.value.durationSeconds) : []));
const areaCaption = computed(() =>
  from.value ? copy.value.areaCaption(copy.value.by[mode.value], minutesList(AREA_MINUTES[mode.value], props.lang), from.value.name) : "",
);

function padding(gutter = GUTTER): DirectionsPadding {
  const container = map.value?.getContainer();
  if (!container) return panelPadding({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }, null, gutter);
  return panelPadding(container.getBoundingClientRect(), panel.value?.getBoundingClientRect() ?? null, gutter);
}
const duration = () => (prefersReducedMotion() ? 0 : CAMERA_MS);
function frameRoute(next: DirectionsTrip) {
  map.value?.fitBounds(pointsBounds(next.coordinates), { padding: padding(FRAME_GUTTER), maxZoom: ROUTE_MAX_ZOOM, duration: duration() });
}

// A chosen end pulls the map to it, clear of the panel; two frame the trip while its route loads.
// This runs after the search box's own fly to the result, and takes over from it.
watch([fromKey, toKey], () => {
  const live = map.value;
  const start = from.value;
  const end = to.value;
  if (!live || (!start && !end)) return;
  if (start && end) {
    // A route that already answered has framed itself.
    if (trips.value.key === pair.value && Object.keys(trips.value.byMode).length > 0) return;
    live.fitBounds(
      pointsBounds([
        [start.lng, start.lat],
        [end.lng, end.lat],
      ]),
      { padding: padding(FRAME_GUTTER), maxZoom: ROUTE_MAX_ZOOM, duration: duration() },
    );
    return;
  }
  const stop = (start ?? end)!;
  live.easeTo({ center: [stop.lng, stop.lat], zoom: Math.max(live.getZoom(), 13), offset: paddingOffset(padding()), duration: duration() });
});

// Folding or unfolding the sheet changes how much map there is: frame the route again.
watch(
  isFolded,
  () => {
    if (line.value) frameRoute(line.value);
  },
  { flush: "post" },
);

// A new key or gateway is a new account: forget what the old one was told, and ask again.
watch(router, () => {
  abortAll(routeFlights);
  abortAll(areaFlights);
  routeFlights.key = "";
  areaFlights.key = "";
  trips.value = nothingAsked();
  areas.value = nothingAsked();
  askRoute(from.value, to.value, mode.value, nothingAsked());
  askArea(from.value, mode.value, areaOn.value, nothingAsked());
});

onScopeDispose(() => {
  abortAll(routeFlights);
  abortAll(areaFlights);
});

/** Asks once per key and mode; the answer, or why it failed, is remembered under that key. */
function ask<T>(
  flights: Flights,
  asked: { value: Asked<T> },
  key: string,
  travel: DirectionsMode,
  kind: "route" | "area",
  call: (signal: AbortSignal) => Promise<T>,
  landed: (value: T) => void,
) {
  if (flights.key !== key) {
    abortAll(flights);
    flights.key = key;
  }
  if (flights.byMode[travel]) return;
  const controller = new AbortController();
  flights.byMode[travel] = controller;
  const mine = () => flights.byMode[travel] === controller;
  const update = (change: (current: Asked<T>) => Asked<T>) => {
    asked.value = change(asked.value.key === key ? asked.value : nothingAsked<T>(key));
  };
  const settle = (current: Asked<T>) => current.pending.filter((item) => item !== travel);
  update((current) => {
    const failed = { ...current.failed };
    delete failed[travel];
    return { ...current, pending: [...settle(current), travel], failed };
  });
  call(controller.signal).then(
    (value) => {
      if (!mine()) return;
      delete flights.byMode[travel];
      update((current) => ({ ...current, byMode: { ...current.byMode, [travel]: value }, pending: settle(current) }));
      landed(value);
    },
    (caught: unknown) => {
      if (!mine()) return;
      delete flights.byMode[travel];
      update((current) =>
        isAbort(caught)
          ? { ...current, pending: settle(current) }
          : { ...current, pending: settle(current), failed: { ...current.failed, [travel]: requestError(caught, props.lang, kind) } },
      );
    },
  );
}

function showTrip(next: DirectionsTrip, key: string, travel: DirectionsMode) {
  shown.value = { pair: key, trip: next };
  const sentence = copy.value.announceTrip(
    copy.value.modes[travel],
    formatDuration(next.durationSeconds),
    formatDistance(next.distanceMeters, props.lang),
  );
  said.value = { ...said.value, trip: sentence };
  frameRoute(next);
}

/** The route between two ends in one mode: remembered, or asked once. */
function askRoute(
  start: DirectionsStop | null,
  end: DirectionsStop | null,
  travel: DirectionsMode,
  remembered: Asked<DirectionsTrip> = trips.value,
) {
  said.value = { ...said.value, trip: "" };
  if (!start || !end) {
    abortAll(routeFlights);
    routeFlights.key = "";
    return;
  }
  const key = `${stopKey(start)}>${stopKey(end)}`;
  const known = remembered.key === key ? remembered.byMode[travel] : undefined;
  if (known) {
    showTrip(known, key, travel);
    return;
  }
  ask<DirectionsTrip>(
    routeFlights,
    trips,
    key,
    travel,
    "route",
    (signal) =>
      router.value.route([start.lng, start.lat], [end.lng, end.lat], { mode: travel, signal }).then((result) => ({
        coordinates: result.geometry.coordinates,
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
      })),
    (next) => {
      // An earlier mode's route is kept for its switch, but only the chosen mode's is shown.
      if (pair.value === key && mode.value === travel) showTrip(next, key, travel);
    },
  );
}

/** How far you can go from the start in one mode: remembered, or asked once. */
function askArea(start: DirectionsStop | null, travel: DirectionsMode, on: boolean, remembered: Asked<TravelArea> = areas.value) {
  said.value = { ...said.value, area: "" };
  if (!on || !start) return;
  const key = stopKey(start);
  const caption = copy.value.areaCaption(copy.value.by[travel], minutesList(AREA_MINUTES[travel], props.lang), start.name);
  if (remembered.key === key && remembered.byMode[travel]) {
    said.value = { ...said.value, area: caption };
    return;
  }
  ask<TravelArea>(
    areaFlights,
    areas,
    key,
    travel,
    "area",
    (signal) =>
      router.value.isochrone([start.lng, start.lat], { minutes: AREA_MINUTES[travel], mode: travel, signal }) as Promise<TravelArea>,
    (next) => {
      if (fromKey.value !== key || mode.value !== travel || !areaOn.value) return;
      said.value = { ...said.value, area: caption };
      // A route on screen keeps the camera; with none, the camera frames the area.
      const bounds = areaBounds(next);
      if (bounds && !trip.value) map.value?.fitBounds(bounds, { padding: padding(), duration: duration() });
    },
  );
}

function chooseFrom(result: { name: string; lng: number; lat: number }) {
  const next = { name: result.name, lng: result.lng, lat: result.lat };
  from.value = next;
  folded.value = false;
  askRoute(next, to.value, mode.value);
  askArea(next, mode.value, areaOn.value);
}

function chooseTo(result: { name: string; lng: number; lat: number }) {
  const next = { name: result.name, lng: result.lng, lat: result.lat };
  to.value = next;
  folded.value = false;
  askRoute(from.value, next, mode.value);
}

function chooseMode(value: unknown) {
  // Pressing the pressed item empties a single ToggleGroup; the mode stays.
  if (!isMode(value) || value === mode.value) return;
  mode.value = value;
  askRoute(from.value, to.value, value);
  askArea(from.value, value, areaOn.value);
}

function toggleArea() {
  areaOn.value = !areaOn.value;
  askArea(from.value, mode.value, areaOn.value);
}
</script>

<template>
  <!-- Where the map would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="directions"
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
  <div v-else data-unmap-block="directions" :class="['relative h-full min-h-[480px]', props.class]">
    <UnmapMap
      :id="DIRECTIONS_MAP_ID"
      :api-key="props.apiKey"
      :gateway="props.gateway"
      :center="props.center"
      :zoom="props.zoom"
      :lang="props.lang"
      class="h-full"
    >
      <UnmapGeojsonLayer
        v-if="area"
        :map-id="DIRECTIONS_MAP_ID"
        :id="DIRECTIONS_LAYERS.area"
        :data="area"
        :fill-paint="AREA_FILL"
        :line-paint="AREA_LINE"
        :circle-paint="false"
        :before-id="belowRoute"
      />
      <DrawnRoute v-if="line" :line="line" :active="trip !== null" />
      <!-- The start: a ring in --foreground. The destination: your pin in --primary. Each is named. -->
      <UnmapMarker v-if="from" :key="fromKey" :map-id="DIRECTIONS_MAP_ID" :lng-lat="[from.lng, from.lat]">
        <template #marker>
          <span class="block size-4 rounded-full border-[3px] border-foreground bg-background" />
        </template>
        <UnmapMarkerLabel :position="sides.from">{{ from.name }}</UnmapMarkerLabel>
      </UnmapMarker>
      <UnmapMarker v-if="to" :key="toKey" :map-id="DIRECTIONS_MAP_ID" :lng-lat="[to.lng, to.lat]">
        <UnmapMarkerLabel :position="sides.to">{{ to.name }}</UnmapMarkerLabel>
      </UnmapMarker>
      <p data-testid="directions-announce" aria-live="polite" class="sr-only">{{ announcement }}</p>
      <!-- A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most half the map) that clears the attribution. -->
      <div
        ref="panel"
        class="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[22rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
      >
        <Card class="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <div class="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level="2" class="min-w-0">{{ copy.title }}</CardTitle>
              <Button
                v-if="line"
                type="button"
                variant="ghost"
                size="sm"
                class="shrink-0 sm:hidden"
                :aria-expanded="!isFolded"
                :aria-controls="`${endsId} ${modesId} ${areaId} ${creditId}`"
                @click="folded = !folded"
              >
                {{ isFolded ? copy.unfold : copy.fold }}
              </Button>
            </div>
            <CardDescription class="max-sm:hidden">{{ copy.intro }}</CardDescription>
          </CardHeader>
          <!-- The ends, the mode and the answer stay put; only the reachable area below them scrolls. On a phone the whole sheet scrolls. -->
          <CardContent class="flex min-h-0 flex-1 flex-col gap-4 max-sm:overflow-y-auto max-sm:overscroll-contain">
            <div :id="endsId" :data-folded="isFolded" class="flex shrink-0 flex-col gap-2 max-sm:data-[folded=true]:hidden">
              <div class="relative flex flex-col gap-2">
                <!-- The rail from the start's ring to the destination's dot, the shapes the map pins use. -->
                <span aria-hidden="true" class="absolute top-1/4 bottom-1/4 left-1.5 -translate-x-1/2 border-l border-dashed border-border" />
                <div class="flex items-center gap-3">
                  <span aria-hidden="true" class="relative size-3 shrink-0 rounded-full border-2 border-foreground bg-background" />
                  <!-- `[&>p]:hidden` hides the <p> coverage line the geocoder renders after its combobox; the line below both boxes says it once. -->
                  <UnmapGeocoder
                    :map-id="DIRECTIONS_MAP_ID"
                    :api-key="props.apiKey"
                    :gateway="props.gateway"
                    :lang="props.lang"
                    :placeholder="copy.from"
                    proximity="map"
                    :fly-to-zoom="13"
                    class="[&>p]:hidden"
                    @select="chooseFrom"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span aria-hidden="true" class="relative size-3 shrink-0 rounded-full bg-primary" />
                  <UnmapGeocoder
                    :map-id="DIRECTIONS_MAP_ID"
                    :api-key="props.apiKey"
                    :gateway="props.gateway"
                    :lang="props.lang"
                    :placeholder="copy.to"
                    proximity="map"
                    :fly-to-zoom="13"
                    class="[&>p]:hidden"
                    @select="chooseTo"
                  />
                </div>
              </div>
              <p class="pl-6 text-xs text-muted-foreground max-sm:hidden">{{ copy.coverage }}</p>
            </div>
            <ToggleGroup
              :id="modesId"
              :data-folded="isFolded"
              type="single"
              variant="outline"
              :aria-label="copy.mode"
              :model-value="mode"
              class="grid w-full shrink-0 grid-cols-3 max-sm:data-[folded=true]:hidden"
              @update:model-value="chooseMode"
            >
              <ToggleGroupItem v-for="item in DIRECTIONS_MODES" :key="item" :value="item" class="h-auto flex-col gap-0.5 py-2 aria-pressed:font-semibold">
                <span>{{ copy.modes[item] }}</span> <span class="min-h-4 text-xs font-normal text-muted-foreground tabular-nums">{{ known[item] ? formatDuration(known[item].durationSeconds) : "" }}</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <!-- Where the trip lands, always there and tall enough for an error and its retry, so nothing jumps when it arrives. -->
            <div
              data-testid="directions-answer"
              :data-folded="isFolded"
              class="flex min-h-24 shrink-0 flex-col justify-center gap-1 max-sm:data-[folded=true]:min-h-0"
            >
              <Alert v-if="routeError" variant="destructive" role="alert">
                <AlertDescription class="flex flex-row flex-wrap items-center justify-between gap-2">
                  <span class="min-w-0">{{ routeError }}</span>
                  <Button type="button" variant="outline" size="sm" class="shrink-0" @click="askRoute(from, to, mode)">{{ copy.retry }}</Button>
                </AlertDescription>
              </Alert>
              <div
                v-else-if="trip"
                :key="`${pair}|${mode}`"
                class="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
              >
                <p data-testid="directions-eta" class="flex items-baseline gap-1">
                  <template v-for="(part, index) in etaParts" :key="part.unit">{{ index > 0 ? " " : "" }}<span class="text-3xl leading-none font-semibold tracking-tight tabular-nums">{{ part.value }}</span> <span class="text-sm text-muted-foreground">{{ part.unit }}</span></template>
                </p>
                <p data-testid="directions-distance" class="text-sm text-muted-foreground tabular-nums">
                  {{ `${formatDistance(trip.distanceMeters, props.lang)} ${copy.by[mode]}` }}
                </p>
              </div>
              <p v-else-if="routePending" class="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> <span>{{ copy.loadingRoute }}</span>
              </p>
              <p v-else class="text-sm text-muted-foreground">{{ copy.needStops }}</p>
            </div>
            <div
              :id="areaId"
              :data-folded="isFolded"
              class="-mx-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain border-t px-2 pt-4 max-sm:flex-none max-sm:overflow-visible max-sm:data-[folded=true]:hidden"
            >
              <div class="flex flex-col items-start gap-2">
                <Button
                  type="button"
                  :variant="areaOn ? 'secondary' : 'outline'"
                  :aria-pressed="areaOn"
                  :disabled="!from"
                  :aria-describedby="from ? undefined : hintId"
                  @click="toggleArea"
                >
                  <!-- On is marked by a check as well as the fill. -->
                  <span v-if="areaOn" aria-hidden="true" data-pressed-mark="">✓</span>
                  {{ copy.area }}
                </Button>
                <p v-if="!from" :id="hintId" class="text-xs text-muted-foreground">{{ copy.needStart }}</p>
              </div>
              <div v-if="areaOn && from" class="flex min-h-24 flex-col justify-center gap-2">
                <Alert v-if="areaError" variant="destructive" role="alert">
                  <AlertDescription class="flex flex-row flex-wrap items-center justify-between gap-2">
                    <span class="min-w-0">{{ areaError }}</span>
                    <Button type="button" variant="outline" size="sm" class="shrink-0" @click="askArea(from, mode, true)">{{ copy.retry }}</Button>
                  </AlertDescription>
                </Alert>
                <template v-else-if="area">
                  <ul :aria-label="copy.legend" class="flex flex-wrap gap-x-4 gap-y-1">
                    <li
                      v-for="(minutes, index) in AREA_MINUTES[mode]"
                      :key="minutes"
                      class="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
                    >
                      <span aria-hidden="true" :class="['size-3 rounded-sm border border-dashed border-primary', AREA_SWATCHES[index] ?? '']" />{{ `${minutes} min` }}
                    </li>
                  </ul>
                  <p data-testid="directions-area-caption" class="text-sm">{{ areaCaption }}</p>
                </template>
                <p v-else-if="areaPending" class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> <span>{{ copy.loadingArea }}</span>
                </p>
              </div>
            </div>
            <!-- Folded on a phone, the map's own attribution carries the credit until the sheet opens again. -->
            <p :id="creditId" :data-folded="isFolded" class="shrink-0 text-xs text-muted-foreground max-sm:data-[folded=true]:hidden">
              {{ copy.credit }} <a class="underline underline-offset-2" :href="ROUTING_CREDIT.sourceUrl" target="_blank" rel="noreferrer">{{ copy.source }}</a>, <a class="underline underline-offset-2" :href="ROUTING_CREDIT.licenceUrl" target="_blank" rel="noreferrer">{{ copy.licence }}</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </UnmapMap>
  </div>
</template>
