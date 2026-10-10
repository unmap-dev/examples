"use client";

/**
 * <DeliveryTracker> - a delivery-tracking page in one component. A full-bleed map with a living
 * arrival card floating on it (a bottom sheet on a phone): pick a branch, start the delivery, and
 * the route fills in behind a courier moving along it while the card counts down to the arrival
 * time and ticks off each stage of the trip.
 *
 * Composes the registry's map, route-line and marker-popup items on your shadcn Card, ToggleGroup,
 * Button, Alert and Spinner, in your tokens. "Start delivery" calls /route once per branch; the
 * courier is then played back along the route's own geometry at `speed` times real time, and a
 * restart replays the route it already has. Swap the playback for your fleet's live positions to
 * track real couriers.
 *
 * The depot and drop-offs are Ottawa Public Library branches (City of Ottawa open data, credited).
 * Installed by `npx shadcn add` with its page at app/delivery-tracker/page.tsx. Edit freely.
 */

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Router } from "@unmap/routing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map } from "@/components/ui/map";
import { Marker, MarkerLabel } from "@/components/ui/marker-popup";
import { RouteLine } from "@/components/ui/route-line";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMap } from "@/lib/map-context";

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

export interface DeliveryTrackerProps {
  /** unmap API key. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** Playback speed: trip seconds per real second, at least 1. Defaults to 30, so a ten-minute trip plays in twenty seconds. */
  speed?: number;
  /** Language of the copy, the times and the stop names. Defaults to "en". */
  lang?: TrackerLang;
  className?: string;
}

/** A route as /route answered it, kept per branch so a restart replays it without asking again. */
type Answer = { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number };
/** A delivery on its way: the route, when it left and where it goes. */
type Delivery = Answer & { startedAt: number; stop: TrackerStop };
type StepState = "done" | "current" | "upcoming";

export function DeliveryTracker({ apiKey, gateway, speed = DEFAULT_SPEED, lang = "en", className }: DeliveryTrackerProps) {
  if (!apiKey.trim()) {
    const copy = TRACKER_COPY[lang];
    // Where the map would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="delivery-tracker"
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
    <div data-unmap-block="delivery-tracker" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map id={TRACKER_MAP_ID} apiKey={apiKey} gateway={gateway} center={DOWNTOWN_OTTAWA} zoom={13} lang={lang} className="h-full">
        <Tracker apiKey={apiKey} gateway={gateway} speed={playbackSpeed(speed)} lang={lang} />
      </Map>
    </div>
  );
}

/**
 * Where the trip is, read from the clock. Only the components that call this re-render as the
 * parcel moves: the line and the parcel on the map, the headline and the stages. The branch list
 * and the credits stay put.
 */
function useTrip(clock: TripClock, delivery: Delivery | null) {
  const played = useSyncExternalStore(clock.subscribe, clock.get, () => 0);
  if (!delivery) return { progress: 0, stage: null, remaining: 0 };
  const total = delivery.durationSeconds;
  const progress = shownProgress(Math.min(1, played / total), total, prefersReducedMotion());
  return { progress, stage: trackerStage(progress, total), remaining: total * (1 - progress) };
}

/** The route filling in, and the parcel on it. */
function TripOnMap({ clock, delivery, lang, side }: { clock: TripClock; delivery: Delivery; lang: TrackerLang; side: "left" | "right" }) {
  const { progress, stage } = useTrip(clock, delivery);
  const courier = useMemo(() => (stage === "done" ? null : pointAt(delivery.coordinates, progress)), [delivery, progress, stage]);
  return (
    <>
      <RouteLine mapId={TRACKER_MAP_ID} id={TRACKER_ROUTE_ID} coordinates={delivery.coordinates} progress={progress} />
      {courier ? (
        <Marker
          mapId={TRACKER_MAP_ID}
          lngLat={courier}
          markerContent={
            <span className="relative flex size-6 items-center justify-center">
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-primary/25 motion-safe:animate-ping" />
              <span className="relative size-3.5 rounded-full border-2 border-background bg-primary" />
            </span>
          }
        >
          {/* The parcel's name trails behind it, on the side away from the depot's, so the two never meet as it leaves. */}
          <MarkerLabel position={side}>{TRACKER_COPY[lang].courier}</MarkerLabel>
        </Marker>
      ) : null}
    </>
  );
}

