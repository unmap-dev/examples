<script lang="ts">
// --- delivery-tracker helpers (kept identical across both lanes) ---
export type TrackerLang = "en" | "fr";

/** Where the trip is: on the way, almost there, or delivered. */
export type TrackerStage = "way" | "soon" | "done";

export interface TrackerStop {
  id: string;
  name: string;
  name_fr: string;
  address: string;
  lngLat: [number, number];
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface TrackerRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as fitBounds takes it. */
export interface TrackerPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Ottawa Public Library branches, from the City of Ottawa open data item "Library Locations and
 * Hours (Ottawa Public Libraries) API" (d64cd889fa7d4852845d9d9e208fe1ea), retrieved 2026-09-29.
 * The Main branch is the depot; five nearby branches are the drop-offs.
 */
export const DEPOT: TrackerStop = {
  id: "main",
  name: "Main",
  name_fr: "Centrale",
  address: "120 Metcalfe, Ottawa, ON K1P 5M2",
  lngLat: [-75.695396, 45.4203],
};

export const DROP_OFFS: TrackerStop[] = [
  { id: "rideau", name: "Rideau", name_fr: "Rideau", address: "377 Rideau, Ottawa, ON K1N 5Y6", lngLat: [-75.683098, 45.430099] },
  { id: "sunnyside", name: "Sunnyside", name_fr: "Sunnyside", address: "1049 Bank, Ottawa, ON K1S 3W9", lngLat: [-75.683899, 45.3955] },
  { id: "rosemount", name: "Rosemount", name_fr: "Rosemount", address: "18 Rosemount, Ottawa, ON K1Y 1P4", lngLat: [-75.726315, 45.401637] },
  { id: "st-laurent", name: "St-Laurent", name_fr: "St-Laurent", address: "515 Côté, Ottawa, ON K1K 0Z8", lngLat: [-75.647903, 45.436199] },
  { id: "vanier", name: "Vanier", name_fr: "Vanier", address: "310 Pères Blancs, Ottawa, ON K1L 7L5", lngLat: [-75.6604, 45.444302] },
];

/** Who the stops come from, and the licence's own credit sentence (its name stays English in French). */
export const STOPS_CREDIT = {
  name: "Ottawa Public Library branches, City of Ottawa open data",
  name_fr: "Succursales de la Bibliothèque publique d'Ottawa, données ouvertes de la Ville d'Ottawa",
  url: "https://open.ottawa.ca/datasets/d64cd889fa7d4852845d9d9e208fe1ea",
  licence: "Contains information licensed under the Open Government Licence – City of Ottawa.",
  licence_fr: "Contient de l'information visée par l'Open Government Licence – City of Ottawa.",
  licenceUrl: "https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data/open-data-licence-version-20",
};

/** Who the route comes from, and the licence it carries. */
export const ROUTING_CREDIT = {
  sourceUrl: "https://www.openstreetmap.org/copyright",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/",
};

/** How often the courier moves, in milliseconds. */
export const TICK_MS = 100;
/** Inside this many seconds of the drop-off, the trip is almost there. */
export const SOON_SECONDS = 120;
/** The playback speed when none is given, and the least one accepted: trip seconds per real second. */
export const DEFAULT_SPEED = 30;
export const MIN_SPEED = 1;

/** Downtown Ottawa. */
export const DOWNTOWN_OTTAWA: [number, number] = [-75.69, 45.42];

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const TRACKER_MAP_ID = "delivery-tracker";
/** The route's source id and layer-id prefix. */
export const TRACKER_ROUTE_ID = "delivery-tracker-route";

/** The panel's inset from the map edge, and the gutter the camera keeps. */
export const GUTTER = 24;
/** The gutter a framed route keeps: room for the names beside the pins. */
export const FRAME_GUTTER = 48;
/** Camera moves, in milliseconds. Reduced motion jumps. */
export const CAMERA_MS = 800;
/** The closest a route is framed. */
export const ROUTE_MAX_ZOOM = 15;
/** The least map, in pixels, a padded camera must have before it tightens its gutter. */
const MIN_FRAME = 120;
/** The tightened gutter, and the least strip the camera keeps to frame in beside a tall panel. */
const TIGHT = 8;
const MIN_STRIP = 32;
/** How far the default pin stands above its point, in pixels. */
const PIN_ROOM = 40;

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

export const TRACKER_COPY = {
  en: {
    title: "Track a delivery",
    from: (depot: string) => `From ${depot}`,
    empty: "Pick a branch, then start the delivery.",
    dropOff: "Deliver to",
    start: "Start delivery",
    restart: "Restart",
    loading: "Finding the route...",
    arrival: "Arrival",
    arrivesAt: "Arrives at",
    deliveredAt: "Delivered at",
    left: (minutes: number) => `${minutes} min left`,
    soon: "Less than a minute left",
    toGo: (distance: string) => `${distance} to go`,
    progress: "Delivery progress",
    departs: (depot: string) => `Departs ${depot}`,
    departed: (depot: string) => `Departed ${depot}`,
    onTheWay: "On the way",
    almost: "Almost there",
    at: (stop: string) => `At ${stop}`,
    stepDone: "(done)",
    courier: "Your parcel",
    replay: (speed: number) => `Played back at ${speed}×.`,
    replayHow: "One route request per branch; the courier replays its geometry.",
    announceStart: (stop: string, time: string, left: string) => `Delivery to ${stop} started. Arrives at ${time}, ${left}.`,
    announceSoon: (stop: string, left: string) => `Almost at ${stop}: ${left}.`,
    announceDone: (stop: string, time: string) => `Delivered to ${stop} at ${time}.`,
    fold: "Hide details",
    unfold: "Show details",
    retry: "Try again",
    stopsCredit: "Branches:",
    routesCredit: "Routes:",
    osm: "OpenStreetMap contributors",
    odbl: "ODbL",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
    outside: "That trip leaves Canada. Routing covers Canada.",
    noRoute: "No road connects those places.",
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The API key was refused. Check it and try again.",
    unavailable: "The service didn't answer. Try again in a moment.",
    failed: "The request failed. Try again.",
  },
  fr: {
    title: "Suivre une livraison",
    from: (depot: string) => `Depuis ${depot}`,
    empty: "Choisissez une succursale, puis lancez la livraison.",
    dropOff: "Livrer à",
    start: "Lancer la livraison",
    restart: "Recommencer",
    loading: "Calcul de l'itinéraire...",
    arrival: "Arrivée",
    arrivesAt: "Arrivée prévue à",
    deliveredAt: "Livré à",
    left: (minutes: number) => `${minutes} min restantes`,
    soon: "Moins d'une minute",
    toGo: (distance: string) => `${distance} à parcourir`,
    progress: "Progression de la livraison",
    departs: (depot: string) => `Départ de ${depot}`,
    departed: (depot: string) => `Départ de ${depot}`,
    onTheWay: "En route",
    almost: "Arrivée imminente",
    at: (stop: string) => `À ${stop}`,
    stepDone: "(terminé)",
    courier: "Votre colis",
    replay: (speed: number) => `Relecture à ${speed}×.`,
    replayHow: "Une requête d'itinéraire par succursale ; le livreur en rejoue le tracé.",
    announceStart: (stop: string, time: string, left: string) => `Livraison vers ${stop} lancée. Arrivée prévue à ${time}, ${left}.`,
    announceSoon: (stop: string, left: string) => `Presque à ${stop} : ${left}.`,
    announceDone: (stop: string, time: string) => `Livré à ${stop} à ${time}.`,
    fold: "Masquer les détails",
    unfold: "Afficher les détails",
    retry: "Réessayer",
    stopsCredit: "Succursales :",
    routesCredit: "Itinéraires :",
    osm: "contributeurs d'OpenStreetMap",
    odbl: "ODbL",
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
    outside: "Ce trajet sort du Canada. Les itinéraires couvrent le Canada.",
    noRoute: "Aucune route ne relie ces lieux.",
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La clé API a été refusée. Vérifiez-la et réessayez.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    failed: "La requête a échoué. Réessayez.",
  },
};

export function stopName(stop: TrackerStop, lang: TrackerLang): string {
  return lang === "fr" ? stop.name_fr : stop.name;
}

const EARTH_RADIUS_M = 6_371_008.8;

function haversineMetres(a: [number, number], b: [number, number]): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLength(coordinates: [number, number][]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index++) total += haversineMetres(coordinates[index - 1]!, coordinates[index]!);
  return total;
}

