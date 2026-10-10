/**
 * map-context - headless MapLibre lifecycle for Vue, wired to the unmap gateway.
 *
 * Owns the map instance so every other unmap component (UnmapMap, UnmapGeocoder,
 * UnmapRoutingPanel, UnmapMarker/UnmapPopup) can reach it through a composable instead of
 * prop-drilling. Supports more than one map on a page via an optional string id.
 *
 * - `useMapStore()`       resolves the shared store: an ancestor's (so sibling maps share one
 *                         registry) or a new one provided from the calling component.
 * - `useMapLifecycle()`   creates the map with `@unmap/maps` `createMap` once its container is
 *                         mounted, swaps the style in place when only the cartography changes,
 *                         and calls `map.remove()` on teardown.
 * - `useMap(id?)`         returns a computed MapLibre `Map` (null until it exists).
 * - `useMapReady(id?)`    true while a style is loaded; false before the first load and during a swap.
 * - `useMapGeneration()`  0 until the first load, then +1 per completed style load. Anything that
 *                         adds sources or layers re-adds them when this changes.
 * - `useResolvedMode()`   resolves `"auto"` to the page's light or dark mode, and follows it.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit it freely.
 */

import {
  computed,
  inject,
  provide,
  ref,
  shallowReactive,
  toValue,
  watch,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import {
  createMap,
  maplibregl,
  unmapStyle,
  type Map,
  type UnmapControlsOptions,
  type UnmapMapOptions,
} from "@unmap/maps";

/** A MapLibre projection, as `getProjection()` returns it. */
type ProjectionSpec = ReturnType<Map["getProjection"]>;

/** The default map id, used when a component does not pass one. */
export const DEFAULT_MAP_ID = "default";

export interface MapEntry {
  map: Map | null;
  /** True while a style is loaded. */
  ready: boolean;
  /** 0 until the first load, then +1 for every completed style load. */
  generation: number;
}

export interface MapStore {
  /** Register (or replace) the map instance for an id. */
  set: (id: string, entry: MapEntry) => void;
  /** Clear an entry only when it still refers to the supplied map. */
  clear: (id: string, map: Map) => void;
  /** Read the current entry for an id. Reactive: safe to call inside `computed`/`watch`. */
  get: (id: string) => MapEntry | undefined;
  /** The reactive entries, keyed by map id. */
  entries: Record<string, MapEntry>;
}

/** Injection key for the shared map store. */
export const MAP_STORE_KEY: InjectionKey<MapStore> = Symbol.for("unmap:map-store");

/** `"light"` or `"dark"`, or `"auto"` to follow the page. */
export type MapMode = "light" | "dark" | "auto";

/** The camera, as `onViewportChange` reports it. */
export interface MapViewport {
  /** [longitude, latitude]. */
  center: [number, number];
  zoom: number;
  /** Degrees clockwise from north. */
  bearing: number;
  /** Degrees from straight down. */
  pitch: number;
}

/**
 * The options the map lifecycle accepts. `apiKey` mirrors the React lane (where `key` is a
 * reserved prop); it is translated back to the SDK's `key` option when the map is created.
 */
export type MapProviderOptions = Omit<UnmapMapOptions, "container" | "key"> & {
  apiKey: string;
  /** Camera bearing in degrees, applied in place. */
  bearing?: number;
  /** Camera pitch in degrees, applied in place. */
  pitch?: number;
  /** Fires as the camera moves, except for moves these options caused. */
  onViewportChange?: (viewport: MapViewport) => void;
  /** Keeps the camera inside these bounds: a tuple, or `"canada"`. Applied in place. */
  maxBounds?: MapBounds;
  /** The lowest zoom the camera may reach. Applied in place. */
  minZoom?: number;
  /** The highest zoom the camera may reach. Applied in place. */
  maxZoom?: number;
  /** `false` turns off every gesture and the keyboard. Applied in place. */
  interactive?: boolean;
  /** Ctrl or Cmd with the wheel, two fingers on touch. Applied in place. */
  cooperativeGestures?: boolean;
  /** Sync the camera to the URL hash; a string names the hash parameter. Applied in place. */
  hash?: boolean | string;
};

/** The raw MapLibre options `createMap` merges last. The shared camera helpers read limits from it. */
type MaplibreOptions = NonNullable<UnmapMapOptions["maplibre"]>;

export function createMapStore(): MapStore {
  const entries = shallowReactive<Record<string, MapEntry>>({});
  return {
    entries,
    get: (id) => entries[id],
    set: (id, entry) => {
      entries[id] = entry;
    },
    clear: (id, map) => {
      // Only a teardown of the *current* map may clear the slot; a replacement that was
      // registered before the outgoing map's cleanup ran must survive.
      if (entries[id]?.map === map) entries[id] = { map: null, ready: false, generation: 0 };
    },
  };
}

/**
 * Resolve the shared map store. Reuses an ancestor's store so sibling maps share one
 * registry and `useMap(id)` can resolve any of them; otherwise creates one and provides it.
 *
 * Must be called synchronously in `<script setup>` (or `setup()`), because it may `provide()`.
 */
export function useMapStore(): MapStore {
  const parent = inject(MAP_STORE_KEY, null);
  if (parent) return parent;
  const local = createMapStore();
  provide(MAP_STORE_KEY, local);
  return local;
}

function viewportOf(map: Map): MapViewport {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

type CameraTarget = { center?: [number, number]; zoom?: number; bearing?: number; pitch?: number };

/** True when every field `target` sets matches `viewport`. */
function matches(target: CameraTarget, viewport: MapViewport): boolean {
  return (
    (target.center == null || (near(target.center[0], viewport.center[0]) && near(target.center[1], viewport.center[1]))) &&
    (target.zoom == null || near(target.zoom, viewport.zoom)) &&
    (target.bearing == null || near(target.bearing, viewport.bearing)) &&
    (target.pitch == null || near(target.pitch, viewport.pitch))
  );
}

/** A viewport reported through onViewportChange, and when. */
type Report = { viewport: MapViewport; at: number };

// Long enough for a parent's update (or a tick and a debounce) to echo a report, short enough
// that a deliberate prop change back to a viewport the user passed through still moves.
const ECHO_WINDOW_MS = 250;

/** A memory bound on the reports kept when no camera prop changes; the window decides echoes. */
const MAX_REPORTED = 64;

function timestamp(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

// --- shared camera helpers: byte-identical in both lanes (registry-contract.test.ts) ---

/** `[[west, south], [east, north]]` or `[west, south, east, north]`, in degrees. */
export type MapBoundsTuple = [[number, number], [number, number]] | [number, number, number, number];

/** Where the camera may go: a bounds tuple, or `"canada"` for all of Canada with a margin. */
export type MapBounds = MapBoundsTuple | "canada";

/**
 * All of Canada with room around it. Canada runs from 141°W (Yukon and Alaska) to 52.6°W (Cape
 * Spear) and from 41.7°N (Middle Island, Lake Erie) to 83.1°N (Cape Columbia). The margin keeps a
 * pin on any coast off the edge of the screen. The north edge is 85°N, just inside the 85.05°N
 * where Web Mercator ends: MapLibre cannot constrain past it.
 */
export const CANADA_BOUNDS: [[number, number], [number, number]] = [
  [-150, 38],
  [-45, 85],
];

/** A `maxBounds` value as MapLibre takes it: the preset resolved, an unknown preset dropped. */
export function resolveBounds(bounds: MapBounds | undefined): MapBoundsTuple | undefined {
  if (bounds === undefined) return undefined;
  if (typeof bounds === "string") return bounds === "canada" ? CANADA_BOUNDS : undefined;
  return bounds;
}

/** Tell a controlled parent where the camera is, and remember it so its echo is recognised. */
function report(map: Map, onViewportChange: ((viewport: MapViewport) => void) | undefined, reported: Report[]): void {
  if (!onViewportChange) return;
  const viewport = viewportOf(map);
  reported.push({ viewport, at: timestamp() });
  if (reported.length > MAX_REPORTED) reported.shift();
  onViewportChange(viewport);
}

type LimitOptions = { maxBounds?: MapBounds; minZoom?: number; maxZoom?: number };

/** The camera limits MapLibre is given: only those that are set. */
type Constraints = {
  maxBounds?: MapBoundsTuple | NonNullable<MaplibreOptions["maxBounds"]>;
  minZoom?: number;
  maxZoom?: number;
};

/** MapLibre's zoom range when no limit narrows it. It accepts no minZoom below -2. */
const DEFAULT_MIN_ZOOM = -2;
const DEFAULT_MAX_ZOOM = 22;

/** Identifies the limits a set of props asks for, so they are applied only when they change. */
function limitsKey(options: LimitOptions): string {
  return JSON.stringify([options.maxBounds ?? null, options.minZoom ?? null, options.maxZoom ?? null]);
}

/** True when a camera limit is set, by a prop or by the raw `maplibre` option. */
function limited(options: LimitOptions, raw: MaplibreOptions | undefined): boolean {
  return (
    options.maxBounds != null ||
    raw?.maxBounds != null ||
    [options.minZoom, options.maxZoom, raw?.minZoom, raw?.maxZoom].some((value) => Number.isFinite(value))
  );
}

/** A zoom limit MapLibre can take. One that is not a finite number (NaN, Infinity) is unset, with a warning. */
function finiteZoom(name: "minZoom" | "maxZoom", value: number | null | undefined): number | undefined {
  if (value == null) return undefined;
  if (Number.isFinite(value)) return value;
  console.warn(`unmap: ${name} ${value} is not a finite number; it is ignored.`);
  return undefined;
}

/**
 * The limits as MapLibre accepts them. Each one is the prop, or else the raw `maplibre` option's;
 * a zoom that is not a finite number counts as unset. MapLibre throws on a minZoom above maxZoom
 * (an unset one counts as its default, -2 or 22) and on a minZoom below -2, so those are dropped
 * with a warning: both of an inverted pair, or the one bound that is out of range on its own (a
 * minZoom below -2 or above the max zoom, or a maxZoom below -2).
 */
function constraintsOf(options: LimitOptions, raw: MaplibreOptions | undefined): Constraints {
  const maxBounds = resolveBounds(options.maxBounds) ?? raw?.maxBounds ?? undefined;
  let minZoom = finiteZoom("minZoom", options.minZoom) ?? finiteZoom("minZoom", raw?.minZoom);
  let maxZoom = finiteZoom("maxZoom", options.maxZoom) ?? finiteZoom("maxZoom", raw?.maxZoom);
  if (minZoom != null && maxZoom != null && minZoom > maxZoom) {
    console.warn(`unmap: minZoom ${minZoom} is above maxZoom ${maxZoom}; both are ignored.`);
    minZoom = undefined;
    maxZoom = undefined;
  }
  if (minZoom != null && (minZoom < DEFAULT_MIN_ZOOM || minZoom > (maxZoom ?? DEFAULT_MAX_ZOOM))) {
    console.warn(`unmap: minZoom ${minZoom} is outside ${DEFAULT_MIN_ZOOM} to ${maxZoom ?? DEFAULT_MAX_ZOOM}; it is ignored.`);
    minZoom = undefined;
  }
  if (maxZoom != null && maxZoom < DEFAULT_MIN_ZOOM) {
    console.warn(`unmap: maxZoom ${maxZoom} is below ${DEFAULT_MIN_ZOOM}; it is ignored.`);
    maxZoom = undefined;
  }
  return {
    ...(maxBounds ? { maxBounds } : {}),
    ...(minZoom != null ? { minZoom } : {}),
    ...(maxZoom != null ? { maxZoom } : {}),
  };
}

/**
 * The raw `maplibre` option with its limits replaced by `constraints`. When they already agree it
 * is returned as given, so a map whose props set no limits is created with the caller's own object.
 */
function withConstraints(raw: MaplibreOptions | undefined, constraints: Constraints): MaplibreOptions | undefined {
  const { maxBounds, minZoom, maxZoom, ...rest } = raw ?? {};
  const asked = JSON.stringify([maxBounds ?? null, minZoom ?? null, maxZoom ?? null]);
  const given = JSON.stringify([constraints.maxBounds ?? null, constraints.minZoom ?? null, constraints.maxZoom ?? null]);
  return asked === given ? raw : { ...rest, ...constraints };
}

/**
 * Apply limits to a live map. A limit that is not set goes back to MapLibre's default. MapLibre
 * throws when a new minZoom is above the current maxZoom (or a new maxZoom below the current
 * minZoom), so the bound that makes room moves first.
 */
function applyConstraints(map: Map, constraints: Constraints): void {
  map.setMaxBounds(constraints.maxBounds ?? null);
  const min = constraints.minZoom ?? null;
  const max = constraints.maxZoom ?? null;
  if (min != null && min > map.getMaxZoom()) {
    map.setMaxZoom(max);
    map.setMinZoom(min);
  } else {
    map.setMinZoom(min);
    map.setMaxZoom(max);
  }
}

/** The gesture handlers MapLibre's `interactive` option gates, by their option and property name. */
const GESTURE_HANDLERS = [
  "scrollZoom",
  "boxZoom",
  "dragRotate",
  "dragPan",
  "keyboard",
  "doubleClickZoom",
  "touchZoomRotate",
  "touchPitch",
] as const;

/**
 * What MapLibre's `interactive` option decides, applied to a live map: the eight gesture handlers
 * it leaves disabled when false, and the two things it sets on the container at construction
 * (the grab cursor class and the canvas's keyboard focus). MapLibre has no setter for it.
 * Turning it on does what the constructor does: a handler the raw `maplibre` option turned off
 * (`dragRotate: false`) stays off, and one given options (`scrollZoom: { around: "center" }`) is
 * enabled with them, since a bare `enable()` resets them.
 */
function setInteractive(map: Map, on: boolean, raw: MaplibreOptions | undefined): void {
  for (const name of GESTURE_HANDLERS) {
    const handler: { enable(options?: boolean | object | null): void; disable(): void } = map[name];
    const option = raw?.[name];
    if (!on) handler.disable();
    else if (option !== false) handler.enable(typeof option === "object" ? option : undefined);
  }
  map.getCanvasContainer().classList.toggle("maplibregl-interactive", on);
  map.getCanvas().setAttribute("tabindex", on ? "0" : "-1");
}

/** The gesture options a map can set in place. */
type GestureProps = { interactive?: boolean; cooperativeGestures?: boolean };

/**
 * The raw `maplibre` option with the gesture options that are set laid over it. With none set it
 * is returned as given: MapLibre reads an explicit `interactive: undefined` as off, and a caller's
 * own `maplibre.interactive` must survive a map that does not set the option.
 */
function withGestures(raw: MaplibreOptions | undefined, options: GestureProps): MaplibreOptions | undefined {
  const set: GestureProps = {
    ...(options.interactive !== undefined ? { interactive: options.interactive } : {}),
    ...(options.cooperativeGestures !== undefined ? { cooperativeGestures: options.cooperativeGestures } : {}),
  };
  return Object.keys(set).length === 0 ? raw : { ...raw, ...set };
}

/**
 * `hash` as MapLibre reads it: `true` for the bare `#zoom/lat/lng`, a name for
 * `#name=zoom/lat/lng`, `false` for off. An empty name is off, as it is in MapLibre.
 */
function hashParamOf(hash: boolean | string | undefined): string | boolean {
  return hash === true ? true : typeof hash === "string" && hash !== "" ? hash : false;
}

// --- end shared camera helpers ---

/**
 * Create and own a MapLibre map for `container`. The map is recreated only when the container
 * or a connection option changes; cartography changes swap the style in place, and the camera
 * and projection apply in place. Teardown removes the map and clears the store.
 *
 * `options` and `id` are getters so the caller's props stay reactive.
 */
export function useMapLifecycle(
  store: MapStore,
  container: Ref<HTMLElement | null>,
  options: () => MapProviderOptions,
  id: () => string = () => DEFAULT_MAP_ID,
): void {
  let active: Map | null = null;
  // The style URL the active map shows or is loading. A cartography change swaps only when it differs.
  let appliedStyle: string | null = null;
  let generation = 0;
  let loaded = false;
  // True while this lifecycle moves the camera, so the move is not echoed to onViewportChange.
  let syncing = false;
  // Viewports reported through onViewportChange, oldest first. A parent that feeds them back
  // sets one of these as props, possibly several reports late and after the gesture moved on.
  const reported: Report[] = [];
  // The limits the active map was created with or last given, so an unchanged set is never re-applied.
  let appliedLimits = "";
  // The projection the next style load puts back: the `projection` option, or whatever the map
  // showed when a swap began (a control such as map-controls' globe button sets it directly).
  let carried: ProjectionSpec | undefined;
  // What the active map was created with or last given, so an unchanged value is never re-applied
  // and a caller's raw `maplibre` gesture options survive a map that does not set these options.
  let appliedInteractive = true;
  let appliedCooperative = false;

  const cartography = () => {
    const o = options();
    return {
      style: o.style,
      mode: o.mode,
      lang: o.lang,
      theme: o.theme,
      overlays: o.overlays,
      profile: o.profile,
    };
  };

  // Connection: only what a style swap cannot change rebuilds the map.
  watch(
    [
      () => container.value,
      id,
      () => options().apiKey,
      () => options().gateway,
      // Watched as primitives, not as the object: `:controls="{ position: 'bottom-left' }"` is a
      // new object on every render, and watching it would rebuild the map each time.
      () => options().controls === false,
      () => (typeof options().controls === "object" ? (options().controls as UnmapControlsOptions).position : undefined),
      () => options().maplibre,
    ],
    ([el, mapId, apiKey, gateway, controlsOff, controlsPosition, maplibre], _previous, onCleanup) => {
      if (!el) return;
      const o = options();
      const constraints = constraintsOf(o, maplibre);
      const map = createMap({
        container: el,
        key: apiKey,
        gateway,
        ...cartography(),
        center: o.center,
        zoom: o.zoom,
        projection: o.projection,
        controls: controlsOff ? false : controlsPosition ? { position: controlsPosition } : true,
        // The caller's own object unless a limit or gesture option (or a limit dropped as invalid)
        // changes it, so a map that sets none of them is created with exactly the options it was given.
        maplibre: withGestures(withConstraints(maplibre, constraints), o),
      });
      appliedLimits = limitsKey(o);
      // What the map was really created with: a set option wins over the raw one, which wins over
      // MapLibre's default.
      appliedInteractive = o.interactive ?? maplibre?.interactive ?? true;
      appliedCooperative = o.cooperativeGestures ?? maplibre?.cooperativeGestures ?? false;
      active = map;
      carried = o.projection ? { type: o.projection } : undefined;
      appliedStyle = unmapStyle({ key: apiKey, gateway, ...cartography() });
      generation = 0;
      loaded = false;
      if (o.bearing != null || o.pitch != null) {
        map.jumpTo({
          ...(o.bearing != null ? { bearing: o.bearing } : {}),
          ...(o.pitch != null ? { pitch: o.pitch } : {}),
        });
      }
      // The constructor clamped a camera option outside the limits before any listener existed.
      // (React finds this through its mount-time camera effect; this watcher-based camera does not
      // run on mount.) Only under a limit, as there, where MapLibre normalising a bearing or pitch
      // it was given is reported too.
      if (limited(o, maplibre)) {
        const asked: CameraTarget = {
          ...(o.center ? { center: o.center } : {}),
          ...(o.zoom != null ? { zoom: o.zoom } : {}),
          ...(o.bearing != null ? { bearing: o.bearing } : {}),
          ...(o.pitch != null ? { pitch: o.pitch } : {}),
        };
        if (Object.keys(asked).length > 0 && !matches(asked, viewportOf(map))) report(map, o.onViewportChange, reported);
      }
      store.set(mapId, { map, ready: false, generation: 0 });

      const onStyleLoad = () => {
        generation += 1;
        // MapLibre 6 keeps the projection on the style, so a swapped style arrives flat. Put back
        // the one the map showed before the swap, or the `projection` option if it changed since.
        const next = carried;
        if (next) map.setProjection(next);
        if (loaded) store.set(mapId, { map, ready: true, generation });
      };
      const onLoad = () => {
        loaded = true;
        // A cached style can fire `style.load` inside the constructor, before this listener existed.
        generation = Math.max(generation, 1);
        store.set(mapId, { map, ready: true, generation });
      };
      // createMap applies the projection it was created with on its own one-time `style.load` and
      // `load`, which MapLibre runs after every `on` listener, so they would undo a change made
      // before the first load, and (when a cached style loaded inside the constructor) its pending
      // `style.load` one would undo the latest projection on the first swap. One-time listeners run
      // in registration order: these, registered after createMap's, put the latest value back: the
      // carried one, so a projection set on the map itself survives the first swap too.
      if (o.projection) {
        // Never undefined here: the option set it above, and nothing unsets it while this map lives.
        const reapply = () => {
          if (carried) map.setProjection(carried);
        };
        map.once("style.load", reapply);
        map.once("load", reapply);
      }
      const onMove = () => {
        if (syncing) return;
        report(map, options().onViewportChange, reported);
      };
      map.on("style.load", onStyleLoad);
      map.on("load", onLoad);
      map.on("move", onMove);
      // MapLibre sizes its canvas once, at construction, and only re-measures on window resize.
      // On a fresh page load the container can still be 0 wide when this watcher runs (its CSS
      // has not applied yet), which leaves the map painted at the wrong size with no error.
      // Follow the container itself so the canvas tracks its real box.
      const observer =
        typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.resize());
      observer?.observe(el);
      onCleanup(() => {
        observer?.disconnect();
        map.off("style.load", onStyleLoad);
        map.off("load", onLoad);
        map.off("move", onMove);
        map.remove();
        if (active === map) active = null;
        store.clear(mapId, map);
      });
    },
    { immediate: true, flush: "post" },
  );

  // Cartography: swap the style on the live map. Created after the connection watcher with the
  // same flush, so a change that also recreates the map finds it already on the new style.
  watch(
    [
      () => options().style,
      () => options().mode,
      () => options().lang,
      () => options().theme,
      () => options().overlays?.join(",") ?? "",
      () => options().profile,
    ],
    () => {
      if (!active) return;
      const o = options();
      const url = unmapStyle({ key: o.apiKey, gateway: o.gateway, ...cartography() });
      if (url === appliedStyle) return;
      appliedStyle = url;
      // Whatever the map shows now crosses the swap.
      // A style JSON's own projection is carried too, onto later styles, overriding theirs.
      const shown = active.getProjection();
      if (shown) carried = shown;
      store.set(id(), { map: active, ready: false, generation });
      // A full reload, not a diff: `style.load` must fire so every layer owner re-adds its layers.
      active.setStyle(url, { diff: false });
    },
    { flush: "post" },
  );

  // Projection applies in place. Before a style has loaded (the first one, or mid-swap)
  // `setProjection` throws, and the `style.load` handler applies the latest value then.
  // `getStyle()` is undefined exactly then; `isStyleLoaded()` is also false while tiles load,
  // and a change made then would be lost.
  // A map that never had a projection keeps none.
  watch(
    () => options().projection,
    (projection) => {
      if (!active || (projection === undefined && carried === undefined)) return;
      const next: ProjectionSpec = { type: projection ?? "mercator" };
      carried = next;
      if (generation === 0 || !active.getStyle()) return;
      active.setProjection(next);
    },
    { flush: "post" },
  );

  // Limits apply in place. Vue does not promise which of two watchers triggered in one tick runs
  // first, so the camera watcher calls this too, before it moves: a limit and a camera change made
  // together always apply in that order. A limit that moves the camera is reported like a gesture.
  const applyLimits = () => {
    if (!active) return;
    const o = options();
    const key = limitsKey(o);
    if (key === appliedLimits) return;
    const before = viewportOf(active);
    syncing = true;
    try {
      applyConstraints(active, constraintsOf(o, o.maplibre));
    } finally {
      syncing = false;
    }
    // Recorded only once applied, so a set that failed is tried again on the next change.
    appliedLimits = key;
    if (!matches(before, viewportOf(active))) report(active, o.onViewportChange, reported);
  };
  watch(() => limitsKey(options()), applyLimits, { flush: "post" });

  // Gestures apply in place. Unset means what the map was created with: the raw `maplibre` option,
  // or else MapLibre's default (interactive, no cooperative gestures).
  watch(
    () => options().interactive ?? options().maplibre?.interactive ?? true,
    (want) => {
      if (!active || want === appliedInteractive) return;
      appliedInteractive = want;
      setInteractive(active, want, options().maplibre);
    },
    { flush: "post" },
  );

  watch(
    () => options().cooperativeGestures ?? options().maplibre?.cooperativeGestures ?? false,
    (want) => {
      if (!active || want === appliedCooperative) return;
      appliedCooperative = want;
      if (want) active.cooperativeGestures.enable();
      else active.cooperativeGestures.disable();
    },
    { flush: "post" },
  );

  // Camera: applied in place, and only when it differs from where the map already is, so a
  // parent that feeds `viewportChange` back into the props never loops. A target equal to a
  // viewport this lifecycle reported within the echo window is that feedback arriving, not a
  // request to move: a parent that applies it late (a debounce, an await) finds the gesture has
  // carried the camera on, and jumping back would cancel the gesture. The echo consumes that
  // report and every older one, and keeps the newer ones, which a parent lagging several reports
  // behind still has to apply. Past the window a matching target is a deliberate change and
  // moves the camera.
  watch(
    [
      () => options().center?.[0],
      () => options().center?.[1],
      () => options().zoom,
      () => options().bearing,
      () => options().pitch,
    ],
    ([lng, lat, zoom, bearing, pitch]) => {
      const cutoff = timestamp() - ECHO_WINDOW_MS;
      const fresh = reported.findIndex((report) => report.at >= cutoff);
      reported.splice(0, fresh === -1 ? reported.length : fresh);
      if (!active) return;
      applyLimits();
      const target: CameraTarget = {};
      if (lng != null && lat != null) target.center = [lng, lat];
      if (zoom != null) target.zoom = zoom;
      if (bearing != null) target.bearing = bearing;
      if (pitch != null) target.pitch = pitch;
      if (Object.keys(target).length === 0) return;
      if (matches(target, viewportOf(active))) return;
      const echo = reported.findIndex((report) => matches(target, report.viewport));
      if (echo !== -1) {
        reported.splice(0, echo + 1);
        return;
      }
      syncing = true;
      try {
        active.jumpTo(target);
      } finally {
        syncing = false;
      }
      // A limit clamped the move: say where the map really is. Only under a limit: MapLibre also
      // normalises a camera it was given (a bearing of 270 reads back as -90), and that is not a move.
      if (limited(options(), options().maplibre) && !matches(target, viewportOf(active))) {
        report(active, options().onViewportChange, reported);
      }
    },
    { flush: "post" },
  );

  // URL hash, on whichever map the store holds. The camera watcher does not run on mount, so the
  // map already sits where the options put it: a valid position in the URL then wins, exactly as
  // MapLibre's own `hash: true` constructor option does, and the jump is reported through
  // onViewportChange. Removing the Hash (hash off, a new map, unmount) removes the map's part of
  // the URL, as MapLibre's map.remove() does.
  watch(
    [() => store.get(id())?.map ?? null, () => hashParamOf(options().hash)],
    ([map, param], _previous, onCleanup) => {
      if (!map || param === false) return;
      const handle = new maplibregl.Hash(param === true ? undefined : param).addTo(map);
      // Mirrors MapLibre 6.13's Map constructor after `new Hash().addTo(this)`; `_onHashChange` is on
      // the public Hash type. Recheck on MapLibre upgrades.
      handle._onHashChange();
      onCleanup(() => handle.remove());
    },
    { immediate: true, flush: "post" },
  );
}

function useEntry(id: MaybeRefOrGetter<string | undefined>, hook: string): ComputedRef<MapEntry | undefined> {
  const store = inject(MAP_STORE_KEY, null);
  if (!store) {
    throw new Error(`${hook} must be used inside an <UnmapMap> (which provides the map store).`);
  }
  return computed(() => store.get(toValue(id) ?? DEFAULT_MAP_ID));
}

/**
 * Returns the MapLibre map for `id` (default `"default"`) as a computed; null until it exists.
 * Pass a getter (`() => props.mapId`) to follow a reactive id.
 */
export function useMap(id: MaybeRefOrGetter<string | undefined> = DEFAULT_MAP_ID): ComputedRef<Map | null> {
  const entry = useEntry(id, "useMap");
  return computed(() => entry.value?.map ?? null);
}

/** True while a style is loaded on the map for `id`: false before the first load and during a swap. */
export function useMapReady(id: MaybeRefOrGetter<string | undefined> = DEFAULT_MAP_ID): ComputedRef<boolean> {
  const entry = useEntry(id, "useMapReady");
  return computed(() => entry.value?.ready ?? false);
}

/**
 * 0 until the map for `id` first loads, then +1 for every completed style load. Watch this in
 * anything that adds sources or layers: a style swap removes them.
 */
export function useMapGeneration(id: MaybeRefOrGetter<string | undefined> = DEFAULT_MAP_ID): ComputedRef<number> {
  const entry = useEntry(id, "useMapGeneration");
  return computed(() => entry.value?.generation ?? 0);
}

/**
 * The page's colour mode: a `dark` or `light` class on <html> (shadcn, next-themes), then
 * `data-theme`, then an inline `color-scheme` (the only signal on a page that toggles `.dark`
 * alone), then the operating system's preference.
 */
export function pageMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  const attribute = root.getAttribute("data-theme");
  if (attribute === "dark" || attribute === "light") return attribute;
  const scheme = root.style.colorScheme;
  if (scheme === "dark" || scheme === "light") return scheme;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Resolves `"auto"` to the page's mode and follows the page and the OS as they switch. */
export function useResolvedMode(mode: () => MapMode | undefined): ComputedRef<"light" | "dark"> {
  const page = ref<"light" | "dark">(pageMode());
  watch(
    () => (mode() ?? "auto") === "auto",
    (auto, _previous, onCleanup) => {
      if (!auto || typeof document === "undefined") return;
      const update = () => {
        page.value = pageMode();
      };
      update();
      const observer = new MutationObserver(update);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
      const media = window.matchMedia?.("(prefers-color-scheme: dark)");
      media?.addEventListener?.("change", update);
      onCleanup(() => {
        observer.disconnect();
        media?.removeEventListener?.("change", update);
      });
    },
    { immediate: true },
  );
  return computed(() => {
    const requested = mode() ?? "auto";
    return requested === "auto" ? page.value : requested;
  });
}