/** The headline: when the parcel arrives, what is left, and how much of the trip is behind it. */
function Headline({ clock, delivery, lang }: { clock: TripClock; delivery: Delivery; lang: TrackerLang }) {
  const copy = TRACKER_COPY[lang];
  const { progress, stage, remaining } = useTrip(clock, delivery);
  const done = stage === "done";
  // Clock text exists only once a delivery started, in the browser: the server render has none.
  const arrival = formatClock(delivery.startedAt + delivery.durationSeconds * 1000, lang);
  return (
    <section aria-label={copy.arrival} className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      <div className="flex items-baseline gap-2">
        {done ? (
          <span aria-hidden="true" className="text-2xl leading-none text-primary">
            ✓
          </span>
        ) : null}
        <p data-testid="tracker-eta" className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">{done ? copy.deliveredAt : copy.arrivesAt}</span>{" "}
          <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">{arrival}</span>
        </p>
      </div>
      <p data-testid="tracker-left" className="text-sm tabular-nums">
        {done ? (
          <span className="text-muted-foreground">{`${stopName(delivery.stop, lang)}, ${delivery.stop.address.split(",")[0]}`}</span>
        ) : (
          <>
            <span className="font-medium">{formatRemaining(remaining, lang)}</span>
            <span className="text-muted-foreground">{`, ${copy.toGo(formatDistance(delivery.distanceMeters * (1 - progress), lang))}`}</span>
          </>
        )}
      </p>
      {/* The line on the map, echoed: how much of the trip is behind the parcel. */}
      <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
      </div>
    </section>
  );
}

/**
 * The trip's four stages. Always there, so the card keeps its shape: before a delivery they
 * preview the trip to the picked branch, none of them reached.
 */
function Stages({ clock, delivery, target, lang }: { clock: TripClock; delivery: Delivery | null; target: TrackerStop; lang: TrackerLang }) {
  const copy = TRACKER_COPY[lang];
  const { stage } = useTrip(clock, delivery);
  const done = stage === "done";
  const depot = stopName(DEPOT, lang);
  const steps: Array<{ key: string; label: string; time: string; state: StepState }> = delivery
    ? [
        { key: "departed", label: copy.departed(depot), time: formatClock(delivery.startedAt, lang), state: "done" },
        { key: "way", label: copy.onTheWay, time: "", state: stage === "way" ? "current" : "done" },
        { key: "soon", label: copy.almost, time: "", state: stage === "soon" ? "current" : done ? "done" : "upcoming" },
        {
          key: "at",
          label: copy.at(stopName(delivery.stop, lang)),
          time: formatClock(delivery.startedAt + delivery.durationSeconds * 1000, lang),
          state: done ? "done" : "upcoming",
        },
      ]
    : [
        { key: "departed", label: copy.departs(depot), time: "", state: "upcoming" },
        { key: "way", label: copy.onTheWay, time: "", state: "upcoming" },
        { key: "soon", label: copy.almost, time: "", state: "upcoming" },
        { key: "at", label: copy.at(stopName(target, lang)), time: "", state: "upcoming" },
      ];
  return (
    <ol aria-label={copy.progress} className="flex flex-col">
      {steps.map((step, index) => (
        <li
          key={step.key}
          data-state={step.state}
          aria-current={step.state === "current" ? "step" : undefined}
          className="relative flex items-center gap-3 py-1 text-sm data-[state=upcoming]:text-muted-foreground data-[state=current]:font-medium"
        >
          {/* The rail between stages, filled once the stage above it is behind the parcel. */}
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              data-state={step.state}
              className="absolute top-1/2 left-2 h-full -translate-x-1/2 border-l-2 border-dashed border-border data-[state=done]:border-solid data-[state=done]:border-primary"
            />
          ) : null}
          <span
            aria-hidden="true"
            data-state={step.state}
            className="relative flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-[0.625rem] leading-none data-[state=current]:border-primary data-[state=done]:border-primary data-[state=done]:bg-primary data-[state=done]:text-primary-foreground"
          >
            {step.state === "done" ? "✓" : step.state === "current" ? <span className="size-1.5 rounded-full bg-primary" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            {step.label}
            {step.state === "done" ? <span className="sr-only"> {copy.stepDone}</span> : null}
          </span>
          {/* Always rendered, so a time arriving never reflows the row. */}
          <span className="min-w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{step.time}</span>
        </li>
      ))}
    </ol>
  );
}

