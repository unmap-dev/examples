"use client";

/**
 * <Directions> - a directions page in one component. A full-bleed map with a floating panel (a
 * bottom sheet on a phone): choose a start and a destination and the route draws in, with its
 * travel time as the headline. The travel-mode switch is the point: drive, cycle or walk, and the
 * route redraws for that mode while each mode keeps its time on the switch, so they compare at a
 * glance. "Reachable area" shades how far you can go from the start in the same mode.
 *
 * Composes the registry's map, geocoder, route-line, geojson-layer and marker-popup items on your
 * shadcn Card, ToggleGroup, Button, Alert and Spinner, in your tokens. Each answer is one request
 * to the unmap API, asked once and remembered: the search boxes call /geocode/autocomplete, a
 * route calls /route once per mode, the reachable area calls /isochrone once per start and mode.
 * The routing API returns one route per request, so there are no alternative routes to show.
 *
 * Installed by `npx shadcn add` with its page at app/directions/page.tsx. Edit freely.
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Router } from "@unmap/routing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Geocoder } from "@/components/ui/geocoder";
import { GeoJSONLayer } from "@/components/ui/geojson-layer";
import { Map } from "@/components/ui/map";
import { Marker, MarkerLabel } from "@/components/ui/marker-popup";
import { RouteLine } from "@/components/ui/route-line";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMap } from "@/lib/map-context";

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

export interface DirectionsProps {
  /** unmap API key. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** Where the map opens, [longitude, latitude]. Defaults to downtown Calgary. */
  center?: [number, number];
  /** Opening zoom. Defaults to 11. */
  zoom?: number;
  /** Language of the copy, the numbers and the search results. Defaults to "en". */
  lang?: DirectionsLang;
  className?: string;
}

export function Directions({ apiKey, gateway, center = CALGARY, zoom = 11, lang = "en", className }: DirectionsProps) {
  if (!apiKey.trim()) {
    const copy = DIRECTIONS_COPY[lang];
    // Where the map would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="directions"
        data-state="no-key"
        className={["flex h-full min-h-[480px] items-start justify-center bg-muted/40 p-4 sm:items-center sm:p-6", className].filter(Boolean).join(" ")}
      >
        <Alert role="alert" className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <AlertTitle className="line-clamp-none">{copy.noKeyTitle}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <a className="font-medium text-primary underline underline-offset-4" href={KEY_URL} target="_blank" rel="noreferrer">
              {copy.getKey}
            </a>
            <p>{copy.noKey}</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <div data-unmap-block="directions" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map id={DIRECTIONS_MAP_ID} apiKey={apiKey} gateway={gateway} center={center} zoom={zoom} lang={lang} className="h-full">
        <Planner apiKey={apiKey} gateway={gateway} lang={lang} />
      </Map>
    </div>
  );
}

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

