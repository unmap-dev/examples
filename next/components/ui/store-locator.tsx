"use client";

/**
 * <StoreLocator> - a store-locator page in one component. A full-bleed map with a floating panel
 * (a bottom sheet on a phone): search a place and the map pulls in to it and its nearest stores;
 * the list is the map's legend, listing the stores in view as clusters split on zoom; hover either
 * and the other answers; pick a store for its hours, a drive-time halo round it, and directions.
 *
 * Composes the registry's map, geocoder, cluster-layer, geojson-layer, route-line and
 * marker-popup items on your shadcn Card, Button, Alert and Spinner, in your tokens. Each action is
 * one request to the unmap API: the search box calls /geocode/autocomplete (and /geocode/reverse for
 * typed coordinates), the drive area calls /isochrone, "Directions" calls /route. Nothing is
 * requested until the reader acts. Routes and drive areas are OpenStreetMap data (ODbL), credited
 * in the panel.
 *
 * Ships with Ottawa Public Library branches (lib/store-locator-data) and credits them. Pass
 * `stores` for your own points. Installed by `npx shadcn add` with its page at
 * app/store-locator/page.tsx. Edit freely.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Router, type LngLat } from "@unmap/routing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClusterLayer } from "@/components/ui/cluster-layer";
import { Geocoder } from "@/components/ui/geocoder";
import { GeoJSONLayer } from "@/components/ui/geojson-layer";
import { Map } from "@/components/ui/map";
import { Marker, MarkerLabel } from "@/components/ui/marker-popup";
import { RouteLine } from "@/components/ui/route-line";
import { Spinner } from "@/components/ui/spinner";
import { useMap } from "@/lib/map-context";
import { STORES, STORES_SOURCE, type StoreCollection, type StoreFeature } from "@/lib/store-locator-data";

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

export interface StoreLocatorProps {
  /** unmap API key. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
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
  className?: string;
}

export function StoreLocator({
  apiKey,
  gateway,
  stores = STORES,
  driveMinutes = 10,
  center = OTTAWA,
  zoom = 11,
  lang = "en",
  className,
}: StoreLocatorProps) {
  if (!apiKey.trim()) {
    const copy = LOCATOR_COPY[lang];
    // Where the map would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="store-locator"
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
    <div data-unmap-block="store-locator" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map id={LOCATOR_MAP_ID} apiKey={apiKey} gateway={gateway} center={center} zoom={zoom} lang={lang} className="h-full">
        <Locator apiKey={apiKey} gateway={gateway} stores={stores} driveMinutes={driveMinutes} lang={lang} />
      </Map>
    </div>
  );
}

type Trip = { coordinates: LngLat[]; distanceMeters: number; durationSeconds: number };
type Hover = { id: string; from: "map" | "list" };
type Pending = "route" | "reach";
type MapPointerEvent = { features?: Array<{ properties?: Record<string, unknown> | null }> };

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

/** The route on the map, drawing in. Its own component so the draw-in's frames re-render the line alone, not the panel and its list. */
function DrawnRoute({ line }: { line: Trip }) {
  const progress = useDrawIn(line);
  return <RouteLine mapId={LOCATOR_MAP_ID} id={LOCATOR_LAYERS.route} coordinates={line.coordinates} progress={progress} />;
}