/** Tells the block when the trip reaches a new stage, so it speaks once per stage, never per tick. */
function StageWatch({
  clock,
  delivery,
  onStage,
}: {
  clock: TripClock;
  delivery: Delivery;
  onStage: (delivery: Delivery, stage: TrackerStage, remaining: number) => void;
}) {
  const { stage, remaining } = useTrip(clock, delivery);
  useEffect(() => {
    if (stage) onStage(delivery, stage, remaining);
    // Only a new stage (or a new delivery) is news.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, stage]);
  return null;
}

/** Everything that needs the map. It renders inside <Map>, where useMap() can see it. */
function Tracker({ apiKey, gateway, speed, lang }: { apiKey: string; gateway?: string; speed: number; lang: TrackerLang }) {
  const copy = TRACKER_COPY[lang];
  const map = useMap(TRACKER_MAP_ID);
  const router = useMemo(() => new Router({ key: apiKey, gateway }), [apiKey, gateway]);
  // Each branch's route, asked once per key: a restart replays it rather than paying for it again.
  const routes = useMemo(() => {
    void router;
    return new globalThis.Map<string, Answer>();
  }, [router]);
  const [clock] = useState(() => createTripClock());
  const [stopId, setStopId] = useState(DROP_OFFS[0]!.id);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One polite sentence per stage of the trip, never one per tick.
  const [said, setSaid] = useState("");
  // On a phone the sheet can fold to the headline, to give the map back.
  const [folded, setFolded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  const announcedFor = useRef<{ delivery: Delivery | null; stage: TrackerStage | null }>({ delivery: null, stage: null });
  const bodyId = useId();
  const addressIds = useId();

  const picked = DROP_OFFS.find((stop) => stop.id === stopId) ?? DROP_OFFS[0]!;
  const target = delivery?.stop ?? picked;
  const isFolded = folded && delivery !== null;

  function padding(gutter = GUTTER): TrackerPadding {
    const container = map?.getContainer();
    if (!container) return panelPadding({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }, null, gutter);
    return panelPadding(container.getBoundingClientRect(), panelRef.current?.getBoundingClientRect() ?? null, gutter);
  }
  const duration = () => (prefersReducedMotion() ? 0 : CAMERA_MS);
  function frame(coordinates: [number, number][]) {
    const height = map?.getContainer().getBoundingClientRect().height ?? 0;
    map?.fitBounds(lineBounds(coordinates), { padding: withPinRoom(padding(FRAME_GUTTER), height), maxZoom: ROUTE_MAX_ZOOM, duration: duration() });
  }

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
      clock.stop();
    },
    [clock],
  );

  useEffect(() => {
    clock.setSpeed(speed);
  }, [clock, speed]);

  // The map opens on every branch, clear of the panel.
  useEffect(() => {
    const height = map?.getContainer().getBoundingClientRect().height ?? 0;
    map?.fitBounds(STOPS_BOUNDS, { padding: withPinRoom(padding(FRAME_GUTTER), height), maxZoom: ROUTE_MAX_ZOOM, duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // A new route is framed once it is on screen, so the panel has its final size.
  useEffect(() => {
    if (delivery) frame(delivery.coordinates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery]);

  // Folding or unfolding the sheet changes how much map there is: frame the route again.
  const wasFolded = useRef(isFolded);
  useEffect(() => {
    if (wasFolded.current === isFolded) return;
    wasFolded.current = isFolded;
    if (delivery) frame(delivery.coordinates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFolded]);

  // Say when the delivery starts, when it is almost there, and when it lands; nothing in between.
  function onStage(current: Delivery, stage: TrackerStage, remaining: number) {
    const before = announcedFor.current;
    if (before.delivery === current && before.stage === stage) return;
    announcedFor.current = { delivery: current, stage };
    const name = stopName(current.stop, lang);
    const arrival = formatClock(current.startedAt + current.durationSeconds * 1000, lang);
    const left = midSentence(formatRemaining(remaining, lang));
    if (stage === "done") setSaid(copy.announceDone(name, arrival));
    else if (before.delivery !== current) setSaid(copy.announceStart(name, arrival, left));
    else if (stage === "soon") setSaid(copy.announceSoon(name, left));
  }

  function choose(value: unknown) {
    const next = DROP_OFFS.find((stop) => stop.id === value);
    if (next) setStopId(next.id);
  }

  function unhover(id: string) {
    setHoveredId((current) => (current === id ? null : current));
  }

  /** Plays a route from its start: the clock first, so nothing reads the last trip's time against this one. */
  function begin(stop: TrackerStop, answer: Answer) {
    clock.run(answer.durationSeconds, speed);
    setDelivery({ ...answer, startedAt: Date.now(), stop });
  }

  async function start() {
    abortRef.current?.abort();
    abortRef.current = null;
    const stop = picked;
    setError(null);
    setFolded(false);
    const known = routes.get(stop.id);
    if (known) {
      setLoading(false);
      begin(stop, known);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    // The running parcel stops where it is; its route and stages stay until the new route lands.
    clock.stop();
    setLoading(true);
    setSaid(copy.loading);
    try {
      const result = await router.route(DEPOT.lngLat, stop.lngLat, { mode: "auto", signal: controller.signal });
      if (abortRef.current !== controller) return;
      const answer: Answer = {
        coordinates: result.geometry.coordinates as [number, number][],
        distanceMeters: result.distanceMeters,
        durationSeconds: Math.max(1, result.durationSeconds),
      };
      routes.set(stop.id, answer);
      begin(stop, answer);
    } catch (caught) {
      if (abortRef.current === controller && !isAbort(caught)) {
        setError(requestError(caught, lang));
        setSaid("");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }

  function retry() {
    // The alert goes away with the retry: focus lands on the action, which stays where it is.
    actionRef.current?.focus();
    void start();
  }

  const depotSide = labelSide(DEPOT, target);
  const targetSide = labelSide(target, DEPOT);
  const courierSide = depotSide === "right" ? "left" : "right";

  return (
    <>
      {delivery ? <TripOnMap clock={clock} delivery={delivery} lang={lang} side={courierSide} /> : null}
      {delivery ? <StageWatch clock={clock} delivery={delivery} onStage={onStage} /> : null}
      {/* The depot: a dot in --foreground. The drop-off: your pin in --primary. The other branches: quiet rings. Each named where it matters. */}
      <Marker
        mapId={TRACKER_MAP_ID}
        lngLat={DEPOT.lngLat}
        markerContent={<span className="block size-4 rounded-full border-[3px] border-background bg-foreground" />}
      >
        <MarkerLabel position={depotSide}>{stopName(DEPOT, lang)}</MarkerLabel>
      </Marker>
      {DROP_OFFS.map((stop) => {
        if (stop.id === target.id) {
          return (
            <Marker key={`${stop.id}:target`} mapId={TRACKER_MAP_ID} lngLat={stop.lngLat} onClick={() => choose(stop.id)}>
              <MarkerLabel position={targetSide}>{stopName(stop, lang)}</MarkerLabel>
            </Marker>
          );
        }
        const lit = stop.id === picked.id || stop.id === hoveredId;
        return (
          <Marker
            key={`${stop.id}:ring`}
            mapId={TRACKER_MAP_ID}
            lngLat={stop.lngLat}
            onClick={() => choose(stop.id)}
            markerContent={
              // Hovering the ring lights its row in the list, as hovering the row names the ring.
              <span
                data-lit={lit}
                onPointerEnter={() => setHoveredId(stop.id)}
                onPointerLeave={() => unhover(stop.id)}
                className="block size-3 rounded-full border-2 border-muted-foreground bg-background transition-transform data-[lit=true]:scale-125 data-[lit=true]:border-primary"
              />
            }
          >
            {lit ? <MarkerLabel position="right">{stopName(stop, lang)}</MarkerLabel> : null}
          </Marker>
        );
      })}
      <p data-testid="tracker-announce" aria-live="polite" aria-atomic="true" className="sr-only">
        {said}
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
              {delivery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 sm:hidden"
                  aria-expanded={!isFolded}
                  aria-controls={bodyId}
                  onClick={() => setFolded((current) => !current)}
                >
                  {isFolded ? copy.unfold : copy.fold}
                </Button>
              ) : null}
            </div>
            <CardDescription data-folded={isFolded} className="flex items-center gap-2 max-sm:data-[folded=true]:hidden">
              <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-foreground" />
              {copy.from(stopName(DEPOT, lang))}
              <span className="min-w-0 truncate">{`· ${DEPOT.address.split(",")[0]}`}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            {/* The headline: always there and tall enough for the answer, an error and its retry, so nothing jumps when it arrives. */}
            <div data-testid="tracker-answer" className="flex min-h-20 shrink-0 flex-col justify-center gap-2">
              {error ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">{error}</span>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={retry}>
                      {copy.retry}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : loading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> <span>{copy.loading}</span>
                </p>
              ) : delivery ? (
                <Headline clock={clock} delivery={delivery} lang={lang} />
              ) : (
                <p className="text-sm text-muted-foreground">{copy.empty}</p>
              )}
            </div>
            {/* Below the headline the branches, the trip's stages and the credits scroll; the action stays put. Every section is always there, so Start and Restart never move anything. */}
            <div
              id={bodyId}
              data-testid="tracker-body"
              data-folded={isFolded}
              className="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-2 max-sm:data-[folded=true]:hidden"
            >
              {/*
                Stock toggle-group.tsx keeps `orientation` for its own styling and does not hand it
                to Base UI, so the arrow keys stay Left and Right; pass `orientation={orientation}`
                to ToggleGroupPrimitive there and Up and Down move through this list.
              */}
              <ToggleGroup
                aria-label={copy.dropOff}
                orientation="vertical"
                spacing={1}
                value={[stopId]}
                onValueChange={(value: unknown[]) => choose(value[0])}
                className="w-full flex-col items-stretch"
              >
                {DROP_OFFS.map((stop, index) => {
                  const on = stop.id === stopId;
                  const addressId = `${addressIds}-${index}`;
                  return (
                    <ToggleGroupItem
                      key={stop.id}
                      value={stop.id}
                      aria-describedby={addressId}
                      data-lit={hoveredId === stop.id}
                      onPointerEnter={() => setHoveredId(stop.id)}
                      onPointerLeave={() => unhover(stop.id)}
                      onFocus={() => setHoveredId(stop.id)}
                      onBlur={() => unhover(stop.id)}
                      className="h-auto w-full justify-start gap-3 py-2 text-left aria-pressed:font-semibold data-[lit=true]:bg-muted"
                    >
                      {/* Picked is marked by a check as well as the fill, and matches the pin on the map. */}
                      <span
                        aria-hidden="true"
                        data-on={on}
                        className="flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-[0.625rem] leading-none data-[on=true]:border-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"
                      >
                        {on ? "✓" : null}
                      </span>
                      <span className="min-w-0">{stopName(stop, lang)}</span>{" "}
                      <span id={addressId} aria-hidden="true" className="ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground">
                        {stop.address.split(",")[0]}
                      </span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              <div data-testid="tracker-stages" className="flex flex-col gap-2 border-t pt-3">
                <Stages clock={clock} delivery={delivery} target={target} lang={lang} />
                <p className="text-xs text-muted-foreground">
                  {copy.replay(speed)} {copy.replayHow}
                </p>
              </div>
              <div data-testid="tracker-credits" className="flex flex-col gap-1 text-xs text-muted-foreground">
                <p>
                  {copy.stopsCredit}{" "}
                  <a className="underline underline-offset-2" href={STOPS_CREDIT.url} target="_blank" rel="noreferrer">
                    {lang === "fr" ? STOPS_CREDIT.name_fr : STOPS_CREDIT.name}
                  </a>
                  .{" "}
                  <a className="underline underline-offset-2" href={STOPS_CREDIT.licenceUrl} target="_blank" rel="noreferrer">
                    {lang === "fr" ? STOPS_CREDIT.licence_fr : STOPS_CREDIT.licence}
                  </a>
                </p>
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
            </div>
            {/* aria-disabled, not disabled, while routing: a disabled button would drop the reader's focus. */}
            <Button
              ref={actionRef}
              type="button"
              data-testid="tracker-action"
              aria-disabled={loading || undefined}
              data-folded={isFolded}
              className="w-full shrink-0 aria-disabled:opacity-50 max-sm:data-[folded=true]:hidden"
              onClick={() => {
                if (!loading) void start();
              }}
            >
              {delivery && delivery.stop.id === stopId ? copy.restart : copy.start}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