/** 0 to 1 as a new line draws in; 1 at once under reduced motion. */
function useDrawIn(line: unknown): number {
  const [drawn, setDrawn] = useState<{ line: unknown; progress: number }>({ line: null, progress: 1 });
  useEffect(() => {
    if (!line || prefersReducedMotion()) return;
    if (typeof requestAnimationFrame !== "function") {
      setDrawn({ line, progress: 1 });
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / DRAW_MS);
      setDrawn({ line, progress: easeOut(t) });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [line]);
  if (prefersReducedMotion()) return 1;
  return drawn.line === line ? drawn.progress : 0;
}

/**
 * The route on the map, drawing in. Its own component so the draw-in's frames re-render the line
 * alone, not the panel. A muted line (`active={false}`) is the last mode's, shown whole while the
 * next mode's route loads.
 */
function DrawnRoute({ line, active }: { line: DirectionsTrip; active: boolean }) {
  const progress = useDrawIn(active ? line : null);
  return (
    <RouteLine
      mapId={DIRECTIONS_MAP_ID}
      id={DIRECTIONS_LAYERS.route}
      coordinates={line.coordinates}
      active={active}
      progress={active ? progress : undefined}
    />
  );
}

/** Everything that needs the map. It renders inside <Map>, where useMap() can see it. */
function Planner({ apiKey, gateway, lang }: { apiKey: string; gateway?: string; lang: DirectionsLang }) {
  const copy = DIRECTIONS_COPY[lang];
  const map = useMap(DIRECTIONS_MAP_ID);
  const router = useMemo(() => new Router({ key: apiKey, gateway }), [apiKey, gateway]);
  const [from, setFrom] = useState<DirectionsStop | null>(null);
  const [to, setTo] = useState<DirectionsStop | null>(null);
  const [mode, setMode] = useState<DirectionsMode>("auto");
  const [trips, setTrips] = useState<Asked<DirectionsTrip>>(() => nothingAsked());
  const [areas, setAreas] = useState<Asked<TravelArea>>(() => nothingAsked());
  const [areaOn, setAreaOn] = useState(false);
  // The route last on screen for these ends: it stays, muted, while the next mode's route loads.
  const [shown, setShown] = useState<{ pair: string; trip: DirectionsTrip } | null>(null);
  // One polite announcement: the trip's time first, then the area, whichever of them answered last.
  const [said, setSaid] = useState({ trip: "", area: "" });
  // On a phone the sheet can fold to the headline, to give the map back.
  const [folded, setFolded] = useState(false);
  const routeFlights = useRef<Flights>({ key: "", byMode: {} });
  const areaFlights = useRef<Flights>({ key: "", byMode: {} });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hintId = useId();
  const endsId = useId();
  const areaId = useId();
  const modesId = useId();
  const creditId = useId();

  const fromKey = from ? stopKey(from) : "";
  const toKey = to ? stopKey(to) : "";
  const pair = from && to ? `${fromKey}>${toKey}` : null;
  const routeAsked = pair && trips.key === pair ? trips : null;
  const trip = routeAsked?.byMode[mode] ?? null;
  const routePending = routeAsked?.pending.includes(mode) ?? false;
  const routeError = routeAsked?.failed[mode] ?? null;
  const ghost = !trip && routePending && pair && shown?.pair === pair ? shown.trip : null;
  const areaAsked = areaOn && from && areas.key === fromKey ? areas : null;
  const area = areaAsked?.byMode[mode] ?? null;
  const areaPending = areaAsked?.pending.includes(mode) ?? false;
  const areaError = areaAsked?.failed[mode] ?? null;
  const line = trip ?? ghost;
  const isFolded = folded && line !== null;
  // What the reader is looking at now, read when an answer lands after they moved on.
  const now = useRef({ pair, mode, start: fromKey, areaOn, trip });
  now.current = { pair, mode, start: fromKey, areaOn, trip };

  function padding(gutter = GUTTER): DirectionsPadding {
    const container = map?.getContainer();
    if (!container) return panelPadding({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }, null, gutter);
    return panelPadding(container.getBoundingClientRect(), panelRef.current?.getBoundingClientRect() ?? null, gutter);
  }
  const duration = () => (prefersReducedMotion() ? 0 : CAMERA_MS);
  function frameRoute(next: DirectionsTrip) {
    map?.fitBounds(pointsBounds(next.coordinates), { padding: padding(FRAME_GUTTER), maxZoom: ROUTE_MAX_ZOOM, duration: duration() });
  }

  useEffect(
    () => () => {
      abortAll(routeFlights.current);
      abortAll(areaFlights.current);
    },
    [],
  );

  // A chosen end pulls the map to it, clear of the panel; two frame the trip while its route loads.
  // This runs after the search box's own fly to the result, and takes over from it.
  useEffect(() => {
    if (!map || (!from && !to)) return;
    if (from && to) {
      // A route that already answered has framed itself.
      if (trips.key === pair && Object.keys(trips.byMode).length > 0) return;
      map.fitBounds(
        pointsBounds([
          [from.lng, from.lat],
          [to.lng, to.lat],
        ]),
        { padding: padding(FRAME_GUTTER), maxZoom: ROUTE_MAX_ZOOM, duration: duration() },
      );
      return;
    }
    const stop = (from ?? to)!;
    map.easeTo({ center: [stop.lng, stop.lat], zoom: Math.max(map.getZoom(), 13), offset: paddingOffset(padding()), duration: duration() });
    // Only a newly chosen end moves the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fromKey, toKey]);

  // Folding or unfolding the sheet changes how much map there is: frame the route again.
  const wasFolded = useRef(isFolded);
  useEffect(() => {
    if (wasFolded.current === isFolded) return;
    wasFolded.current = isFolded;
    if (line) frameRoute(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFolded]);

  // A new key or gateway is a new account: forget what the old one was told, and ask again.
  const askedWith = useRef(router);
  useEffect(() => {
    if (askedWith.current === router) return;
    askedWith.current = router;
    abortAll(routeFlights.current);
    abortAll(areaFlights.current);
    routeFlights.current.key = "";
    areaFlights.current.key = "";
    setTrips(nothingAsked());
    setAreas(nothingAsked());
    askRoute(from, to, mode, nothingAsked());
    askArea(from, mode, areaOn, nothingAsked());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /** Asks once per key and mode; the answer, or why it failed, is remembered under that key. */
  function ask<T>(
    flights: Flights,
    setAsked: (change: (current: Asked<T>) => Asked<T>) => void,
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
    const update = (change: (asked: Asked<T>) => Asked<T>) =>
      setAsked((current) => change(current.key === key ? current : nothingAsked<T>(key)));
    const settle = (asked: Asked<T>) => asked.pending.filter((item) => item !== travel);
    update((asked) => {
      const failed = { ...asked.failed };
      delete failed[travel];
      return { ...asked, pending: [...settle(asked), travel], failed };
    });
    call(controller.signal).then(
      (value) => {
        if (!mine()) return;
        delete flights.byMode[travel];
        update((asked) => ({ ...asked, byMode: { ...asked.byMode, [travel]: value }, pending: settle(asked) }));
        landed(value);
      },
      (caught: unknown) => {
        if (!mine()) return;
        delete flights.byMode[travel];
        update((asked) =>
          isAbort(caught)
            ? { ...asked, pending: settle(asked) }
            : { ...asked, pending: settle(asked), failed: { ...asked.failed, [travel]: requestError(caught, lang, kind) } },
        );
      },
    );
  }

  function showTrip(next: DirectionsTrip, key: string, travel: DirectionsMode) {
    setShown({ pair: key, trip: next });
    const sentence = copy.announceTrip(copy.modes[travel], formatDuration(next.durationSeconds), formatDistance(next.distanceMeters, lang));
    setSaid((current) => ({ ...current, trip: sentence }));
    frameRoute(next);
  }

  /** The route between two ends in one mode: remembered, or asked once. */
  function askRoute(start: DirectionsStop | null, end: DirectionsStop | null, travel: DirectionsMode, remembered = trips) {
    setSaid((current) => ({ ...current, trip: "" }));
    if (!start || !end) {
      abortAll(routeFlights.current);
      routeFlights.current.key = "";
      return;
    }
    const key = `${stopKey(start)}>${stopKey(end)}`;
    const known = remembered.key === key ? remembered.byMode[travel] : undefined;
    if (known) {
      showTrip(known, key, travel);
      return;
    }
    ask<DirectionsTrip>(
      routeFlights.current,
      setTrips,
      key,
      travel,
      "route",
      (signal) =>
        router.route([start.lng, start.lat], [end.lng, end.lat], { mode: travel, signal }).then((result) => ({
          coordinates: result.geometry.coordinates,
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
        })),
      (next) => {
        // An earlier mode's route is kept for its switch, but only the chosen mode's is shown.
        if (now.current.pair === key && now.current.mode === travel) showTrip(next, key, travel);
      },
    );
  }

  /** How far you can go from the start in one mode: remembered, or asked once. */
  function askArea(start: DirectionsStop | null, travel: DirectionsMode, on: boolean, remembered = areas) {
    setSaid((current) => ({ ...current, area: "" }));
    if (!on || !start) return;
    const key = stopKey(start);
    const caption = copy.areaCaption(copy.by[travel], minutesList(AREA_MINUTES[travel], lang), start.name);
    if (remembered.key === key && remembered.byMode[travel]) {
      setSaid((current) => ({ ...current, area: caption }));
      return;
    }
    ask<TravelArea>(
      areaFlights.current,
      setAreas,
      key,
      travel,
      "area",
      (signal) =>
        router.isochrone([start.lng, start.lat], { minutes: AREA_MINUTES[travel], mode: travel, signal }) as Promise<TravelArea>,
      (next) => {
        const current = now.current;
        if (current.start !== key || current.mode !== travel || !current.areaOn) return;
        setSaid((said) => ({ ...said, area: caption }));
        // A route on screen keeps the camera; with none, the camera frames the area.
        const bounds = areaBounds(next);
        if (bounds && !current.trip) map?.fitBounds(bounds, { padding: padding(), duration: duration() });
      },
    );
  }

  function chooseFrom(result: { name: string; lng: number; lat: number }) {
    const next = { name: result.name, lng: result.lng, lat: result.lat };
    setFrom(next);
    setFolded(false);
    askRoute(next, to, mode);
    askArea(next, mode, areaOn);
  }

  function chooseTo(result: { name: string; lng: number; lat: number }) {
    const next = { name: result.name, lng: result.lng, lat: result.lat };
    setTo(next);
    setFolded(false);
    askRoute(from, next, mode);
  }

  function chooseMode(value: unknown) {
    // Pressing the pressed item empties a single ToggleGroup; the mode stays.
    if (!isMode(value) || value === mode) return;
    setMode(value);
    askRoute(from, to, value);
    askArea(from, value, areaOn);
  }

  function toggleArea() {
    const next = !areaOn;
    setAreaOn(next);
    askArea(from, mode, next);
  }

  const known = routeAsked?.byMode ?? {};
  const sides = labelSides(from, to);
  const announcement = [said.trip, said.area].filter(Boolean).join(" ");

  return (
    <>
      {area ? (
        <GeoJSONLayer
          mapId={DIRECTIONS_MAP_ID}
          id={DIRECTIONS_LAYERS.area}
          data={area}
          fillPaint={AREA_FILL}
          linePaint={AREA_LINE}
          circlePaint={false}
          beforeId={belowRoute}
        />
      ) : null}
      {line ? <DrawnRoute line={line} active={trip !== null} /> : null}
      {/* The start: a ring in --foreground. The destination: your pin in --primary. Each is named. */}
      {from ? (
        <Marker
          key={fromKey}
          mapId={DIRECTIONS_MAP_ID}
          lngLat={[from.lng, from.lat]}
          markerContent={<span className="block size-4 rounded-full border-[3px] border-foreground bg-background" />}
        >
          <MarkerLabel position={sides.from}>{from.name}</MarkerLabel>
        </Marker>
      ) : null}
      {to ? (
        <Marker key={toKey} mapId={DIRECTIONS_MAP_ID} lngLat={[to.lng, to.lat]}>
          <MarkerLabel position={sides.to}>{to.name}</MarkerLabel>
        </Marker>
      ) : null}
      <p data-testid="directions-announce" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {/* A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most half the map) that clears the attribution. */}
      <div
        ref={panelRef}
        className="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[22rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
      >
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2} className="min-w-0">
                {copy.title}
              </CardTitle>
              {line ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 sm:hidden"
                  aria-expanded={!isFolded}
                  aria-controls={`${endsId} ${modesId} ${areaId} ${creditId}`}
                  onClick={() => setFolded((current) => !current)}
                >
                  {isFolded ? copy.unfold : copy.fold}
                </Button>
              ) : null}
            </div>
            <CardDescription className="max-sm:hidden">{copy.intro}</CardDescription>
          </CardHeader>
          {/* The ends, the mode and the answer stay put; only the reachable area below them scrolls. On a phone the whole sheet scrolls. */}
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 max-sm:overflow-y-auto max-sm:overscroll-contain">
            <div id={endsId} data-folded={isFolded} className="flex shrink-0 flex-col gap-2 max-sm:data-[folded=true]:hidden">
              <div className="relative flex flex-col gap-2">
                {/* The rail from the start's ring to the destination's dot, the shapes the map pins use. */}
                <span aria-hidden="true" className="absolute top-1/4 bottom-1/4 left-1.5 -translate-x-1/2 border-l border-dashed border-border" />
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="relative size-3 shrink-0 rounded-full border-2 border-foreground bg-background" />
                  {/* `[&>p]:hidden` hides the <p> coverage line the geocoder renders after its combobox; the line below both boxes says it once. */}
                  <Geocoder
                    mapId={DIRECTIONS_MAP_ID}
                    apiKey={apiKey}
                    gateway={gateway}
                    lang={lang}
                    placeholder={copy.from}
                    proximity="map"
                    flyToZoom={13}
                    onSelect={chooseFrom}
                    className="[&>p]:hidden"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="relative size-3 shrink-0 rounded-full bg-primary" />
                  <Geocoder
                    mapId={DIRECTIONS_MAP_ID}
                    apiKey={apiKey}
                    gateway={gateway}
                    lang={lang}
                    placeholder={copy.to}
                    proximity="map"
                    flyToZoom={13}
                    onSelect={chooseTo}
                    className="[&>p]:hidden"
                  />
                </div>
              </div>
              <p className="pl-6 text-xs text-muted-foreground max-sm:hidden">{copy.coverage}</p>
            </div>
            <ToggleGroup
              id={modesId}
              data-folded={isFolded}
              variant="outline"
              aria-label={copy.mode}
              value={[mode]}
              onValueChange={(value: unknown[]) => chooseMode(value[0])}
              className="grid w-full shrink-0 grid-cols-3 max-sm:data-[folded=true]:hidden"
            >
              {DIRECTIONS_MODES.map((item) => {
                const time = known[item];
                return (
                  <ToggleGroupItem key={item} value={item} className="h-auto flex-col gap-0.5 py-2 aria-pressed:font-semibold">
                    <span>{copy.modes[item]}</span>{" "}
                    <span className="min-h-4 text-xs font-normal text-muted-foreground tabular-nums">{time ? formatDuration(time.durationSeconds) : ""}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            {/* Where the trip lands, always there and tall enough for an error and its retry, so nothing jumps when it arrives. */}
            <div
              data-testid="directions-answer"
              data-folded={isFolded}
              className="flex min-h-24 shrink-0 flex-col justify-center gap-1 max-sm:data-[folded=true]:min-h-0"
            >
              {routeError ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">{routeError}</span>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => askRoute(from, to, mode)}>
                      {copy.retry}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : trip ? (
                <div key={`${pair}|${mode}`} className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
                  <p data-testid="directions-eta" className="flex items-baseline gap-1">
                    {durationParts(trip.durationSeconds).map((part, index) => (
                      <Fragment key={part.unit}>
                        {index > 0 ? " " : null}
                        <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">{part.value}</span>{" "}
                        <span className="text-sm text-muted-foreground">{part.unit}</span>
                      </Fragment>
                    ))}
                  </p>
                  <p data-testid="directions-distance" className="text-sm text-muted-foreground tabular-nums">
                    {`${formatDistance(trip.distanceMeters, lang)} ${copy.by[mode]}`}
                  </p>
                </div>
              ) : routePending ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> <span>{copy.loadingRoute}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{copy.needStops}</p>
              )}
            </div>
            <div
              id={areaId}
              data-folded={isFolded}
              className="-mx-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain border-t px-2 pt-4 max-sm:flex-none max-sm:overflow-visible max-sm:data-[folded=true]:hidden"
            >
              <div className="flex flex-col items-start gap-2">
                <Button
                  type="button"
                  variant={areaOn ? "secondary" : "outline"}
                  aria-pressed={areaOn}
                  disabled={!from}
                  aria-describedby={from ? undefined : hintId}
                  onClick={toggleArea}
                >
                  {/* On is marked by a check as well as the fill. */}
                  {areaOn ? (
                    <span aria-hidden="true" data-pressed-mark="">
                      ✓
                    </span>
                  ) : null}
                  {copy.area}
                </Button>
                {from ? null : (
                  <p id={hintId} className="text-xs text-muted-foreground">
                    {copy.needStart}
                  </p>
                )}
              </div>
              {areaOn && from ? (
                <div className="flex min-h-24 flex-col justify-center gap-2">
                  {areaError ? (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription className="flex flex-row flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0">{areaError}</span>
                        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => askArea(from, mode, true)}>
                          {copy.retry}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : area ? (
                    <>
                      <ul aria-label={copy.legend} className="flex flex-wrap gap-x-4 gap-y-1">
                        {AREA_MINUTES[mode].map((minutes, index) => (
                          <li key={minutes} className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                            <span aria-hidden="true" className={`size-3 rounded-sm border border-dashed border-primary ${AREA_SWATCHES[index] ?? ""}`} />
                            {`${minutes} min`}
                          </li>
                        ))}
                      </ul>
                      <p data-testid="directions-area-caption" className="text-sm">
                        {copy.areaCaption(copy.by[mode], minutesList(AREA_MINUTES[mode], lang), from.name)}
                      </p>
                    </>
                  ) : areaPending ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner /> <span>{copy.loadingArea}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {/* Folded on a phone, the map's own attribution carries the credit until the sheet opens again. */}
            <p id={creditId} data-folded={isFolded} className="shrink-0 text-xs text-muted-foreground max-sm:data-[folded=true]:hidden">
              {copy.credit}{" "}
              <a className="underline underline-offset-2" href={ROUTING_CREDIT.sourceUrl} target="_blank" rel="noreferrer">
                {copy.source}
              </a>
              ,{" "}
              <a className="underline underline-offset-2" href={ROUTING_CREDIT.licenceUrl} target="_blank" rel="noreferrer">
                {copy.licence}
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