/** The point `fraction` (0 to 1) of the way along the line, by distance. */
export function pointAt(coordinates: [number, number][], fraction: number): [number, number] {
  const first = coordinates[0]!;
  const last = coordinates[coordinates.length - 1]!;
  if (coordinates.length < 2 || fraction <= 0) return first;
  if (fraction >= 1) return last;
  const target = lineLength(coordinates) * fraction;
  let travelled = 0;
  for (let index = 1; index < coordinates.length; index++) {
    const a = coordinates[index - 1]!;
    const b = coordinates[index]!;
    const step = haversineMetres(a, b);
    if (step > 0 && travelled + step >= target) {
      const t = (target - travelled) / step;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    travelled += step;
  }
  return last;
}

/** "14:10" (fr: "14 h 10"), in the reader's time zone. Call it only in the browser, never while rendering on the server. */
export function formatClock(time: number, lang: TrackerLang): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time);
}

export function formatRemaining(seconds: number, lang: TrackerLang): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? TRACKER_COPY[lang].soon : TRACKER_COPY[lang].left(minutes);
}

/** "900 m", "1.8 km" (fr: "1,8 km"). */
export function formatDistance(metres: number, lang: TrackerLang): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${km.format(metres / 1000)} km`;
}

/** Where the trip is, from the travelled fraction and the trip's length in seconds. */
export function trackerStage(progress: number, durationSeconds: number): TrackerStage {
  if (progress >= 1) return "done";
  return durationSeconds * (1 - progress) <= SOON_SECONDS ? "soon" : "way";
}

/**
 * The fraction the map and the card show. Under reduced motion it moves a whole trip minute at a
 * time, so the courier jumps from place to place and the line fills in steps, never gliding.
 */
export function shownProgress(progress: number, durationSeconds: number, reduced: boolean): number {
  if (!reduced || progress >= 1) return progress;
  return (Math.floor((progress * durationSeconds) / 60) * 60) / durationSeconds;
}

/** [[west, south], [east, north]] around a line, for fitBounds. A loop: spreading a long route into Math.min overflows the stack. */
export function lineBounds(coordinates: [number, number][]): [[number, number], [number, number]] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of coordinates) {
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

/** Every branch the block knows, framed when the map opens. */
export const STOPS_BOUNDS = lineBounds([DEPOT, ...DROP_OFFS].map((stop) => stop.lngLat));

/**
 * Camera padding that keeps what the camera frames clear of the floating panel: its width on the
 * left when it floats beside the map, its height at the bottom when it is a sheet across it. An
 * even gutter when nothing is measured. When the full gutter would leave too little map (a tall
 * sheet on a small phone), the gutter tightens and the frame stays in the strip the panel leaves,
 * never behind the panel.
 */
export function panelPadding(map: TrackerRect, panel: TrackerRect | null, gutter = GUTTER): TrackerPadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const cover = Math.round(sheet ? map.bottom - panel.top : panel.right - map.left);
  const size = sheet ? map.height : map.width;
  if (size - 2 * gutter - cover >= MIN_FRAME) return sheet ? { ...even, bottom: cover + gutter } : { ...even, left: cover + gutter };
  const near = Math.min(cover + TIGHT, size - TIGHT - MIN_STRIP);
  return sheet ? { ...even, top: TIGHT, bottom: near } : { ...even, left: near, right: TIGHT };
}

/** Which side of a pin its name sits: toward the other end, so a framed trip keeps both names inside the frame. */
export function labelSide(stop: TrackerStop, other: TrackerStop): "left" | "right" {
  return stop.lngLat[0] <= other.lngLat[0] ? "right" : "left";
}

/**
 * Room above a framed route for the drop-off pin, which stands above its point: added to the top
 * padding when the map has it to spare, so the pin's head never sits under the edge or a control.
 */
export function withPinRoom(padding: TrackerPadding, mapHeight: number): TrackerPadding {
  const spare = mapHeight - padding.top - padding.bottom - MIN_STRIP;
  return { ...padding, top: padding.top + Math.max(0, Math.min(PIN_ROOM, spare)) };
}

/**
 * What to tell the reader about a failed request: the place, the key or the rate when the gateway
 * says so; a service that did not answer for a 5xx or a request that never got an HTTP answer.
 */
export function requestError(caught: unknown, lang: TrackerLang): string {
  const copy = TRACKER_COPY[lang];
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

/** True when the reader asked for less motion: the camera jumps and the courier moves in steps. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** The playback speed to use: the one given, never below MIN_SPEED; the default when it is not a number. */
export function playbackSpeed(speed: number): number {
  return Number.isFinite(speed) ? Math.max(MIN_SPEED, speed) : DEFAULT_SPEED;
}

/** Plays a trip on wall time: how many trip seconds are behind the parcel, whatever the timer's cadence. */
export interface TripClock {
  /** Trip seconds played so far. The same value between ticks, so it is safe as a store snapshot. */
  get(): number;
  /** Called on every tick while the trip plays, and when it starts, stops or finishes. */
  subscribe(listener: () => void): () => void;
  /** Plays a trip of `totalSeconds` from its start at `speed` trip seconds per real second. */
  run(totalSeconds: number, speed: number): void;
  /** Carries on from where the trip is, at a new speed. */
  setSpeed(speed: number): void;
  /** Freezes the trip where it is and lets go of the timer. */
  stop(): void;
}

/**
 * One timer for the whole block, ticking every TICK_MS while a trip plays. The time played is
 * worked out from the clock, not from the ticks, so a slow tab never slows the parcel. While the
 * page is hidden the trip pauses and the timer stops; it resumes where it was when the page is
 * seen again. Framework-free: React reads it through useSyncExternalStore, Vue through a ref.
 */
export function createTripClock(now: () => number = () => performance.now()): TripClock {
  const listeners = new Set<() => void>();
  let total = 0;
  let speed = MIN_SPEED;
  // Trip seconds banked before `since`, and whether the clock is running from `since`.
  let banked = 0;
  let since = 0;
  let running = false;
  // A trip is on: running, or paused while the page is hidden.
  let playing = false;
  let snapshot = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const played = () => Math.min(total, banked + (running ? ((now() - since) / 1000) * speed : 0));
  const emit = () => {
    snapshot = played();
    listeners.forEach((listener) => listener());
  };
  const halt = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
  const pause = () => {
    banked = played();
    running = false;
    halt();
  };
  const resume = () => {
    since = now();
    running = true;
    halt();
    timer = setInterval(tick, TICK_MS);
  };
  const onVisibility = () => {
    if (!playing) return;
    if (hidden()) pause();
    else if (!running) resume();
    emit();
  };
  const listen = (on: boolean) => {
    if (typeof document === "undefined") return;
    if (on) document.addEventListener("visibilitychange", onVisibility);
    else document.removeEventListener("visibilitychange", onVisibility);
  };
  const stop = () => {
    pause();
    playing = false;
    listen(false);
  };
  function tick() {
    emit();
    if (snapshot >= total) stop();
  }
  return {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    run(totalSeconds, nextSpeed) {
      stop();
      total = Math.max(0, totalSeconds);
      speed = playbackSpeed(nextSpeed);
      banked = 0;
      playing = true;
      listen(true);
      if (hidden()) running = false;
      else resume();
      emit();
    },
    setSpeed(nextSpeed) {
      banked = played();
      since = now();
      speed = playbackSpeed(nextSpeed);
    },
    stop() {
      stop();
      emit();
    },
  };
}

/** "10 min left" as the middle of a sentence: "10 min left", "less than a minute left". */
export function midSentence(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
// --- end delivery-tracker helpers ---
</script>

<script setup lang="ts">
/**
 * <UnmapDeliveryTracker> - a delivery-tracking page in one component, for Vue and Nuxt. A
 * full-bleed map with a living arrival card floating on it (a bottom sheet on a phone): pick a
 * branch, start the delivery, and the route fills in behind a courier moving along it while the
 * card counts down to the arrival time and ticks off each stage of the trip.
 *
 * Composes the registry's map, route-line and marker-popup items on your shadcn-vue Card,
 * ToggleGroup, Button, Alert and Spinner, in your tokens. "Start delivery" calls /route once per
 * branch; the courier is then played back along the route's own geometry at `speed` times real
 * time, and a restart replays the route it already has. Swap the playback for your fleet's live
 * positions to track real couriers.
 *
 * The depot and drop-offs are Ottawa Public Library branches (City of Ottawa open data, credited).
 * Installed by `npx shadcn-vue add` with its page at app/pages/delivery-tracker.vue. Edit freely.
 */
import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
  type HTMLAttributes,
} from "vue";
import { Router } from "@unmap/routing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    /** Playback speed: trip seconds per real second, at least 1. Defaults to 30, so a ten-minute trip plays in twenty seconds. */
    speed?: number;
    /** Language of the copy, the times and the stop names. Defaults to "en". */
    lang?: TrackerLang;
    class?: HTMLAttributes["class"];
  }>(),
  { speed: DEFAULT_SPEED, lang: "en" },
);

// Vue's inject reads only a component's ancestors, so `useMap()` here could not see the map this
// component renders. It resolves the store that map registers in instead (an outer one if there
// is one, else one it provides to it), the way compare-swipe does.
const mapStore = useMapStore();
const map = computed(() => mapStore.get(TRACKER_MAP_ID)?.map ?? null);

/** A route as /route answered it, kept per branch so a restart replays it without asking again. */
type Answer = { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number };
/** A delivery on its way: the route, when it left and where it goes. */
type Delivery = Answer & { startedAt: number; stop: TrackerStop };
type Step = { key: string; label: string; time: string; state: "done" | "current" | "upcoming" };

const copy = computed(() => TRACKER_COPY[props.lang]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const speed = computed(() => playbackSpeed(props.speed));
const router = computed(() => new Router({ key: props.apiKey, gateway: props.gateway }));
// Each branch's route, asked once per key: a restart replays it rather than paying for it again.
let routes = new Map<string, Answer>();
watch(router, () => {
  routes = new Map();
});
// One timer for the whole block; the time played is wall time, and it pauses while the page is hidden.
const clock = createTripClock();
const played = shallowRef(0);
const unsubscribe = clock.subscribe(() => {
  played.value = clock.get();
});
const stopId = ref(DROP_OFFS[0]!.id);
const hoveredId = ref<string | null>(null);
const delivery = shallowRef<Delivery | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
// One polite sentence per stage of the trip, never one per tick.
const said = ref("");
// On a phone the sheet can fold to the headline, to give the map back.
const folded = ref(false);
const panel = useTemplateRef<HTMLElement>("panel");
const action = useTemplateRef<ComponentPublicInstance>("action");
const bodyId = useId();
const addressIds = useId();
let abort: AbortController | null = null;
let announcedFor: { delivery: Delivery | null; stage: TrackerStage | null } = { delivery: null, stage: null };

const picked = computed(() => DROP_OFFS.find((stop) => stop.id === stopId.value) ?? DROP_OFFS[0]!);
const target = computed(() => delivery.value?.stop ?? picked.value);
const progress = computed(() => {
  const current = delivery.value;
  if (!current) return 0;
  return shownProgress(Math.min(1, played.value / current.durationSeconds), current.durationSeconds, prefersReducedMotion());
});
const stage = computed<TrackerStage | null>(() => (delivery.value ? trackerStage(progress.value, delivery.value.durationSeconds) : null));
const done = computed(() => stage.value === "done");
const remaining = computed(() => (delivery.value ? delivery.value.durationSeconds * (1 - progress.value) : 0));
const courier = computed(() => (delivery.value && !done.value ? pointAt(delivery.value.coordinates, progress.value) : null));
const isFolded = computed(() => folded.value && delivery.value !== null);
// Clock text exists only once a delivery started, in the browser: the server render has none.
const arrival = computed(() => (delivery.value ? formatClock(delivery.value.startedAt + delivery.value.durationSeconds * 1000, props.lang) : ""));
const departure = computed(() => (delivery.value ? formatClock(delivery.value.startedAt, props.lang) : ""));
const depotSide = computed(() => labelSide(DEPOT, target.value));
const targetSide = computed(() => labelSide(target.value, DEPOT));
// The parcel's name trails behind it, on the side away from the depot's, so the two never meet as it leaves.
const courierSide = computed(() => (depotSide.value === "right" ? "left" : "right"));
// The stages are always there, so the card keeps its shape: before a delivery they preview the trip, none of them reached.
const steps = computed<Step[]>(() => {
  const current = delivery.value;
  const depot = stopName(DEPOT, props.lang);
  if (!current) {
    return [
      { key: "departed", label: copy.value.departs(depot), time: "", state: "upcoming" },
      { key: "way", label: copy.value.onTheWay, time: "", state: "upcoming" },
      { key: "soon", label: copy.value.almost, time: "", state: "upcoming" },
      { key: "at", label: copy.value.at(stopName(target.value, props.lang)), time: "", state: "upcoming" },
    ];
  }
  return [
    { key: "departed", label: copy.value.departed(depot), time: departure.value, state: "done" },
    { key: "way", label: copy.value.onTheWay, time: "", state: stage.value === "way" ? "current" : "done" },
    { key: "soon", label: copy.value.almost, time: "", state: stage.value === "soon" ? "current" : done.value ? "done" : "upcoming" },
    { key: "at", label: copy.value.at(stopName(current.stop, props.lang)), time: arrival.value, state: done.value ? "done" : "upcoming" },
  ];
});
const leftText = computed(() => formatRemaining(remaining.value, props.lang));
const toGoText = computed(() =>
  delivery.value ? `, ${copy.value.toGo(formatDistance(delivery.value.distanceMeters * (1 - progress.value), props.lang))}` : "",
);

function padding(gutter = GUTTER): TrackerPadding {
  const container = map.value?.getContainer();
  if (!container) return panelPadding({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }, null, gutter);
  return panelPadding(container.getBoundingClientRect(), panel.value?.getBoundingClientRect() ?? null, gutter);
}
const duration = () => (prefersReducedMotion() ? 0 : CAMERA_MS);
function frame(coordinates: [number, number][]) {
  const height = map.value?.getContainer().getBoundingClientRect().height ?? 0;
  map.value?.fitBounds(lineBounds(coordinates), { padding: withPinRoom(padding(FRAME_GUTTER), height), maxZoom: ROUTE_MAX_ZOOM, duration: duration() });
}

onScopeDispose(() => {
  abort?.abort();
  abort = null;
  unsubscribe();
  clock.stop();
});

watch(speed, (next) => clock.setSpeed(next));

// The map opens on every branch, clear of the panel.
watch(
  map,
  (live) => {
    if (!live) return;
    const height = live.getContainer().getBoundingClientRect().height;
    live.fitBounds(STOPS_BOUNDS, { padding: withPinRoom(padding(FRAME_GUTTER), height), maxZoom: ROUTE_MAX_ZOOM, duration: 0 });
  },
  { immediate: true, flush: "post" },
);

// A new route is framed once it is on screen, so the panel has its final size.
watch(
  delivery,
  (current) => {
    if (current) void nextTick(() => delivery.value === current && frame(current.coordinates));
  },
  { flush: "post" },
);

// Folding or unfolding the sheet changes how much map there is: frame the route again.
watch(
  isFolded,
  () => {
    if (delivery.value) frame(delivery.value.coordinates);
  },
  { flush: "post" },
);

// Say when the delivery starts, when it is almost there, and when it lands; nothing in between.
watch([delivery, stage], ([current, now]) => {
  if (!current || !now) return;
  const before = announcedFor;
  if (before.delivery === current && before.stage === now) return;
  announcedFor = { delivery: current, stage: now };
  const name = stopName(current.stop, props.lang);
  const left = midSentence(formatRemaining(remaining.value, props.lang));
  if (now === "done") said.value = copy.value.announceDone(name, arrival.value);
  else if (before.delivery !== current) said.value = copy.value.announceStart(name, arrival.value, left);
  else if (now === "soon") said.value = copy.value.announceSoon(name, left);
});

function choose(value: unknown) {
  const next = DROP_OFFS.find((stop) => stop.id === value);
  if (next) stopId.value = next.id;
}

function unhover(id: string) {
  if (hoveredId.value === id) hoveredId.value = null;
}

/** Plays a route from its start: the clock first, so nothing reads the last trip's time against this one. */
function begin(stop: TrackerStop, answer: Answer) {
  clock.run(answer.durationSeconds, speed.value);
  delivery.value = { ...answer, startedAt: Date.now(), stop };
}

async function start() {
  abort?.abort();
  abort = null;
  const stop = picked.value;
  error.value = null;
  folded.value = false;
  const known = routes.get(stop.id);
  if (known) {
    loading.value = false;
    begin(stop, known);
    return;
  }
  const controller = new AbortController();
  abort = controller;
  // The running parcel stops where it is; its route and stages stay until the new route lands.
  clock.stop();
  loading.value = true;
  said.value = copy.value.loading;
  try {
    const result = await router.value.route(DEPOT.lngLat, stop.lngLat, { mode: "auto", signal: controller.signal });
    if (abort !== controller) return;
    const answer: Answer = {
      coordinates: result.geometry.coordinates as [number, number][],
      distanceMeters: result.distanceMeters,
      durationSeconds: Math.max(1, result.durationSeconds),
    };
    routes.set(stop.id, answer);
    begin(stop, answer);
  } catch (caught) {
    if (abort === controller && !isAbort(caught)) {
      error.value = requestError(caught, props.lang);
      said.value = "";
    }
  } finally {
    if (abort === controller) {
      abort = null;
      loading.value = false;
    }
  }
}

function act() {
  if (!loading.value) void start();
}

function retry() {
  // The alert goes away with the retry: focus lands on the action, which stays where it is.
  (action.value?.$el as HTMLElement | undefined)?.focus();
  void start();
}
</script>

<template>
  <!-- Where the map would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="delivery-tracker"
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
  <div v-else data-unmap-block="delivery-tracker" :class="['relative h-full min-h-[480px]', props.class]">
    <UnmapMap :id="TRACKER_MAP_ID" :api-key="props.apiKey" :gateway="props.gateway" :center="DOWNTOWN_OTTAWA" :zoom="13" :lang="props.lang" class="h-full">
      <UnmapRouteLine v-if="delivery" :map-id="TRACKER_MAP_ID" :id="TRACKER_ROUTE_ID" :coordinates="delivery.coordinates" :progress="progress" />
      <!-- The depot: a dot in --foreground. The drop-off: your pin in --primary. The other branches: quiet rings. Each named where it matters. -->
      <UnmapMarker :map-id="TRACKER_MAP_ID" :lng-lat="DEPOT.lngLat">
        <template #marker>
          <span class="block size-4 rounded-full border-[3px] border-background bg-foreground" />
        </template>
        <UnmapMarkerLabel :position="depotSide">{{ stopName(DEPOT, props.lang) }}</UnmapMarkerLabel>
      </UnmapMarker>
      <template v-for="stop in DROP_OFFS" :key="stop.id">
        <UnmapMarker v-if="stop.id === target.id" :key="`${stop.id}:target`" :map-id="TRACKER_MAP_ID" :lng-lat="stop.lngLat" @click="choose(stop.id)">
          <UnmapMarkerLabel :position="targetSide">{{ stopName(stop, props.lang) }}</UnmapMarkerLabel>
        </UnmapMarker>
        <UnmapMarker v-else :key="`${stop.id}:ring`" :map-id="TRACKER_MAP_ID" :lng-lat="stop.lngLat" @click="choose(stop.id)">
          <template #marker>
            <!-- Hovering the ring lights its row in the list, as hovering the row names the ring. -->
            <span
              :data-lit="stop.id === picked.id || stop.id === hoveredId"
              class="block size-3 rounded-full border-2 border-muted-foreground bg-background transition-transform data-[lit=true]:scale-125 data-[lit=true]:border-primary"
              @pointerenter="hoveredId = stop.id"
              @pointerleave="unhover(stop.id)"
            />
          </template>
          <UnmapMarkerLabel v-if="stop.id === picked.id || stop.id === hoveredId" position="right">{{ stopName(stop, props.lang) }}</UnmapMarkerLabel>
        </UnmapMarker>
      </template>
      <UnmapMarker v-if="courier" :map-id="TRACKER_MAP_ID" :lng-lat="courier">
        <template #marker>
          <span class="relative flex size-6 items-center justify-center">
            <span aria-hidden="true" class="absolute inset-0 rounded-full bg-primary/25 motion-safe:animate-ping" />
            <span class="relative size-3.5 rounded-full border-2 border-background bg-primary" />
          </span>
        </template>
        <UnmapMarkerLabel :position="courierSide">{{ copy.courier }}</UnmapMarkerLabel>
      </UnmapMarker>
      <p data-testid="tracker-announce" aria-live="polite" aria-atomic="true" class="sr-only">{{ said }}</p>
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
                v-if="delivery"
                type="button"
                variant="ghost"
                size="sm"
                class="shrink-0 sm:hidden"
                :aria-expanded="!isFolded"
                :aria-controls="bodyId"
                @click="folded = !folded"
              >
                {{ isFolded ? copy.unfold : copy.fold }}
              </Button>
            </div>
            <CardDescription :data-folded="isFolded" class="flex items-center gap-2 max-sm:data-[folded=true]:hidden">
              <span aria-hidden="true" class="size-3 shrink-0 rounded-full bg-foreground" />
              {{ copy.from(stopName(DEPOT, props.lang)) }}
              <span class="min-w-0 truncate">{{ `· ${DEPOT.address.split(",")[0]}` }}</span>
            </CardDescription>
          </CardHeader>
          <CardContent class="flex min-h-0 flex-1 flex-col gap-4">
            <!-- The headline: always there and tall enough for the answer, an error and its retry, so nothing jumps when it arrives. -->
            <div data-testid="tracker-answer" class="flex min-h-20 shrink-0 flex-col justify-center gap-2">
              <Alert v-if="error" variant="destructive" role="alert">
                <AlertDescription class="flex flex-row flex-wrap items-center justify-between gap-2">
                  <span class="min-w-0">{{ error }}</span>
                  <Button type="button" variant="outline" size="sm" class="shrink-0" @click="retry">{{ copy.retry }}</Button>
                </AlertDescription>
              </Alert>
              <p v-else-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> <span>{{ copy.loading }}</span>
              </p>
              <section v-else-if="delivery" :aria-label="copy.arrival" class="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
                <div class="flex items-baseline gap-2">
                  <span v-if="done" aria-hidden="true" class="text-2xl leading-none text-primary">✓</span>
                  <p data-testid="tracker-eta" class="flex items-baseline gap-2">
                    <span class="text-sm text-muted-foreground">{{ done ? copy.deliveredAt : copy.arrivesAt }}</span>{{ " " }}<span class="text-3xl leading-none font-semibold tracking-tight tabular-nums">{{ arrival }}</span>
                  </p>
                </div>
                <p data-testid="tracker-left" class="text-sm tabular-nums">
                  <span v-if="done" class="text-muted-foreground">{{ `${stopName(delivery.stop, props.lang)}, ${delivery.stop.address.split(",")[0]}` }}</span>
                  <template v-else><span class="font-medium">{{ leftText }}</span><span class="text-muted-foreground">{{ toGoText }}</span></template>
                </p>
                <!-- The line on the map, echoed: how much of the trip is behind the parcel. -->
                <div aria-hidden="true" class="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div class="h-full rounded-full bg-primary" :style="{ width: `${progress * 100}%` }" />
                </div>
              </section>
              <p v-else class="text-sm text-muted-foreground">{{ copy.empty }}</p>
            </div>
            <!-- Below the headline the branches, the trip's stages and the credits scroll; the action stays put. Every section is always there, so Start and Restart never move anything. -->
            <div
              :id="bodyId"
              data-testid="tracker-body"
              :data-folded="isFolded"
              class="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-2 max-sm:data-[folded=true]:hidden"
            >
              <!-- v-memo: the list re-renders when the pick, the hover or the language changes, never as the parcel moves. -->
              <ToggleGroup
                v-memo="[stopId, hoveredId, props.lang]"
                type="single"
                orientation="vertical"
                :aria-label="copy.dropOff"
                :model-value="stopId"
                class="w-full flex-col items-stretch"
                @update:model-value="choose"
              >
                <ToggleGroupItem
                  v-for="(stop, index) in DROP_OFFS"
                  :key="stop.id"
                  :value="stop.id"
                  :aria-describedby="`${addressIds}-${index}`"
                  :data-lit="hoveredId === stop.id"
                  class="h-auto w-full justify-start gap-3 py-2 text-left aria-pressed:font-semibold data-[state=on]:font-semibold data-[lit=true]:bg-muted"
                  @pointerenter="hoveredId = stop.id"
                  @pointerleave="unhover(stop.id)"
                  @focus="hoveredId = stop.id"
                  @blur="unhover(stop.id)"
                >
                  <!-- Picked is marked by a check as well as the fill, and matches the pin on the map. -->
                  <span
                    aria-hidden="true"
                    :data-on="stop.id === stopId"
                    class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-[0.625rem] leading-none data-[on=true]:border-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"
                  >
                    <template v-if="stop.id === stopId">✓</template>
                  </span>
                  <span class="min-w-0">{{ stopName(stop, props.lang) }}</span>{{ " " }}<span
                    :id="`${addressIds}-${index}`"
                    aria-hidden="true"
                    class="ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground"
                    >{{ stop.address.split(",")[0] }}</span
                  >
                </ToggleGroupItem>
              </ToggleGroup>
              <div data-testid="tracker-stages" class="flex flex-col gap-2 border-t pt-3">
                <ol :aria-label="copy.progress" class="flex flex-col">
                  <li
                    v-for="(step, index) in steps"
                    :key="step.key"
                    :data-state="step.state"
                    :aria-current="step.state === 'current' ? 'step' : undefined"
                    class="relative flex items-center gap-3 py-1 text-sm data-[state=upcoming]:text-muted-foreground data-[state=current]:font-medium"
                  >
                    <!-- The rail between stages, filled once the stage above it is behind the parcel. -->
                    <span
                      v-if="index < steps.length - 1"
                      aria-hidden="true"
                      :data-state="step.state"
                      class="absolute top-1/2 left-2 h-full -translate-x-1/2 border-l-2 border-dashed border-border data-[state=done]:border-solid data-[state=done]:border-primary"
                    />
                    <span
                      aria-hidden="true"
                      :data-state="step.state"
                      class="relative flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-[0.625rem] leading-none data-[state=current]:border-primary data-[state=done]:border-primary data-[state=done]:bg-primary data-[state=done]:text-primary-foreground"
                    >
                      <template v-if="step.state === 'done'">✓</template>
                      <span v-else-if="step.state === 'current'" class="size-1.5 rounded-full bg-primary" />
                    </span>
                    <span class="min-w-0 flex-1">
                      {{ step.label }}<span v-if="step.state === 'done'" class="sr-only"> {{ copy.stepDone }}</span>
                    </span>
                    <!-- Always rendered, so a time arriving never reflows the row. -->
                    <span class="min-w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{{ step.time }}</span>
                  </li>
                </ol>
                <p class="text-xs text-muted-foreground">{{ copy.replay(speed) }} {{ copy.replayHow }}</p>
              </div>
              <div v-memo="[props.lang]" data-testid="tracker-credits" class="flex flex-col gap-1 text-xs text-muted-foreground">
                <p>
                  {{ copy.stopsCredit }}
                  <a class="underline underline-offset-2" :href="STOPS_CREDIT.url" target="_blank" rel="noreferrer">{{
                    props.lang === "fr" ? STOPS_CREDIT.name_fr : STOPS_CREDIT.name
                  }}</a
                  >.
                  <a class="underline underline-offset-2" :href="STOPS_CREDIT.licenceUrl" target="_blank" rel="noreferrer">{{
                    props.lang === "fr" ? STOPS_CREDIT.licence_fr : STOPS_CREDIT.licence
                  }}</a>
                </p>
                <p>
                  {{ copy.routesCredit }}
                  <a class="underline underline-offset-2" :href="ROUTING_CREDIT.sourceUrl" target="_blank" rel="noreferrer">{{ copy.osm }}</a
                  >,
                  <a class="underline underline-offset-2" :href="ROUTING_CREDIT.licenceUrl" target="_blank" rel="noreferrer">{{ copy.odbl }}</a
                  >.
                </p>
              </div>
            </div>
            <!-- aria-disabled, not disabled, while routing: a disabled button would drop the reader's focus. -->
            <Button
              ref="action"
              type="button"
              data-testid="tracker-action"
              :aria-disabled="loading || undefined"
              :data-folded="isFolded"
              class="w-full shrink-0 aria-disabled:opacity-50 max-sm:data-[folded=true]:hidden"
              @click="act"
            >
              {{ delivery && delivery.stop.id === stopId ? copy.restart : copy.start }}
            </Button>
          </CardContent>
        </Card>
      </div>
    </UnmapMap>
  </div>
</template>