/** Everything that needs the map. It renders inside <Map>, where useMap() can see it. */
function Locator({
  apiKey,
  gateway,
  stores,
  driveMinutes,
  lang,
}: {
  apiKey: string;
  gateway?: string;
  stores: StoreCollection;
  driveMinutes: number;
  lang: LocatorLang;
}) {
  const copy = LOCATOR_COPY[lang];
  const map = useMap(LOCATOR_MAP_ID);
  const router = useMemo(() => new Router({ key: apiKey, gateway }), [apiKey, gateway]);
  const [bounds, setBounds] = useState<LocatorBounds | null>(null);
  const [origin, setOrigin] = useState<LocatorOrigin | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [reach, setReach] = useState<LocatorReach | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<{ message: string; retry: Pending } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // The reader's weekday, read after mount: a server in another timezone (or on another day) would
  // render different hours than the browser hydrates, so the first pass shows none.
  const [day, setDay] = useState<number | null>(null);
  const abortRef = useRef<{ controller: AbortController; kind: Pending } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const hintId = useId();

  useEffect(() => setDay(new Date().getDay()), []);

  // The list follows the view: read the bounds now and after every move.
  useEffect(() => {
    if (!map) return;
    const update = () => setBounds(boundsOf(map));
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [map]);

  // The store under the pointer lights its row.
  useEffect(() => {
    if (!map) return;
    const move = (event: MapPointerEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (id === undefined || id === null) return;
      setHover((current) => (current?.from === "map" && current.id === String(id) ? current : { id: String(id), from: "map" }));
    };
    const leave = () => setHover((current) => (current?.from === "map" ? null : current));
    map.on("mousemove", LOCATOR_LAYERS.points, move as never);
    map.on("mouseleave", LOCATOR_LAYERS.points, leave as never);
    return () => {
      map.off("mousemove", LOCATOR_LAYERS.points, move as never);
      map.off("mouseleave", LOCATOR_LAYERS.points, leave as never);
    };
  }, [map]);

  // A row lit from the map scrolls into the list's view. Only the list scrolls: the panel and the
  // page stay where the reader has them.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (hover?.from !== "map" || !scroller) return;
    const row = [...scroller.querySelectorAll<HTMLElement>("[data-store-id]")].find(
      (element) => element.getAttribute("data-store-id") === hover.id,
    );
    if (!row) return;
    const top = listScrollTop(scroller, row);
    if (top !== scroller.scrollTop) scroller.scrollTop = top;
  }, [hover]);

  useEffect(
    () => () => {
      abortRef.current?.controller.abort();
      abortRef.current = null;
    },
    [],
  );

  function padding(): LocatorPadding {
    const container = map?.getContainer();
    if (!container) return panelPadding({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }, null);
    return panelPadding(container.getBoundingClientRect(), panelRef.current?.getBoundingClientRect() ?? null);
  }
  const duration = () => (prefersReducedMotion() ? 0 : CAMERA_MS);

  // Search pulls the map: the searched place and its nearest stores, clear of the panel. This runs
  // after the geocoder's own fly to the result, and takes over from it.
  useEffect(() => {
    if (!map || !origin) return;
    const nearest = visibleStores(stores, { bounds: null, origin, lang }).slice(0, NEAREST_FRAMED);
    const points: [number, number][] = [[origin.lng, origin.lat], ...nearest.map((row) => row.feature.geometry.coordinates)];
    map.fitBounds(pointsBounds(points), { padding: padding(), maxZoom: 14, duration: duration() });
    // Only a new search moves the camera; `stores` and `lang` changing under it do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, origin]);

  const rows = useMemo(() => visibleStores(stores, { bounds, origin, lang }), [stores, bounds, origin, lang]);
  const store = stores.features.find((feature) => feature.properties.id === selected) ?? null;
  const focus = useMemo(() => focusCollection(stores, [hover?.id, selected]), [stores, hover, selected]);
  const originLngLat = useMemo<[number, number] | null>(() => (origin ? [origin.lng, origin.lat] : null), [origin]);

  function cancel() {
    abortRef.current?.controller.abort();
    abortRef.current = null;
    setPending(null);
  }

  /** One request at a time: a new one aborts the last, and only the latest may set state. */
  async function request<T>(kind: Pending, call: (signal: AbortSignal) => Promise<T>, done: (result: T) => void) {
    cancel();
    const current = { controller: new AbortController(), kind };
    abortRef.current = current;
    setPending(kind);
    setError(null);
    try {
      const result = await call(current.controller.signal);
      if (abortRef.current === current) done(result);
    } catch (caught) {
      if (abortRef.current === current && !isAbort(caught)) setError({ message: requestError(caught, lang), retry: kind });
    } finally {
      if (abortRef.current === current) {
        abortRef.current = null;
        setPending(null);
      }
    }
  }

  function choose(result: { name: string; lng: number; lat: number }) {
    // A new start makes a route stale; a halo round the store still holds.
    if (abortRef.current?.kind === "route") cancel();
    const next = { name: result.name, lng: result.lng, lat: result.lat };
    setOrigin(next);
    setTrip(null);
    setError(null);
    const nearest = visibleStores(stores, { bounds: null, origin: next, lang })[0];
    setAnnouncement(nearest ? copy.announceNearest(next.name, storeName(nearest.feature, lang), formatDistance(nearest.distance!, lang)) : "");
  }

  function select(id: string | null) {
    // Picking the store already picked keeps its route, halo and answers.
    if (id === selected) return;
    cancel();
    setSelected(id);
    setTrip(null);
    setReach(null);
    setError(null);
    const picked = id ? stores.features.find((feature) => feature.properties.id === id) : null;
    setAnnouncement(picked ? copy.announcePick(storeName(picked, lang)) : "");
  }

  function pick(feature: StoreFeature) {
    select(feature.properties.id);
    map?.easeTo({
      center: feature.geometry.coordinates,
      zoom: Math.max(map.getZoom(), 13),
      offset: paddingOffset(padding()),
      duration: duration(),
    });
  }

  function showAll() {
    if (stores.features.length === 0) return;
    map?.fitBounds(pointsBounds(stores.features.map((feature) => feature.geometry.coordinates)), {
      padding: padding(),
      duration: duration(),
    });
  }

  function drawReach() {
    if (!store) return;
    void request(
      "reach",
      (signal) => router.isochrone(store.geometry.coordinates, { minutes: [driveMinutes], mode: "auto", signal }),
      (collection) => {
        const area = collection as LocatorReach;
        setReach(area);
        const frame = reachBounds(area);
        if (frame) map?.fitBounds(frame, { padding: padding(), duration: duration() });
      },
    );
  }

  function toggleReach() {
    if (reach) setReach(null);
    else drawReach();
  }

  function directions() {
    if (!origin || !store) return;
    void request(
      "route",
      (signal) => router.route([origin.lng, origin.lat], store.geometry.coordinates, { mode: "auto", signal }),
      (result) => {
        setTrip({ coordinates: result.geometry.coordinates, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds });
        map?.fitBounds(pointsBounds(result.geometry.coordinates), { padding: padding(), duration: duration() });
      },
    );
  }

  function leaveRow() {
    setHover((current) => (current?.from === "list" ? null : current));
  }

  const name = store ? storeName(store, lang) : "";
  const answer =
    store && reach
      ? origin
        ? inReach([origin.lng, origin.lat], reach)
          ? copy.reachInside(origin.name, driveMinutes, name)
          : copy.reachOutside(origin.name, driveMinutes, name)
        : copy.reachArea(driveMinutes, name)
      : null;
  const french = lang === "fr";

  return (
    <>
      <ClusterLayer
        mapId={LOCATOR_MAP_ID}
        id={LOCATOR_LAYERS.stores}
        data={stores}
        onClick={(event) => select(String(event.feature.properties.id))}
      />
      {reach ? <GeoJSONLayer mapId={LOCATOR_MAP_ID} id={LOCATOR_LAYERS.reach} data={reach} fillPaint={REACH_FILL} circlePaint={false} /> : null}
      {trip ? <DrawnRoute line={trip} /> : null}
      <GeoJSONLayer mapId={LOCATOR_MAP_ID} id={LOCATOR_LAYERS.focus} data={focus} fillPaint={false} linePaint={false} circlePaint={FOCUS_CIRCLE} />
      {/* The picked store: your pin (in --primary) with its name. */}
      {store ? (
        <Marker key={store.properties.id} mapId={LOCATOR_MAP_ID} lngLat={store.geometry.coordinates}>
          <MarkerLabel>{name}</MarkerLabel>
        </Marker>
      ) : null}
      {/* The searched place: a "you are here" dot in --foreground, so it never reads as a store. */}
      {origin && originLngLat ? (
        <Marker
          mapId={LOCATOR_MAP_ID}
          lngLat={originLngLat}
          markerContent={<span className="block size-4 rounded-full border-[3px] border-background bg-foreground" />}
        >
          <MarkerLabel>{origin.name}</MarkerLabel>
        </Marker>
      ) : null}
      <p data-testid="store-locator-announce" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {/* A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most half the map) that clears the attribution. */}
      <div
        ref={panelRef}
        className="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[22rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
      >
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {copy.title}
            </CardTitle>
            <CardDescription className="max-sm:hidden">{copy.intro}</CardDescription>
          </CardHeader>
          {/* The search, the picked store and the count stay put; only the list below them scrolls. On a phone the whole sheet scrolls. */}
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 max-sm:overflow-y-auto max-sm:overscroll-contain">
            <Geocoder
              mapId={LOCATOR_MAP_ID}
              apiKey={apiKey}
              gateway={gateway}
              lang={lang}
              placeholder={copy.search}
              proximity="map"
              flyToZoom={13}
              onSelect={choose}
            />
            {store ? (
              <section
                key={store.properties.id}
                aria-label={name}
                className="flex shrink-0 flex-col gap-3 border-y py-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-lg leading-tight font-semibold">{name}</p>
                    <p className="text-sm text-muted-foreground">{store.properties.address}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={copy.close} onClick={() => select(null)}>
                    <span aria-hidden="true">×</span>
                  </Button>
                </div>
                {day === null ? null : <p className="text-sm">{todayLine(store, day, lang)}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={!origin || pending !== null}
                    aria-describedby={origin ? undefined : hintId}
                    onClick={directions}
                  >
                    {copy.directions}
                  </Button>
                  <Button type="button" variant="outline" aria-pressed={reach !== null} disabled={pending !== null} onClick={toggleReach}>
                    {copy.reach(driveMinutes)}
                  </Button>
                </div>
                {/* Where the answers land, always there, so nothing jumps when one arrives. */}
                <div data-testid="store-locator-answer" aria-live="polite" className="flex min-h-10 flex-col justify-center gap-2">
                  {origin ? null : (
                    <p id={hintId} className="text-xs text-muted-foreground">
                      {copy.needOrigin}
                    </p>
                  )}
                  {pending ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner /> {pending === "route" ? copy.loadingRoute : copy.loadingReach}
                    </p>
                  ) : null}
                  {trip ? (
                    <p data-testid="store-locator-trip" className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums">{formatDuration(trip.durationSeconds, lang)}</span>{" "}
                      <span className="text-sm text-muted-foreground tabular-nums">{`${formatDistance(trip.distanceMeters, lang)} ${copy.byCar}`}</span>
                    </p>
                  ) : null}
                  {answer ? <p className="text-sm">{answer}</p> : null}
                  {error ? (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription className="flex flex-col items-start gap-2">
                        <span>{error.message}</span>
                        <Button type="button" variant="outline" size="sm" onClick={error.retry === "route" ? directions : drawReach}>
                          {copy.retry}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </section>
            ) : null}
            <div className="flex shrink-0 items-center gap-2">
              <p data-testid="store-locator-count" className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className={store ? "text-base font-semibold tabular-nums" : "text-2xl font-semibold tabular-nums"}>{rows.length}</span>{" "}
                <span className="text-sm text-muted-foreground">{copy.count(rows.length)}</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="sm:hidden"
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? copy.hideList : copy.showList}
              </Button>
            </div>
            <div id={listId} data-expanded={expanded} className="flex min-h-0 flex-1 flex-col max-sm:flex-none max-sm:data-[expanded=false]:hidden">
              <div ref={scrollRef} data-store-locator-scroll="" className="relative -mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 max-sm:flex-none max-sm:overflow-visible">
                {rows.length === 0 ? (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-sm text-muted-foreground">{copy.empty}</p>
                    <Button type="button" variant="outline" size="sm" onClick={showAll}>
                      {copy.allStores}
                    </Button>
                  </div>
                ) : (
                  <ul aria-label={copy.list} className="flex flex-col gap-0.5">
                    {rows.slice(0, LIST_LIMIT).map(({ feature, distance }) => {
                      const id = feature.properties.id;
                      const picked = id === selected;
                      return (
                        <li key={id}>
                          <Button
                            type="button"
                            variant={picked ? "secondary" : "ghost"}
                            aria-pressed={picked}
                            data-store-id={id}
                            data-hovered={hover?.id === id ? "true" : undefined}
                            className="h-auto w-full justify-between gap-3 py-2 text-left whitespace-normal transition-colors hover:bg-muted focus-visible:bg-muted data-[hovered=true]:bg-muted"
                            onClick={() => pick(feature)}
                            onMouseEnter={() => setHover({ id, from: "list" })}
                            onMouseLeave={leaveRow}
                            onFocus={() => setHover({ id, from: "list" })}
                            onBlur={leaveRow}
                          >
                            <span className="flex min-w-0 flex-col items-start gap-0.5">
                              <span className={picked ? "flex items-center gap-1.5 font-semibold" : "flex items-center gap-1.5 font-medium"}>
                                {/* Picked is shown by weight and a mark, not by colour alone. */}
                                {picked ? (
                                  <span aria-hidden="true" data-selected-mark="">
                                    ✓
                                  </span>
                                ) : null}
                                {storeName(feature, lang)}
                              </span>
                              <span className="min-h-4 text-xs font-normal text-muted-foreground">
                                {day === null ? "" : todayLine(feature, day, lang)}
                              </span>
                            </span>
                            {distance === null ? null : (
                              <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{formatDistance(distance, lang)}</span>
                            )}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {rows.length > LIST_LIMIT ? <p className="py-2 text-xs text-muted-foreground">{copy.capped(LIST_LIMIT)}</p> : null}
              </div>
            </div>
            <div data-testid="store-locator-credits" className="flex shrink-0 flex-col gap-1 text-xs text-muted-foreground">
              {stores === STORES ? (
                <p>
                  {copy.source}{" "}
                  <a className="underline underline-offset-2" href={STORES_SOURCE.url} target="_blank" rel="noreferrer">
                    {french ? STORES_SOURCE.name_fr : STORES_SOURCE.name}
                  </a>
                  .{" "}
                  <a className="underline underline-offset-2" href={STORES_SOURCE.licenceUrl} target="_blank" rel="noreferrer">
                    {french ? STORES_SOURCE.licence_fr : STORES_SOURCE.licence}
                  </a>
                </p>
              ) : null}
              <p>
                {copy.routesCredit}{" "}
                <a className="underline underline-offset-2" href={ROUTING_CREDIT.sourceUrl} target="_blank" rel="noreferrer">
                  {copy.osm}
                </a>
                ,{" "}
                <a className="underline underline-offset-2" href={ROUTING_CREDIT.licenceUrl} target="_blank" rel="noreferrer">
                  {copy.odbl}
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
