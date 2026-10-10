<script lang="ts">
import type { StoreCollection, StoreFeature } from "@/lib/store-locator-data";

// --- store-locator helpers (kept identical across both lanes) ---
export type LocatorLang = "en" | "fr";

/** [west, south, east, north], as the map's visible bounds. */
export type LocatorBounds = [number, number, number, number];

/** The place the reader searched for. */
export interface LocatorOrigin {
  name: string;
  lng: number;
  lat: number;
}

/** What /isochrone returns: GeoJSON polygons, largest band first. */
export interface LocatorReach {
  type: "FeatureCollection";
  features: Array<{ geometry: { type: string; coordinates: unknown } | null }>;
}

export interface StoreRow {
  feature: StoreFeature;
  /** Metres from the searched place; null before a search. */
  distance: number | null;
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface LocatorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as fitBounds takes it. */
export interface LocatorPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

export const LOCATOR_COPY = {
  en: {
    title: "Find a branch",
    intro: "Search a place, or pick a branch on the map.",
    search: "Search a place",
    list: "Branches",
    count: (n: number) => (n === 1 ? "branch in view" : "branches in view"),
    empty: "No branches here. Zoom out, move the map, or show them all.",
    allStores: "Show all branches",
    announceNearest: (place: string, store: string, distance: string) => `Nearest to ${place}: ${store}, ${distance}.`,
    announcePick: (store: string) => `${store} selected.`,
    capped: (n: number) => `Showing the first ${n}. Zoom in to see the rest.`,
    showList: "Show the list",
    hideList: "Hide the list",
    close: "Close",
    directions: "Directions",
    needOrigin: "Search a place to get directions from it.",
    reach: (minutes: number) => `${minutes} min drive area`,
    reachArea: (minutes: number, store: string) => `The shaded area is within a ${minutes} min drive of ${store}.`,
    reachInside: (place: string, minutes: number, store: string) => `${place} is within a ${minutes} min drive of ${store}.`,
    reachOutside: (place: string, minutes: number, store: string) =>
      `${place} is more than a ${minutes} min drive from ${store}.`,
    byCar: "by car",
    loadingRoute: "Finding the route...",
    loadingReach: "Drawing the drive area...",
    retry: "Try again",
    openToday: "Open today",
    closedToday: "Closed today",
    closed: "Closed",
    source: "Data:",
    routesCredit: "Routes and drive areas:",
    osm: "OpenStreetMap contributors",
    odbl: "ODbL",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
    outside: "That place is outside Canada. Routing covers Canada.",
    noRoute: "No road connects those places.",
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The API key was refused. Check it and try again.",
    unavailable: "The service didn't answer. Try again in a moment.",
    failed: "The request failed. Try again.",
  },
  fr: {
    title: "Trouver une succursale",
    intro: "Cherchez un lieu ou choisissez une succursale sur la carte.",
    search: "Chercher un lieu",
    list: "Succursales",
    count: (n: number) => (n === 1 ? "succursale visible" : "succursales visibles"),
    empty: "Aucune succursale ici. Dézoomez, déplacez la carte ou affichez-les toutes.",
    allStores: "Afficher toutes les succursales",
    announceNearest: (place: string, store: string, distance: string) => `Plus proche de ${place} : ${store}, ${distance}.`,
    announcePick: (store: string) => `${store} sélectionnée.`,
    capped: (n: number) => `Affichage des ${n} premières. Zoomez pour voir les autres.`,
    showList: "Afficher la liste",
    hideList: "Masquer la liste",
    close: "Fermer",
    directions: "Itinéraire",
    needOrigin: "Cherchez un lieu pour obtenir un itinéraire à partir de celui-ci.",
    reach: (minutes: number) => `Zone à ${minutes} min en voiture`,
    reachArea: (minutes: number, store: string) => `La zone colorée est à moins de ${minutes} min en voiture de ${store}.`,
    reachInside: (place: string, minutes: number, store: string) => `${place} est à moins de ${minutes} min en voiture de ${store}.`,
    reachOutside: (place: string, minutes: number, store: string) => `${place} est à plus de ${minutes} min en voiture de ${store}.`,
    byCar: "en voiture",
    loadingRoute: "Calcul de l'itinéraire...",
    loadingReach: "Tracé de la zone...",
    retry: "Réessayer",
    openToday: "Ouvert aujourd'hui",
    closedToday: "Fermé aujourd'hui",
    closed: "Fermé",
    source: "Données :",
    routesCredit: "Itinéraires et zones de trajet :",
    osm: "contributeurs d'OpenStreetMap",
    odbl: "ODbL",
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
    outside: "Ce lieu est hors du Canada. Les itinéraires couvrent le Canada.",
    noRoute: "Aucune route ne relie ces lieux.",
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La clé API a été refusée. Vérifiez-la et réessayez.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    failed: "La requête a échoué. Réessayez.",
  },
} satisfies Record<LocatorLang, Record<string, string | ((...values: never[]) => string)>>;

/** Downtown Ottawa, where the sample branches are. */
export const OTTAWA: [number, number] = [-75.69, 45.42];

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const LOCATOR_MAP_ID = "store-locator";
/** Source ids (and layer-id prefixes) of what the block draws. */
export const LOCATOR_LAYERS = {
  stores: "store-locator-stores",
  points: "store-locator-stores-points",
  reach: "store-locator-reach",
  route: "store-locator-route",
  focus: "store-locator-focus",
};

/** Who the routes and drive areas come from, and the licence they carry. */
export const ROUTING_CREDIT = {
  sourceUrl: "https://www.openstreetmap.org/copyright",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/",
};

/** The drive-time halo is a light wash of the fill colour, so the stores under it stay readable. */
export const REACH_FILL = { "fill-opacity": 0.15 };
/** The ring on the store under the pointer or picked: larger than a point, on a thick halo of the page ground, below the labels. */
export const FOCUS_CIRCLE = { "circle-radius": 10, "circle-stroke-width": 3 };

/** The most rows the list renders; the headline still counts them all. */
export const LIST_LIMIT = 50;
/** How many of the nearest stores a search frames with the searched place. */
export const NEAREST_FRAMED = 3;
/** The panel's inset from the map edge, and the gutter the camera keeps. */
export const GUTTER = 24;
/** Camera moves and the route draw-in, in milliseconds. Reduced motion jumps. */
export const CAMERA_MS = 800;
export const DRAW_MS = 900;

const EARTH_RADIUS_M = 6_371_008.8;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
/** The least map, in pixels, a padded camera must have before it tightens its gutter. */
const MIN_FRAME = 120;
/** The tightened gutter, and the least strip the camera keeps to frame in beside a tall panel. */
const TIGHT = 8;
const MIN_STRIP = 32;

/** Great-circle distance in metres. */
export function distanceMetres(a: [number, number], b: [number, number]): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The map's visible bounds as [west, south, east, north]. */
export function boundsOf(map: { getBounds(): { toArray(): number[][] } }): LocatorBounds {
  const [southWest, northEast] = map.getBounds().toArray();
  return [southWest![0]!, southWest![1]!, northEast![0]!, northEast![1]!];
}

export function inBounds([lng, lat]: [number, number], [west, south, east, north]: LocatorBounds): boolean {
  if (lat < south || lat > north) return false;
  // Across the antimeridian `west` is greater than `east`.
  return west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
}

function inRing([x, y]: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(point: [number, number], rings: [number, number][][]): boolean {
  const [outer, ...holes] = rings;
  return !!outer && inRing(point, outer) && !holes.some((hole) => inRing(point, hole));
}

/** The polygons of a drive-time area, each as its rings. */
function polygonsOf(reach: LocatorReach): [number, number][][][] {
  return reach.features.flatMap(({ geometry }) => {
    if (geometry?.type === "Polygon") return [geometry.coordinates as [number, number][][]];
    if (geometry?.type === "MultiPolygon") return geometry.coordinates as [number, number][][][];
    return [];
  });
}

/** True when the point is inside any polygon of the drive-time area. */
export function inReach(point: [number, number], reach: LocatorReach): boolean {
  return polygonsOf(reach).some((polygon) => inPolygon(point, polygon));
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

/** The drive-time area's outer bounds, or null when it holds no polygon. */
export function reachBounds(reach: LocatorReach): [[number, number], [number, number]] | null {
  const points = polygonsOf(reach).flatMap((polygon) => polygon[0] ?? []);
  return points.length > 0 ? pointsBounds(points) : null;
}

export function storeName(feature: StoreFeature, lang: LocatorLang): string {
  return lang === "fr" ? feature.properties.name_fr : feature.properties.name;
}

/**
 * The list beside the map: every store inside the view, nearest first after a search, by name
 * before one. The panel renders the first LIST_LIMIT and counts the rest.
 */
export function visibleStores(
  stores: StoreCollection,
  options: { bounds: LocatorBounds | null; origin: LocatorOrigin | null; lang: LocatorLang },
): StoreRow[] {
  const { bounds, origin, lang } = options;
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  return stores.features
    .filter((feature) => !bounds || inBounds(feature.geometry.coordinates, bounds))
    .map((feature) => ({
      feature,
      distance: origin ? distanceMetres([origin.lng, origin.lat], feature.geometry.coordinates) : null,
    }))
    .sort((a, b) =>
      a.distance !== null && b.distance !== null
        ? a.distance - b.distance
        : storeName(a.feature, lang).localeCompare(storeName(b.feature, lang), locale),
    );
}

/** The stores to ring on the map, in order, each once: the one under the pointer and the one picked. */
export function focusCollection(stores: StoreCollection, ids: Array<string | null | undefined>): StoreCollection {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  return {
    type: "FeatureCollection",
    features: wanted
      .map((id) => stores.features.find((feature) => feature.properties.id === id))
      .filter((feature): feature is StoreFeature => !!feature),
  };
}

/**
 * Camera padding that keeps what the camera frames clear of the floating panel: its width on the
 * left when it floats beside the map, its height at the bottom when it is a sheet across it. An
 * even gutter when nothing is measured. When the full gutter would leave too little map (a tall
 * sheet on a small phone), the gutter tightens and the frame stays in the strip the panel leaves,
 * never behind the panel.
 */
export function panelPadding(map: LocatorRect, panel: LocatorRect | null, gutter = GUTTER): LocatorPadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const cover = Math.round(sheet ? map.bottom - panel.top : panel.right - map.left);
  const size = sheet ? map.height : map.width;
  if (size - 2 * gutter - cover >= MIN_FRAME) return sheet ? { ...even, bottom: cover + gutter } : { ...even, left: cover + gutter };
  const near = Math.min(cover + TIGHT, size - TIGHT - MIN_STRIP);
  return sheet ? { ...even, top: TIGHT, bottom: near } : { ...even, left: near, right: TIGHT };
}

/**
 * The list's scrollTop that shows a row whole, moving as little as it can; unchanged when the row
 * shows already. Scrolling the list itself, not scrollIntoView, keeps the page and the panel still.
 */
export function listScrollTop(
  view: { scrollTop: number; clientHeight: number },
  row: { offsetTop: number; offsetHeight: number },
): number {
  if (row.offsetTop < view.scrollTop) return row.offsetTop;
  const bottom = row.offsetTop + row.offsetHeight;
  return bottom > view.scrollTop + view.clientHeight ? bottom - view.clientHeight : view.scrollTop;
}

/** The pixel offset that centres a point in the padded area: easeTo's `offset`, which, unlike its `padding`, does not stick. */
export function paddingOffset(padding: LocatorPadding): [number, number] {
  return [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2];
}

export function formatDistance(metres: number, lang: LocatorLang): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${km.format(metres / 1000)} km`;
}

/** "18 min", "1 h 15 min": a drive time, never under a minute. */
export function formatDuration(seconds: number, _lang: LocatorLang): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
}

/** Today's opening hours as the data gives them ("10:00-20:30"), or "Closed". `day` is Date#getDay(). */
export function hoursToday(feature: StoreFeature, day: number, lang: LocatorLang): string {
  return feature.properties.hours[DAYS[day] ?? "sun"] ?? LOCATOR_COPY[lang].closed;
}

/** "Open today 10:00-20:30" or "Closed today". */
export function todayLine(feature: StoreFeature, day: number, lang: LocatorLang): string {
  const hours = feature.properties.hours[DAYS[day] ?? "sun"];
  const copy = LOCATOR_COPY[lang];
  return hours ? `${copy.openToday} ${hours}` : copy.closedToday;
}

/**
 * What to tell the reader about a failed request: the place, the key or the rate when the gateway
 * says so; a service that did not answer for a 5xx or a request that never got an HTTP answer.
 */
export function requestError(caught: unknown, lang: LocatorLang): string {
  const copy = LOCATOR_COPY[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : null;
  if (failure.code === "outside_coverage") return copy.outside;
  if (failure.code === "no_route") return copy.noRoute;
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
// --- end store-locator helpers ---
</script>

<script setup lang="ts">
/**
 * <UnmapStoreLocator> - a store-locator page in one component, for Vue and Nuxt. A full-bleed map
 * with a floating panel (a bottom sheet on a phone): search a place and the map pulls in to it and
 * its nearest stores; the list is the map's legend, listing the stores in view as clusters split on
 * zoom; hover either and the other answers; pick a store for its hours, a drive-time halo round
 * it, and directions.
 *
 * Composes the registry's map, geocoder, cluster-layer, geojson-layer, route-line and
 * marker-popup items on your shadcn-vue Card, Button, Alert and Spinner, in your tokens. Each
 * action is one request to the unmap API: the search box calls /geocode/autocomplete (and
 * /geocode/reverse for typed coordinates), the drive area calls /isochrone, "Directions" calls
 * /route. Nothing is requested until the reader acts. Routes and drive areas are OpenStreetMap
 * data (ODbL), credited in the panel.
 *
 * Ships with Ottawa Public Library branches (lib/store-locator-data) and credits them. Pass
 * `stores` for your own points. Installed by `npx shadcn-vue add` with its page at
 * app/pages/store-locator.vue. Edit freely.
 */
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
  type HTMLAttributes,
  type PropType,
} from "vue";
import { Router, type LngLat } from "@unmap/routing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnmapClusterLayer } from "@/components/ui/cluster-layer";
import { UnmapGeocoder } from "@/components/ui/geocoder";
import { UnmapGeojsonLayer } from "@/components/ui/geojson-layer";
import { UnmapMap } from "@/components/ui/map";
import { UnmapMarker, UnmapMarkerLabel } from "@/components/ui/marker-popup";
import { UnmapRouteLine } from "@/components/ui/route-line";
import { Spinner } from "@/components/ui/spinner";
import { useMapStore } from "@/lib/map-context";
import { STORES, STORES_SOURCE } from "@/lib/store-locator-data";

const props = withDefaults(
  defineProps<{
    /** unmap API key. The page passes NUXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** Your stores: a FeatureCollection of points with StoreProperties. Defaults to the sample Ottawa Public Library branches. */
    stores?: StoreCollection;
    /** The drive time the halo round a store covers, in minutes (1 to 120). Defaults to 10. */
    driveMinutes?: number;
    /** Where the map opens, [longitude, latitude]. Defaults to downtown Ottawa. */
    center?: [number, number];
    /** Opening zoom. Defaults to 11. */
    zoom?: number;
    /** Language of the copy, the numbers and the store names. Defaults to "en". */
    lang?: LocatorLang;
    class?: HTMLAttributes["class"];
  }>(),
  { stores: () => STORES, driveMinutes: 10, center: () => OTTAWA, zoom: 11, lang: "en" },
);

// Vue's inject reads only a component's ancestors, so `useMap()` here could not see the map this
// component renders. It resolves the store that map registers in instead (an outer one if there
// is one, else one it provides to it), the way compare-swipe does.
const mapStore = useMapStore();
const map = computed(() => mapStore.get(LOCATOR_MAP_ID)?.map ?? null);

type Trip = { coordinates: LngLat[]; distanceMeters: number; durationSeconds: number };
type Hover = { id: string; from: "map" | "list" };
type Pending = "route" | "reach";
type MapPointerEvent = { features?: Array<{ properties?: Record<string, unknown> | null }> };

const copy = computed(() => LOCATOR_COPY[props.lang]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const router = computed(() => new Router({ key: props.apiKey, gateway: props.gateway }));
const bounds = shallowRef<LocatorBounds | null>(null);
const origin = shallowRef<LocatorOrigin | null>(null);
const selected = ref<string | null>(null);
const hover = shallowRef<Hover | null>(null);
const reach = shallowRef<LocatorReach | null>(null);
const trip = shallowRef<Trip | null>(null);
const pending = ref<Pending | null>(null);
const error = shallowRef<{ message: string; retry: Pending } | null>(null);
const expanded = ref(false);
const announcement = ref("");
// The reader's weekday, read after mount: a server in another timezone (or on another day) would
// render different hours than the browser hydrates, so the first pass shows none.
const day = ref<number | null>(null);
const panel = useTemplateRef<HTMLElement>("panel");
const scroller = useTemplateRef<HTMLElement>("scroller");
const listId = useId();
const hintId = useId();
let inFlight: { controller: AbortController; kind: Pending } | null = null;

/** The route on the map, drawing in. Its own component so the draw-in's frames re-render the line alone, not the panel and its list. */
const DrawnRoute = defineComponent({
  props: {
    line: { type: Object as PropType<Trip>, required: true },
  },
  setup(route) {
    const progress = ref(1);
    let frame = 0;
    const cancel = () => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    };
    // A new route draws in from its start; under reduced motion it appears whole.
    watch(
      () => route.line,
      () => {
        cancel();
        if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
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
      h(UnmapRouteLine, { mapId: LOCATOR_MAP_ID, id: LOCATOR_LAYERS.route, coordinates: route.line.coordinates, progress: progress.value });
  },
});

// The list follows the view: read the bounds now and after every move.
watch(
  map,
  (current, _previous, onCleanup) => {
    if (!current) return;
    const update = () => {
      bounds.value = boundsOf(current);
    };
    update();
    current.on("moveend", update);
    onCleanup(() => current.off("moveend", update));
  },
  { immediate: true },
);

// The store under the pointer lights its row.
watch(
  map,
  (current, _previous, onCleanup) => {
    if (!current) return;
    const move = (event: MapPointerEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (id === undefined || id === null) return;
      if (hover.value?.from === "map" && hover.value.id === String(id)) return;
      hover.value = { id: String(id), from: "map" };
    };
    const leave = () => {
      if (hover.value?.from === "map") hover.value = null;
    };
    current.on("mousemove", LOCATOR_LAYERS.points, move as never);
    current.on("mouseleave", LOCATOR_LAYERS.points, leave as never);
    onCleanup(() => {
      current.off("mousemove", LOCATOR_LAYERS.points, move as never);
      current.off("mouseleave", LOCATOR_LAYERS.points, leave as never);
    });
  },
  { immediate: true },
);

onMounted(() => {
  day.value = new Date().getDay();
});

// A row lit from the map scrolls into the list's view. Only the list scrolls: the panel and the
// page stay where the reader has them.
watch(
  hover,
  (current) => {
    const view = scroller.value;
    if (current?.from !== "map" || !view) return;
    const row = [...view.querySelectorAll<HTMLElement>("[data-store-id]")].find(
      (element) => element.getAttribute("data-store-id") === current.id,
    );
    if (!row) return;
    const top = listScrollTop(view, row);
    if (top !== view.scrollTop) view.scrollTop = top;
  },
  { flush: "post" },
);

function padding(): LocatorPadding {
  const container = map.value?.getContainer();
  if (!container) return panelPadding({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }, null);
  return panelPadding(container.getBoundingClientRect(), panel.value?.getBoundingClientRect() ?? null);
}
const duration = () => (prefersReducedMotion() ? 0 : CAMERA_MS);

// Search pulls the map: the searched place and its nearest stores, clear of the panel. This runs
// after the geocoder's own fly to the result, and takes over from it.
watch(origin, (current) => {
  const live = map.value;
  if (!live || !current) return;
  const nearest = visibleStores(props.stores, { bounds: null, origin: current, lang: props.lang }).slice(0, NEAREST_FRAMED);
  const points: [number, number][] = [[current.lng, current.lat], ...nearest.map((row) => row.feature.geometry.coordinates)];
  live.fitBounds(pointsBounds(points), { padding: padding(), maxZoom: 14, duration: duration() });
});

onScopeDispose(() => {
  inFlight?.controller.abort();
  inFlight = null;
});

const rows = computed(() => visibleStores(props.stores, { bounds: bounds.value, origin: origin.value, lang: props.lang }));
const store = computed(() => props.stores.features.find((feature) => feature.properties.id === selected.value) ?? null);
const focus = computed(() => focusCollection(props.stores, [hover.value?.id, selected.value]));
const originLngLat = computed<[number, number] | null>(() => (origin.value ? [origin.value.lng, origin.value.lat] : null));
const credited = computed(() => props.stores === STORES);
const name = computed(() => (store.value ? storeName(store.value, props.lang) : ""));
const french = computed(() => props.lang === "fr");
const answer = computed(() => {
  const area = reach.value;
  const from = origin.value;
  if (!store.value || !area) return null;
  if (!from) return copy.value.reachArea(props.driveMinutes, name.value);
  return inReach([from.lng, from.lat], area)
    ? copy.value.reachInside(from.name, props.driveMinutes, name.value)
    : copy.value.reachOutside(from.name, props.driveMinutes, name.value);
});

function cancel() {
  inFlight?.controller.abort();
  inFlight = null;
  pending.value = null;
}

/** One request at a time: a new one aborts the last, and only the latest may set state. */
async function request<T>(kind: Pending, call: (signal: AbortSignal) => Promise<T>, done: (result: T) => void) {
  cancel();
  const current = { controller: new AbortController(), kind };
  inFlight = current;
  pending.value = kind;
  error.value = null;
  try {
    const result = await call(current.controller.signal);
    if (inFlight === current) done(result);
  } catch (caught) {
    if (inFlight === current && !isAbort(caught)) error.value = { message: requestError(caught, props.lang), retry: kind };
  } finally {
    if (inFlight === current) {
      inFlight = null;
      pending.value = null;
    }
  }
}

function choose(result: { name: string; lng: number; lat: number }) {
  // A new start makes a route stale; a halo round the store still holds.
  if (inFlight?.kind === "route") cancel();
  const next = { name: result.name, lng: result.lng, lat: result.lat };
  origin.value = next;
  trip.value = null;
  error.value = null;
  const nearest = visibleStores(props.stores, { bounds: null, origin: next, lang: props.lang })[0];
  announcement.value = nearest
    ? copy.value.announceNearest(next.name, storeName(nearest.feature, props.lang), formatDistance(nearest.distance!, props.lang))
    : "";
}

function select(id: string | null) {
  // Picking the store already picked keeps its route, halo and answers.
  if (id === selected.value) return;
  cancel();
  selected.value = id;
  trip.value = null;
  reach.value = null;
  error.value = null;
  const picked = id ? props.stores.features.find((feature) => feature.properties.id === id) : null;
  announcement.value = picked ? copy.value.announcePick(storeName(picked, props.lang)) : "";
}

function pick(feature: StoreFeature) {
  select(feature.properties.id);
  const live = map.value;
  live?.easeTo({
    center: feature.geometry.coordinates,
    zoom: Math.max(live.getZoom(), 13),
    offset: paddingOffset(padding()),
    duration: duration(),
  });
}

function showAll() {
  if (props.stores.features.length === 0) return;
  map.value?.fitBounds(pointsBounds(props.stores.features.map((feature) => feature.geometry.coordinates)), {
    padding: padding(),
    duration: duration(),
  });
}

function drawReach() {
  const at = store.value;
  if (!at) return;
  void request(
    "reach",
    (signal) => router.value.isochrone(at.geometry.coordinates, { minutes: [props.driveMinutes], mode: "auto", signal }),
    (collection) => {
      const area = collection as LocatorReach;
      reach.value = area;
      const frame = reachBounds(area);
      if (frame) map.value?.fitBounds(frame, { padding: padding(), duration: duration() });
    },
  );
}

function toggleReach() {
  if (reach.value) reach.value = null;
  else drawReach();
}

function directions() {
  const from = origin.value;
  const to = store.value;
  if (!from || !to) return;
  void request(
    "route",
    (signal) => router.value.route([from.lng, from.lat], to.geometry.coordinates, { mode: "auto", signal }),
    (result) => {
      trip.value = { coordinates: result.geometry.coordinates, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds };
      map.value?.fitBounds(pointsBounds(result.geometry.coordinates), { padding: padding(), duration: duration() });
    },
  );
}

function enterRow(id: string) {
  hover.value = { id, from: "list" };
}

function leaveRow() {
  if (hover.value?.from === "list") hover.value = null;
}
</script>

<template>
  <!-- Where the map would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="store-locator"
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
  <div v-else data-unmap-block="store-locator" :class="['relative h-full min-h-[480px]', props.class]">
    <UnmapMap
      :id="LOCATOR_MAP_ID"
      :api-key="props.apiKey"
      :gateway="props.gateway"
      :center="props.center"
      :zoom="props.zoom"
      :lang="props.lang"
      class="h-full"
    >
      <UnmapClusterLayer
        :map-id="LOCATOR_MAP_ID"
        :id="LOCATOR_LAYERS.stores"
        :data="props.stores"
        :interactive="true"
        @click="(event) => select(String(event.feature.properties.id))"
      />
      <UnmapGeojsonLayer
        v-if="reach"
        :map-id="LOCATOR_MAP_ID"
        :id="LOCATOR_LAYERS.reach"
        :data="reach"
        :fill-paint="REACH_FILL"
        :circle-paint="false"
      />
      <DrawnRoute v-if="trip" :line="trip" />
      <UnmapGeojsonLayer
        :map-id="LOCATOR_MAP_ID"
        :id="LOCATOR_LAYERS.focus"
        :data="focus"
        :fill-paint="false"
        :line-paint="false"
        :circle-paint="FOCUS_CIRCLE"
      />
      <!-- The picked store: your pin (in --primary) with its name. -->
      <UnmapMarker v-if="store" :key="store.properties.id" :map-id="LOCATOR_MAP_ID" :lng-lat="store.geometry.coordinates">
        <UnmapMarkerLabel>{{ name }}</UnmapMarkerLabel>
      </UnmapMarker>
      <!-- The searched place: a "you are here" dot in --foreground, so it never reads as a store. -->
      <UnmapMarker v-if="origin && originLngLat" :map-id="LOCATOR_MAP_ID" :lng-lat="originLngLat">
        <template #marker>
          <span class="block size-4 rounded-full border-[3px] border-background bg-foreground" />
        </template>
        <UnmapMarkerLabel>{{ origin.name }}</UnmapMarkerLabel>
      </UnmapMarker>
      <p data-testid="store-locator-announce" aria-live="polite" class="sr-only">{{ announcement }}</p>
      <!-- A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most half the map) that clears the attribution. -->
      <div
        ref="panel"
        class="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[22rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
      >
        <Card class="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle role="heading" aria-level="2">{{ copy.title }}</CardTitle>
            <CardDescription class="max-sm:hidden">{{ copy.intro }}</CardDescription>
          </CardHeader>
          <!-- The search, the picked store and the count stay put; only the list below them scrolls. On a phone the whole sheet scrolls. -->
          <CardContent class="flex min-h-0 flex-1 flex-col gap-4 max-sm:overflow-y-auto max-sm:overscroll-contain">
            <UnmapGeocoder
              :map-id="LOCATOR_MAP_ID"
              :api-key="props.apiKey"
              :gateway="props.gateway"
              :lang="props.lang"
              :placeholder="copy.search"
              proximity="map"
              :fly-to-zoom="13"
              @select="choose"
            />
            <section
              v-if="store"
              :key="store.properties.id"
              :aria-label="name"
              class="flex shrink-0 flex-col gap-3 border-y py-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex min-w-0 flex-col gap-1">
                  <p class="text-lg leading-tight font-semibold">{{ name }}</p>
                  <p class="text-sm text-muted-foreground">{{ store.properties.address }}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" :aria-label="copy.close" @click="select(null)">
                  <span aria-hidden="true">×</span>
                </Button>
              </div>
              <p v-if="day !== null" class="text-sm">{{ todayLine(store, day, props.lang) }}</p>
              <div class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  :disabled="!origin || pending !== null"
                  :aria-describedby="origin ? undefined : hintId"
                  @click="directions"
                >
                  {{ copy.directions }}
                </Button>
                <Button type="button" variant="outline" :aria-pressed="reach !== null" :disabled="pending !== null" @click="toggleReach">
                  {{ copy.reach(props.driveMinutes) }}
                </Button>
              </div>
              <!-- Where the answers land, always there, so nothing jumps when one arrives. -->
              <div data-testid="store-locator-answer" aria-live="polite" class="flex min-h-10 flex-col justify-center gap-2">
                <p v-if="!origin" :id="hintId" class="text-xs text-muted-foreground">{{ copy.needOrigin }}</p>
                <p v-if="pending" class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> {{ pending === "route" ? copy.loadingRoute : copy.loadingReach }}
                </p>
                <p v-if="trip" data-testid="store-locator-trip" class="flex items-baseline gap-2">
                  <span class="text-2xl font-semibold tabular-nums">{{ formatDuration(trip.durationSeconds, props.lang) }}</span> <span class="text-sm text-muted-foreground tabular-nums">{{ `${formatDistance(trip.distanceMeters, props.lang)} ${copy.byCar}` }}</span>
                </p>
                <p v-if="answer" class="text-sm">{{ answer }}</p>
                <Alert v-if="error" variant="destructive" role="alert">
                  <AlertDescription class="flex flex-col items-start gap-2">
                    <span>{{ error.message }}</span>
                    <Button type="button" variant="outline" size="sm" @click="error.retry === 'route' ? directions() : drawReach()">
                      {{ copy.retry }}
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            </section>
            <div class="flex shrink-0 items-center gap-2">
              <p data-testid="store-locator-count" class="flex min-w-0 flex-1 items-baseline gap-2">
                <span :class="store ? 'text-base font-semibold tabular-nums' : 'text-2xl font-semibold tabular-nums'">{{ rows.length }}</span> <span class="text-sm text-muted-foreground">{{ copy.count(rows.length) }}</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="sm:hidden"
                :aria-expanded="expanded"
                :aria-controls="listId"
                @click="expanded = !expanded"
              >
                {{ expanded ? copy.hideList : copy.showList }}
              </Button>
            </div>
            <div :id="listId" :data-expanded="expanded" class="flex min-h-0 flex-1 flex-col max-sm:flex-none max-sm:data-[expanded=false]:hidden">
              <div ref="scroller" data-store-locator-scroll="" class="relative -mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 max-sm:flex-none max-sm:overflow-visible">
                <div v-if="rows.length === 0" class="flex flex-col items-start gap-2">
                  <p class="text-sm text-muted-foreground">{{ copy.empty }}</p>
                  <Button type="button" variant="outline" size="sm" @click="showAll">{{ copy.allStores }}</Button>
                </div>
                <ul v-else :aria-label="copy.list" class="flex flex-col gap-0.5">
                  <li v-for="row in rows.slice(0, LIST_LIMIT)" :key="row.feature.properties.id">
                    <Button
                      type="button"
                      :variant="row.feature.properties.id === selected ? 'secondary' : 'ghost'"
                      :aria-pressed="row.feature.properties.id === selected"
                      :data-store-id="row.feature.properties.id"
                      :data-hovered="hover?.id === row.feature.properties.id ? 'true' : undefined"
                      class="h-auto w-full justify-between gap-3 py-2 text-left whitespace-normal transition-colors hover:bg-muted focus-visible:bg-muted data-[hovered=true]:bg-muted"
                      @click="pick(row.feature)"
                      @mouseenter="enterRow(row.feature.properties.id)"
                      @mouseleave="leaveRow"
                      @focus="enterRow(row.feature.properties.id)"
                      @blur="leaveRow"
                    >
                      <span class="flex min-w-0 flex-col items-start gap-0.5">
                        <span :class="row.feature.properties.id === selected ? 'flex items-center gap-1.5 font-semibold' : 'flex items-center gap-1.5 font-medium'">
                          <!-- Picked is shown by weight and a mark, not by colour alone. -->
                          <span v-if="row.feature.properties.id === selected" aria-hidden="true" data-selected-mark="">✓</span>
                          {{ storeName(row.feature, props.lang) }}
                        </span>
                        <span class="min-h-4 text-xs font-normal text-muted-foreground">{{ day === null ? "" : todayLine(row.feature, day, props.lang) }}</span>
                      </span>
                      <span v-if="row.distance !== null" class="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                        {{ formatDistance(row.distance, props.lang) }}
                      </span>
                    </Button>
                  </li>
                </ul>
                <p v-if="rows.length > LIST_LIMIT" class="py-2 text-xs text-muted-foreground">{{ copy.capped(LIST_LIMIT) }}</p>
              </div>
            </div>
            <div data-testid="store-locator-credits" class="flex shrink-0 flex-col gap-1 text-xs text-muted-foreground">
              <p v-if="credited">
                {{ copy.source }}
                <a class="underline underline-offset-2" :href="STORES_SOURCE.url" target="_blank" rel="noreferrer">{{ french ? STORES_SOURCE.name_fr : STORES_SOURCE.name }}</a>.
                <a class="underline underline-offset-2" :href="STORES_SOURCE.licenceUrl" target="_blank" rel="noreferrer">{{ french ? STORES_SOURCE.licence_fr : STORES_SOURCE.licence }}</a>
              </p>
              <p>
                {{ copy.routesCredit }}
                <a class="underline underline-offset-2" :href="ROUTING_CREDIT.sourceUrl" target="_blank" rel="noreferrer">{{ copy.osm }}</a>,
                <a class="underline underline-offset-2" :href="ROUTING_CREDIT.licenceUrl" target="_blank" rel="noreferrer">{{ copy.odbl }}</a>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </UnmapMap>
  </div>
</template>
