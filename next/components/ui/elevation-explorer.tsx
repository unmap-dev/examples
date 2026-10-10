"use client";

/**
 * <ElevationExplorer> - an elevation page in one component. The chart is the second half of the
 * map: pick a mountain trip, route your own by bike, or draw a line, and its profile from unmap's
 * elevation API runs along the bottom while the line on the map takes the colour of its
 * grade. Hover either half and the other answers: the chart follows the line, and the map shows
 * the height and the grade at the point the chart is on.
 *
 * Composes the registry's map, geocoder, draw, elevation-profile, route-line and marker-popup
 * items on your shadcn Card, ToggleGroup, Button, Alert and Spinner, in your tokens. Each request
 * is billed, so each answer is asked for once and remembered for the life of the block: a trip
 * calls /route once; the search boxes call /geocode/autocomplete as you type, and
 * /geocode/reverse when you type coordinates; drawing calls nothing; each new line's profile is
 * one /elevation request for up to 500 samples (elevation-profile's default spacing), and a line
 * shown again comes from the block's profile cache. The grade colours come from the profile's own
 * samples, so they cost nothing extra.
 *
 * Installed by `npx shadcn add` with its page at app/elevation-explorer/page.tsx. Edit freely.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Router } from "@unmap/routing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Draw, type DrawValue } from "@/components/ui/draw";
import { ElevationProfile, type ProfilePoint } from "@/components/ui/elevation-profile";
import { Geocoder } from "@/components/ui/geocoder";
import { Map } from "@/components/ui/map";
import { Marker, MarkerLabel } from "@/components/ui/marker-popup";
import { RouteLine } from "@/components/ui/route-line";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMap, useMapGeneration } from "@/lib/map-context";

// --- elevation-explorer helpers (kept identical across both lanes) ---
export type ExplorerLang = "en" | "fr";
export type ExplorerSource = "preset" | "route" | "draw";

/** A named place: a preset's end, or one chosen in a search box. */
export interface ExplorerPlace {
  name: string;
  lngLat: [number, number];
}

export interface ExplorerPreset {
  id: string;
  from: ExplorerPlace;
  to: ExplorerPlace;
}

/** A profile sample as elevation-profile reports it: metres along the line, the height there, and where it is. */
export interface ExplorerPoint {
  distance: number;
  elevation: number | null;
  lng?: number;
  lat?: number;
}

/** The sample under the pointer, on the chart or on the line, as elevation-profile reports it. */
export interface ExplorerHover extends ExplorerPoint {
  index: number;
  lng: number;
  lat: number;
}

/** The part of a drawing this block reads. */
export interface DrawnShapes {
  features: Array<{ geometry: { type: string; coordinates: unknown } | null }>;
}

/** A routed line, as /route answers it. */
export interface ExplorerTrip {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface ExplorerRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as fitBounds takes it. */
export interface ExplorerPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const EXPLORER_SOURCES: ExplorerSource[] = ["preset", "route", "draw"];

/**
 * Three trips through the mountains. Endpoints from the Canadian Geographical Names Database
 * (Natural Resources Canada): Lake Louise IACFT, Jasper IAMCJ, Squamish JCVCJ, Whistler JCJHI,
 * Calgary IAKID, Banff IACYE. Open Government Licence, Canada.
 */
export const EXPLORER_PRESETS: ExplorerPreset[] = [
  {
    id: "icefields-parkway",
    from: { name: "Lake Louise", lngLat: [-116.18056, 51.42528] },
    to: { name: "Jasper", lngLat: [-118.08306, 52.87778] },
  },
  {
    id: "sea-to-sky",
    from: { name: "Squamish", lngLat: [-123.15583, 49.69806] },
    to: { name: "Whistler", lngLat: [-122.95472, 50.11722] },
  },
  {
    id: "calgary-banff",
    from: { name: "Calgary", lngLat: [-114.0575, 51.04583] },
    to: { name: "Banff", lngLat: [-115.57361, 51.17778] },
  },
];

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const EXPLORER_MAP_ID = "elevation-explorer";
/** Source ids (and layer-id prefixes) of what the block draws. */
export const EXPLORER_LAYERS = { line: "elevation-explorer-line", draw: "elevation-explorer-draw", profile: "elevation-explorer-profile" };

/** The trips are drives; your own route is by bike, where the grade is what you feel. */
export const PRESET_MODE = "auto";
export const ROUTE_MODE = "bicycle";

/** The drawing tool offers lines only: a profile needs a line. */
export const LINE_ONLY: ["linestring"] = ["linestring"];

/** The grade range the line's colours span, in percent; steeper stretches take the end colours. */
export const GRADE_DOMAIN: [number, number] = [-10, 10];

/** A sample-to-sample grade past this is elevation-model noise (a bridge deck, a cliff edge), not road. */
export const MAX_GRADE = 25;

/** The shortest run a grade is read over, in metres: a single 30 m cell of noise cannot spike it. */
export const GRADE_RUN = 200;

/**
 * The grade's ramp, in your own tokens: descents in --primary, flat in --muted-foreground, climbs
 * in --destructive, mixed in between. route-line spreads a gradient over --chart-1 to --chart-5,
 * which in a stock theme are categorical colours in no order; this remaps them on the map (the
 * block's <Map className>), so the line and the legend inside the map read the same ordered ramp
 * and your charts elsewhere keep theirs.
 */
export const GRADE_TOKENS =
  "[--chart-1:var(--primary)] [--chart-2:color-mix(in_oklab,var(--primary),var(--muted-foreground))] [--chart-3:var(--muted-foreground)] [--chart-4:color-mix(in_oklab,var(--destructive),var(--muted-foreground))] [--chart-5:var(--destructive)]";

/** The legend's bar: the same five tokens, as GRADE_TOKENS sets them inside the map. */
export const GRADE_RAMP =
  "linear-gradient(to right, var(--chart-1), var(--chart-2), var(--chart-3), var(--chart-4), var(--chart-5))";

/** Banff, between the three presets. */
export const BANFF: [number, number] = [-115.5708, 51.1784];

/** Where each credit links, per language. */
export const EXPLORER_CREDITS = {
  elevation: { en: "https://unmap.dev/attribution", fr: "https://unmap.dev/fr/attribution" },
  licence: {
    en: "https://open.canada.ca/en/open-government-licence-canada",
    fr: "https://ouvert.canada.ca/fr/licence-du-gouvernement-ouvert-canada",
  },
  names: {
    en: "https://open.canada.ca/data/en/dataset/e27c6eba-3c5d-4051-9db2-082dc6411c2c",
    fr: "https://ouvert.canada.ca/data/fr/dataset/e27c6eba-3c5d-4051-9db2-082dc6411c2c",
  },
  routes: { source: "https://www.openstreetmap.org/copyright", licence: "https://opendatacommons.org/licenses/odbl/" },
};

/** The panels' inset from the map edge, and the gutter a framed line keeps (room for the names beside its pins). */
export const GUTTER = 24;
export const FRAME_GUTTER = 48;
/** Camera moves, in milliseconds. Reduced motion jumps. */
export const CAMERA_MS = 800;
/** The closest a line is framed. */
export const ROUTE_MAX_ZOOM = 14;
/** The least map, in pixels, a padded camera must have before it tightens its gutter. */
const MIN_FRAME = 120;
/** The tightened gutter, and the least strip the camera keeps to frame in beside a tall panel. */
const TIGHT = 8;
const MIN_STRIP = 32;

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

export const EXPLORER_COPY = {
  en: {
    title: "See the climb",
    intro: "Pick a trip, route your own or draw a line. The chart and the line show every climb.",
    source: "Line from",
    sources: { preset: "Trips", route: "Route", draw: "Draw" },
    between: (from: string, to: string) => `${from} to ${to}`,
    roads: { "icefields-parkway": "Icefields Parkway", "sea-to-sky": "Sea-to-Sky Highway", "calgary-banff": "Trans-Canada Highway" } as Record<string, string>,
    pickTrip: "Pick a trip to see its climb.",
    from: "Choose a start",
    to: "Choose a destination",
    byBike: "Routed by bike, where the grade counts. Routing covers Canada.",
    needEnds: "Choose a start and a destination.",
    drawHint: "Pick Line in the drawing tools at the top right, click along your path, then double-click or press Enter to finish.",
    drawn: "Your line",
    loading: "Finding the route...",
    by: { auto: "by car", bicycle: "by bike" },
    profile: "Elevation profile",
    hoverHint: "Hover the chart or the line to read the grade.",
    grade: "Grade",
    down: "down",
    up: "up",
    at: (distance: string, height: string, grade: string) => `At ${distance}: ${height}${grade ? `, grade ${grade}` : ""}`,
    steepest: (grade: string, distance: string) => `Steepest climb: ${grade} at ${distance}`,
    noClimb: "No climb along this line.",
    noHeight: "no data",
    climb: (unit: string) => `${unit} of climb`,
    announce: (name: string, distance: string, gain: string, steepest: string) =>
      `${name}: ${distance}, ${gain} of climb${steepest ? `, steepest climb ${steepest}` : ""}.`,
    fold: "Hide details",
    unfold: "Show details",
    retry: "Try again",
    namesCredit: "Trip ends:",
    namesSource: "Canadian Geographical Names Database",
    elevationCredit: "Elevation:",
    elevationSource: "DEM suppliers and licences",
    licence: "Open Government Licence – Canada",
    routesCredit: "Routes:",
    routesSource: "OpenStreetMap contributors",
    routesLicence: "ODbL",
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
    title: "Voir le dénivelé",
    intro: "Choisissez un trajet, tracez votre itinéraire ou dessinez une ligne. Le graphique et la ligne montrent chaque montée.",
    source: "Ligne tirée de",
    sources: { preset: "Trajets", route: "Itinéraire", draw: "Dessin" },
    between: (from: string, to: string) => `De ${from} à ${to}`,
    roads: { "icefields-parkway": "Promenade des Glaciers", "sea-to-sky": "Autoroute Sea-to-Sky", "calgary-banff": "Route transcanadienne" } as Record<string, string>,
    pickTrip: "Choisissez un trajet pour voir son dénivelé.",
    from: "Choisir un départ",
    to: "Choisir une destination",
    byBike: "Itinéraire à vélo, là où la pente compte. Les itinéraires couvrent le Canada.",
    needEnds: "Choisissez un départ et une destination.",
    drawHint: "Choisissez Ligne dans les outils de dessin en haut à droite, cliquez le long du tracé, puis double-cliquez ou appuyez sur Entrée pour terminer.",
    drawn: "Votre ligne",
    loading: "Calcul de l'itinéraire...",
    by: { auto: "en voiture", bicycle: "à vélo" },
    profile: "Profil d'altitude",
    hoverHint: "Survolez le graphique ou la ligne pour lire la pente.",
    grade: "Pente",
    down: "descente",
    up: "montée",
    at: (distance: string, height: string, grade: string) => `À ${distance} : ${height}${grade ? `, pente ${grade}` : ""}`,
    steepest: (grade: string, distance: string) => `Montée la plus raide : ${grade} à ${distance}`,
    noClimb: "Aucune montée sur cette ligne.",
    noHeight: "aucune donnée",
    climb: (unit: string) => `${unit} de montée`,
    announce: (name: string, distance: string, gain: string, steepest: string) =>
      `${name} : ${distance}, ${gain} de montée${steepest ? `, montée la plus raide ${steepest}` : ""}.`,
    fold: "Masquer les détails",
    unfold: "Afficher les détails",
    retry: "Réessayer",
    namesCredit: "Extrémités des trajets :",
    namesSource: "Base de données toponymiques du Canada",
    elevationCredit: "Altitude :",
    elevationSource: "Fournisseurs du MNA et licences",
    licence: "Licence du gouvernement ouvert – Canada",
    routesCredit: "Itinéraires :",
    routesSource: "contributeurs d'OpenStreetMap",
    routesLicence: "ODbL",
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

export function isSource(value: unknown): value is ExplorerSource {
  return EXPLORER_SOURCES.includes(value as ExplorerSource);
}

/** A place as a primitive, so the same place chosen again is the same place. */
export function placeKey(place: ExplorerPlace): string {
  return `${place.lngLat[0]},${place.lngLat[1]}`;
}

/** The last line in a drawing, or null when it has none. */
export function lastLine(shapes: DrawnShapes | null | undefined): [number, number][] | null {
  const lines = (shapes?.features ?? []).filter((feature) => feature.geometry?.type === "LineString");
  const last = lines[lines.length - 1];
  return last?.geometry ? (last.geometry.coordinates as [number, number][]) : null;
}

const EARTH_RADIUS_M = 6_371_008.8;

function haversineMetres(a: [number, number], b: [number, number]): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Length of a line in metres. */
export function lineLength(coordinates: [number, number][]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index++) total += haversineMetres(coordinates[index - 1]!, coordinates[index]!);
  return total;
}

function clampGrade(grade: number): number {
  return Math.max(-MAX_GRADE, Math.min(MAX_GRADE, grade));
}

/**
 * The grade from sample `low` to sample `high`, widened both ways until it spans at least `run`
 * metres. Null where either end has no height, or the samples do not advance.
 */
function windowGrade(points: ExplorerPoint[], low: number, high: number, run: number): number | null {
  const last = points.length - 1;
  while (points[high]!.distance - points[low]!.distance < run && (low > 0 || high < last)) {
    if (low > 0) low -= 1;
    if (high < last && points[high]!.distance - points[low]!.distance < run) high += 1;
  }
  const start = points[low]!;
  const end = points[high]!;
  const span = end.distance - start.distance;
  if (span <= 0 || start.elevation === null || end.elevation === null) return null;
  return clampGrade(((end.elevation - start.elevation) / span) * 100);
}

/**
 * Grade in percent at each vertex of `coordinates`, from the profile's samples: each vertex takes
 * the grade of the sample-to-sample stretch its distance along the line falls in (half a metre of
 * slack at a boundary). With a `run`, each stretch is read over at least that many metres around
 * it, as the hover readout is. A stretch with a missing height counts as flat, and one steeper than
 * MAX_GRADE is clamped. Null when no stretch has two heights, so the line draws plain.
 */
export function gradesAlong(coordinates: [number, number][], points: ExplorerPoint[], run = 0): number[] | null {
  const grades = points.map((_point, index): number | null => (index > 0 ? windowGrade(points, index - 1, index, run) : null));
  if (!grades.some((grade) => grade !== null)) return null;
  let travelled = 0;
  let stretch = 1;
  return coordinates.map((vertex, index) => {
    if (index > 0) travelled += haversineMetres(coordinates[index - 1]!, vertex);
    while (stretch < points.length - 1 && points[stretch]!.distance < travelled - 0.5) stretch += 1;
    return grades[stretch] ?? 0;
  });
}

/**
 * The line to colour, and a grade for each of its points. The profile's samples (which lie on the
 * line) are merged in between its vertices, so a drawn line of four clicks still changes colour
 * wherever the ground does, and a route keeps every bend. Samples without a position leave the
 * line as it is. Null when there is no grade to draw.
 */
export function gradedLine(coordinates: [number, number][], points: ExplorerPoint[]): { coordinates: [number, number][]; values: number[] } | null {
  let merged = coordinates;
  if (points.length > 0 && points.every((point) => typeof point.lng === "number" && typeof point.lat === "number")) {
    merged = [];
    let travelled = 0;
    let next = 0;
    coordinates.forEach((vertex, index) => {
      if (index > 0) travelled += haversineMetres(coordinates[index - 1]!, vertex);
      while (next < points.length && points[next]!.distance < travelled - 0.5) {
        merged.push([points[next]!.lng!, points[next]!.lat!]);
        next += 1;
      }
      merged.push(vertex);
      // A sample on the vertex itself adds nothing.
      while (next < points.length && Math.abs(points[next]!.distance - travelled) <= 0.5) next += 1;
    });
  }
  // Over the same run as the hover readout, so the colour under the pointer says what the readout does.
  const values = gradesAlong(merged, points, GRADE_RUN);
  return values ? { coordinates: merged, values } : null;
}

/**
 * The grade at one sample, read over at least `run` metres around it (widening both ways), so a
 * reading is never one 30 m cell of noise. Null where either end of that run has no height.
 */
export function gradeAt(points: ExplorerPoint[], index: number, run = GRADE_RUN): number | null {
  if (!points[index] || points[index]!.elevation === null) return null;
  return windowGrade(points, index, index, run);
}

/**
 * Whether a profile belongs to `line`: its first sample sits on the line's start, within the
 * couple of metres the profile's rounding allows. Samples without a position are taken.
 */
export function profileBelongs(points: ExplorerPoint[], line: [number, number][]): boolean {
  const first = points[0];
  const start = line[0];
  if (!first || !start || typeof first.lng !== "number" || typeof first.lat !== "number") return true;
  return haversineMetres([first.lng, first.lat], start) <= 2;
}

/** The steepest climb over any run of at least `run` metres, and the distance at its middle. Null when nothing climbs. */
export function steepestClimb(points: ExplorerPoint[], run = GRADE_RUN): { grade: number; distance: number } | null {
  let best: { grade: number; distance: number } | null = null;
  let high = 0;
  for (let low = 0; low < points.length - 1; low++) {
    if (high <= low) high = low + 1;
    while (high < points.length - 1 && points[high]!.distance - points[low]!.distance < run) high += 1;
    const start = points[low]!;
    const end = points[high]!;
    const span = end.distance - start.distance;
    if (span <= 0 || start.elevation === null || end.elevation === null) continue;
    const grade = clampGrade(((end.elevation - start.elevation) / span) * 100);
    if (grade > 0 && (!best || grade > best.grade)) best = { grade, distance: (start.distance + end.distance) / 2 };
  }
  return best;
}

/** The profile's length and total climb, from its samples. Null when no sample has a height. */
export function profileSummary(points: ExplorerPoint[]): { distance: number; gain: number } | null {
  let gain = 0;
  let previous: number | null = null;
  let any = false;
  for (const point of points) {
    if (point.elevation === null) continue;
    if (previous !== null && point.elevation > previous) gain += point.elevation - previous;
    previous = point.elevation;
    any = true;
  }
  return any ? { distance: points[points.length - 1]!.distance, gain } : null;
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

/** The map, as far as `keepOrder` reads and moves its layers. */
export interface OrderedMap {
  getStyle(): { layers?: Array<{ id: string }> } | undefined;
  moveLayer(id: string, beforeId?: string): void;
}

/**
 * Puts the block's layers back in their order when something else added its own after them (the
 * drawing re-adds its layers on its own schedule, and a style swap re-adds everyone's in whatever
 * order): the grade line just under the drawing's handles, so they stay in reach, and the
 * profile's hover dot on top of everything. Moves only what is out of place.
 */
export function keepOrder(map: OrderedMap): void {
  const ids = () => map.getStyle()?.layers?.map((layer) => layer.id) ?? [];
  let order = ids();
  const handles = `${EXPLORER_LAYERS.draw}-point`;
  const line = [`${EXPLORER_LAYERS.line}-casing`, `${EXPLORER_LAYERS.line}-line`].filter((id) => order.includes(id));
  const at = order.indexOf(handles);
  if (line.length > 0 && at >= 0 && order.slice(at - line.length, at).join("|") !== line.join("|")) {
    for (const id of line) map.moveLayer(id, handles);
    order = ids();
  }
  const dot = `${EXPLORER_LAYERS.profile}-point`;
  if (order.includes(dot) && order[order.length - 1] !== dot) map.moveLayer(dot);
}

/**
 * Which side of each pin its name sits: toward the other end, so a framed line keeps both names
 * inside the frame.
 */
export function labelSides(from: ExplorerPlace | null, to: ExplorerPlace | null): { from: "left" | "right"; to: "left" | "right" } {
  if (!from || !to) return { from: "right", to: "right" };
  return from.lngLat[0] <= to.lngLat[0] ? { from: "right", to: "left" } : { from: "left", to: "right" };
}

/**
 * Camera padding that keeps a framed line clear of the panels floating on the map. A panel as
 * wide as most of the map (the profile along the bottom, or the whole sheet on a phone) covers it
 * from the bottom up; a narrower one (the controls) covers it from the left. When the full gutter
 * would leave too little map, it tightens and the frame stays in the strip the panels leave,
 * never behind them.
 */
export function framePadding(map: ExplorerRect, panels: Array<ExplorerRect | null>, gutter = GUTTER): ExplorerPadding {
  const padding = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (map.width <= 0 || map.height <= 0) return padding;
  let bottom = 0;
  let left = 0;
  for (const panel of panels) {
    if (!panel || panel.width <= 0 || panel.height <= 0) continue;
    if (panel.width >= map.width * 0.6) bottom = Math.max(bottom, Math.round(map.bottom - panel.top));
    else left = Math.max(left, Math.round(panel.right - map.left));
  }
  if (bottom > 0) {
    if (map.height - 2 * gutter - bottom >= MIN_FRAME) padding.bottom = bottom + gutter;
    else {
      padding.top = TIGHT;
      padding.bottom = Math.min(bottom + TIGHT, map.height - TIGHT - MIN_STRIP);
    }
  }
  if (left > 0) {
    if (map.width - 2 * gutter - left >= MIN_FRAME) padding.left = left + gutter;
    else {
      padding.right = TIGHT;
      padding.left = Math.min(left + TIGHT, map.width - TIGHT - MIN_STRIP);
    }
  }
  return padding;
}

/** The pixel offset that centres a point in the padded area: easeTo's `offset`, which, unlike its `padding`, does not stick. */
export function paddingOffset(padding: ExplorerPadding): [number, number] {
  return [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2];
}

/**
 * What to tell the reader about a failed route: the place, the key or the rate when the gateway
 * says so; a service that did not answer for a 5xx or a request that never got an HTTP answer.
 */
export function requestError(caught: unknown, lang: ExplorerLang): string {
  const copy = EXPLORER_COPY[lang];
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

/** True when the reader asked for less motion: the camera jumps. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** True from Tailwind's `sm` up, where the panels float apart; below it they are one sheet. True when it cannot tell. */
export function isWide(): boolean {
  return typeof window === "undefined" || window.matchMedia?.("(min-width: 40rem)")?.matches !== false;
}

function numberFormat(lang: ExplorerLang, digits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** `850 m` under a kilometre, `12.3 km` (fr: `12,3 km`) from there: the profile's own units. */
export function formatDistance(metres: number, lang: ExplorerLang): string {
  return metres < 1000 ? `${numberFormat(lang, 0).format(metres)} m` : `${numberFormat(lang, 1).format(metres / 1000)} km`;
}

/** Whole metres: a 30 m elevation model has no decimals worth printing. */
export function formatElevation(metres: number, lang: ExplorerLang): string {
  return `${numberFormat(lang, 0).format(metres)} m`;
}

/** "3 h 3 min", "8 min". Never under a minute. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${Math.floor(minutes / 60)} h`;
}

/** A grade with its sign: "+4.1%", "-10%" (fr: "+4,1 %"). */
export function formatGrade(grade: number, lang: ExplorerLang, digits = 1): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(grade / 100);
}

/** One sentence for a screen reader when a profile arrives: what, how long, how much climb, how steep. */
export function describeProfile(name: string, points: ExplorerPoint[], lang: ExplorerLang): string {
  const summary = profileSummary(points);
  if (!summary) return "";
  const steepest = steepestClimb(points);
  return EXPLORER_COPY[lang].announce(
    name,
    formatDistance(summary.distance, lang),
    formatElevation(summary.gain, lang),
    steepest ? formatGrade(steepest.grade, lang) : "",
  );
}
// --- end elevation-explorer helpers ---

export interface ElevationExplorerProps {
  /** unmap API key. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** Where the map opens, [longitude, latitude]. Defaults to Banff. */
  center?: [number, number];
  /** Opening zoom. Defaults to 8. */
  zoom?: number;
  /** Language of the copy, the chart and the tools. Defaults to "en". */
  lang?: ExplorerLang;
  className?: string;
}

export function ElevationExplorer({ apiKey, gateway, center = BANFF, zoom = 8, lang = "en", className }: ElevationExplorerProps) {
  if (!apiKey.trim()) {
    const copy = EXPLORER_COPY[lang];
    // Where the map would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="elevation-explorer"
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
    <div data-unmap-block="elevation-explorer" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map id={EXPLORER_MAP_ID} apiKey={apiKey} gateway={gateway} center={center} zoom={zoom} lang={lang} className={`h-full ${GRADE_TOKENS}`}>
        <Explorer apiKey={apiKey} gateway={gateway} lang={lang} />
      </Map>
    </div>
  );
}

/** A route asked for: loading, answered, or why it failed. */
type Asked = { status: "loading" } | { status: "ready"; trip: ExplorerTrip } | { status: "error"; message: string };
type Line = [number, number][];
/** The two sources that route: a trip, and your own. */
type Routed = "preset" | "route";

/** Everything that needs the map. It renders inside <Map>, where useMap() can see it. */
function Explorer({ apiKey, gateway, lang }: { apiKey: string; gateway?: string; lang: ExplorerLang }) {
  const copy = EXPLORER_COPY[lang];
  const map = useMap(EXPLORER_MAP_ID);
  const generation = useMapGeneration(EXPLORER_MAP_ID);
  const router = useMemo(() => new Router({ key: apiKey, gateway }), [apiKey, gateway]);
  const [source, setSource] = useState<ExplorerSource>("preset");
  // Each source keeps its own line, so switching back shows it again without asking again.
  const [presetId, setPresetId] = useState<string | null>(null);
  const [from, setFrom] = useState<ExplorerPlace | null>(null);
  const [to, setTo] = useState<ExplorerPlace | null>(null);
  const [drawn, setDrawn] = useState<DrawValue | null>(null);
  // Every route asked for, by key, remembered for the life of the block.
  const [asked, setAsked] = useState<Record<string, Asked>>({});
  // Every profile fetched, by its samples, so a line shown again is not billed again. A new key or
  // gateway gets a new cache in the same render, before any child effect can read the old one.
  const cache = useMemo(() => {
    void router; // the dependency is the point: a new client means a new cache
    return new globalThis.Map<string, ProfilePoint[]>();
  }, [router]);
  // The profile's samples, with the line they were taken on.
  const [profile, setProfile] = useState<{ line: Line; points: ExplorerPoint[] } | null>(null);
  const [hovered, setHovered] = useState<ExplorerHover | null>(null);
  const [said, setSaid] = useState("");
  // A routed line to frame once it is on screen: after the render that shows it, so the panels have their final size.
  const [framing, setFraming] = useState<{ line: Line } | null>(null);
  // On a phone the sheet can fold to the profile's headline, to give the map back.
  const [folded, setFolded] = useState(false);
  const flights = useRef<Record<Routed, { key: string; controller: AbortController } | null>>({ preset: null, route: null });
  const panelsRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const controlsId = useId();
  const bodyId = useId();
  const roadIds = useId();

  const chosen = EXPLORER_PRESETS.find((item) => item.id === presetId) ?? null;
  const presetKey = chosen ? `preset:${chosen.id}` : null;
  const routeKey = from && to ? `route:${placeKey(from)}>${placeKey(to)}` : null;
  const key = source === "preset" ? presetKey : source === "route" ? routeKey : null;
  const current = key ? asked[key] : undefined;
  const drawnLine = useMemo(() => lastLine(drawn), [drawn]);
  const line: Line | null = source === "draw" ? drawnLine : current?.status === "ready" ? current.trip.coordinates : null;
  const ends = source === "preset" && chosen ? { from: chosen.from, to: chosen.to } : source === "route" ? { from, to } : { from: null, to: null };
  const name =
    source === "draw"
      ? line
        ? copy.drawn
        : null
      : ends.from && ends.to && line
        ? copy.between(ends.from.name, ends.to.name)
        : null;
  const points = profile && profile.line === line ? profile.points : null;
  const isFolded = folded && line !== null;

  // What the reader is looking at now, read when an answer lands after they moved on.
  const now = useRef({ key, line, name });
  now.current = { key, line, name };

  // The line as drawn on the map: with the profile's samples merged in once they arrive, and coloured by grade.
  const graded = useMemo(() => (line && points ? gradedLine(line, points) : null), [line, points]);
  const gradient = useMemo(() => (graded ? { values: graded.values, domain: GRADE_DOMAIN } : undefined), [graded]);
  const steepest = useMemo(() => (points ? steepestClimb(points) : null), [points]);
  const summary = useMemo(() => (points ? profileSummary(points) : null), [points]);

  function padding(gutter = GUTTER): ExplorerPadding {
    const container = map?.getContainer();
    const none = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    if (!container) return framePadding(none, [], gutter);
    const rect = (element: HTMLElement | null) => element?.getBoundingClientRect() ?? null;
    // Wide, the controls sit at the left and the profile along the bottom; on a phone they are one sheet.
    const panels = isWide() ? [rect(controlsRef.current), rect(profileRef.current)] : [rect(panelsRef.current)];
    return framePadding(container.getBoundingClientRect(), panels, gutter);
  }
  const duration = () => (prefersReducedMotion() ? 0 : CAMERA_MS);
  function frame(next: Line) {
    map?.fitBounds(lineBounds(next), { padding: padding(FRAME_GUTTER), maxZoom: ROUTE_MAX_ZOOM, duration: duration() });
  }

  useEffect(() => {
    if (framing && framing.line === line) frame(framing.line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framing]);

  useEffect(
    () => () => {
      flights.current.preset?.controller.abort();
      flights.current.route?.controller.abort();
    },
    [],
  );

  // A new line starts quiet: its samples, its hover and its sentence belong to the old one.
  useEffect(() => {
    setHovered(null);
    setSaid("");
    // On a phone, bring the profile into view in the sheet (the sheet scrolls, never the page).
    const sheet = panelsRef.current;
    const card = profileRef.current;
    if (line && sheet && card && !isWide() && sheet.scrollHeight > sheet.clientHeight) sheet.scrollTop = card.offsetTop;
  }, [line]);

  // Folding or unfolding the sheet changes how much map there is: frame the line again.
  const wasFolded = useRef(isFolded);
  useEffect(() => {
    if (wasFolded.current === isFolded) return;
    wasFolded.current = isFolded;
    if (line && source !== "draw") frame(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFolded]);

  // One end chosen in the search boxes: the map eases to it, clear of the panels. This runs after
  // the search box's own fly to the result, and takes over from it.
  const fromKey = from ? placeKey(from) : "";
  const toKey = to ? placeKey(to) : "";
  useEffect(() => {
    if (!map || source !== "route") return;
    if (from && to) {
      if (routeKey && asked[routeKey]?.status === "ready") return;
      frame([from.lngLat, to.lngLat]);
      return;
    }
    const place = from ?? to;
    if (!place) return;
    map.easeTo({ center: place.lngLat, zoom: Math.max(map.getZoom(), 12), offset: paddingOffset(padding()), duration: duration() });
    // Only a newly chosen end moves the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fromKey, toKey]);

  // A new key or gateway is a new account: forget what the old one was told.
  const askedWith = useRef(router);
  useEffect(() => {
    if (askedWith.current === router) return;
    askedWith.current = router;
    flights.current.preset?.controller.abort();
    flights.current.route?.controller.abort();
    flights.current = { preset: null, route: null };
    setAsked({});
    setPresetId(null);
  }, [router]);

  // The grade line under the drawing's handles, and the profile's dot on top: now, after every
  // swap, and whenever the drawing adds its layers while it is out.
  useEffect(() => {
    if (!map) return;
    keepOrder(map);
    if (source !== "draw") return;
    const hold = () => keepOrder(map);
    map.on("styledata", hold);
    return () => {
      map.off("styledata", hold);
    };
  }, [map, generation, source, gradient]);

  /**
   * The route for one key: remembered, or asked once. A newer request from the same source
   * overtakes one in flight (its answer would be for ends no longer chosen); the other source's
   * request lands in the memory, since it is billed either way.
   */
  function ask(kind: Routed, routeFor: string, start: ExplorerPlace, end: ExplorerPlace, remembered = asked) {
    const known = remembered[routeFor];
    if (known?.status === "ready") {
      setFraming({ line: known.trip.coordinates });
      return;
    }
    const flying = flights.current[kind];
    if (flying?.key === routeFor) return;
    if (flying) {
      flying.controller.abort();
      setAsked((all) => {
        const rest = { ...all };
        delete rest[flying.key];
        return rest;
      });
    }
    const controller = new AbortController();
    flights.current[kind] = { key: routeFor, controller };
    const mine = () => flights.current[kind]?.controller === controller;
    setAsked((all) => ({ ...all, [routeFor]: { status: "loading" } }));
    const mode = kind === "preset" ? PRESET_MODE : ROUTE_MODE;
    router.route(start.lngLat, end.lngLat, { mode, signal: controller.signal }).then(
      (result) => {
        if (!mine()) return;
        flights.current[kind] = null;
        const trip = { coordinates: result.geometry.coordinates, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds };
        setAsked((all) => ({ ...all, [routeFor]: { status: "ready", trip } }));
        // Framed only if the reader is still looking at it; otherwise it waits in the memory.
        if (now.current.key === routeFor) setFraming({ line: trip.coordinates });
      },
      (caught: unknown) => {
        if (!mine()) return;
        flights.current[kind] = null;
        setAsked((all) => {
          const rest = { ...all };
          if (isAbort(caught)) delete rest[routeFor];
          else rest[routeFor] = { status: "error", message: requestError(caught, lang) };
          return rest;
        });
      },
    );
  }
  function pickPreset(item: ExplorerPreset) {
    setPresetId(item.id);
    setFolded(false);
    ask("preset", `preset:${item.id}`, item.from, item.to);
  }

  function retry() {
    if (source === "preset" && chosen && presetKey) {
      const rest = { ...asked };
      delete rest[presetKey];
      setAsked(rest);
      ask("preset", presetKey, chosen.from, chosen.to, rest);
    }
    if (source === "route" && from && to && routeKey) {
      const rest = { ...asked };
      delete rest[routeKey];
      setAsked(rest);
      ask("route", routeKey, from, to, rest);
    }
  }

  function choose(end: "from" | "to", result: { name: string; lng: number; lat: number }) {
    const place: ExplorerPlace = { name: result.name, lngLat: [result.lng, result.lat] };
    const nextFrom = end === "from" ? place : from;
    const nextTo = end === "to" ? place : to;
    if (end === "from") setFrom(place);
    else setTo(place);
    setFolded(false);
    if (nextFrom && nextTo) ask("route", `route:${placeKey(nextFrom)}>${placeKey(nextTo)}`, nextFrom, nextTo);
  }

  function switchSource(next: unknown) {
    // Pressing the pressed item empties a single ToggleGroup; the source stays.
    if (!isSource(next) || next === source) return;
    setSource(next);
    // A routed line already known is framed again when its source comes back.
    const knownKey = next === "preset" ? presetKey : next === "route" ? routeKey : null;
    const known = knownKey ? asked[knownKey] : undefined;
    if (known?.status === "ready") setFraming({ line: known.trip.coordinates });
  }

  const onProfile = useCallback((next: { points: ExplorerPoint[] } | null) => {
    const shown = now.current;
    if (!next || !shown.line) {
      setProfile(null);
      return;
    }
    // An answer for a line no longer on screen is not this line's profile.
    if (!profileBelongs(next.points, shown.line)) return;
    setProfile({ line: shown.line, points: next.points });
    setSaid(shown.name ? describeProfile(shown.name, next.points, lang) : "");
  }, [lang]);
  const onHover = useCallback((point: ExplorerHover | null) => setHovered(point), []);
  const onDraw = useCallback((value: DrawValue) => setDrawn(value), []);

  const hoverGrade = hovered && points ? gradeAt(points, hovered.index) : null;
  const hoverHeight = hovered ? (hovered.elevation === null ? copy.noHeight : formatElevation(hovered.elevation, lang)) : "";
  const readout = !line || !points
    ? ""
    : hovered
      ? copy.at(formatDistance(hovered.distance, lang), hoverHeight, hoverGrade === null ? "" : formatGrade(hoverGrade, lang))
      : steepest
        ? copy.steepest(formatGrade(steepest.grade, lang), formatDistance(steepest.distance, lang))
        : copy.noClimb;
  const sides = labelSides(ends.from, ends.to);
  // The folded headline: the climb, set large, its unit and the length quieter.
  const climbText = summary ? formatElevation(summary.gain, lang) : "";
  const climb = summary
    ? { amount: climbText.slice(0, climbText.lastIndexOf(" ")), unit: climbText.slice(climbText.lastIndexOf(" ") + 1), distance: summary.distance }
    : null;
  const routed = source !== "draw" && line !== null;

  return (
    <>
      {source === "draw" ? (
        <Draw
          mapId={EXPLORER_MAP_ID}
          id={EXPLORER_LAYERS.draw}
          modes={LINE_ONLY}
          value={drawn ?? undefined}
          onValueChange={onDraw}
          lang={lang}
          position="top-right"
          // Beside the map's zoom buttons, which hold the top-right corner.
          className="right-12"
        />
      ) : null}
      {line ? (
        <RouteLine
          mapId={EXPLORER_MAP_ID}
          id={EXPLORER_LAYERS.line}
          coordinates={graded?.coordinates ?? line}
          gradient={gradient}
          // A routed line sits below the labels; a drawn one over the drawing's own line, so its grades show, and under its handles.
          beforeId={source === "draw" ? `${EXPLORER_LAYERS.draw}-point` : undefined}
        />
      ) : null}
      {/* The start: a ring in --foreground. The end: your pin in --primary. Each is named. */}
      {source !== "draw" && ends.from ? (
        <Marker
          key={`from:${placeKey(ends.from)}`}
          mapId={EXPLORER_MAP_ID}
          lngLat={ends.from.lngLat}
          markerContent={<span className="block size-4 rounded-full border-[3px] border-foreground bg-background" />}
        >
          <MarkerLabel position={sides.from}>{ends.from.name}</MarkerLabel>
        </Marker>
      ) : null}
      {source !== "draw" && ends.to ? (
        <Marker key={`to:${placeKey(ends.to)}`} mapId={EXPLORER_MAP_ID} lngLat={ends.to.lngLat}>
          <MarkerLabel position={sides.to}>{ends.to.name}</MarkerLabel>
        </Marker>
      ) : null}
      {/* The map's answer to a hover: the height and grade where the chart is, above the profile's own dot. */}
      {hovered && points ? (
        <Marker mapId={EXPLORER_MAP_ID} lngLat={[hovered.lng, hovered.lat]} markerContent={<span className="block size-4" />}>
          <MarkerLabel position="top" className="tabular-nums">
            {hoverGrade === null ? hoverHeight : `${hoverHeight}, ${formatGrade(hoverGrade, lang)}`}
          </MarkerLabel>
        </Marker>
      ) : null}
      {/* While the line on screen is being routed, the wait is said; then the profile's sentence. */}
      <p data-unmap-explorer-announce="" aria-live="polite" aria-atomic="true" className="sr-only">
        {current?.status === "loading" ? copy.loading : said}
      </p>
      {/*
        Wide: the controls float at the top left and the profile runs along the bottom, the chart
        as the map's second half. Below `sm`: one sheet across the bottom, at most half the map,
        clear of the attribution, that scrolls and folds to the profile's headline.
      */}
      <div
        ref={panelsRef}
        className="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col gap-3 overflow-y-auto overscroll-contain sm:pointer-events-none sm:inset-x-6 sm:top-6 sm:bottom-10 sm:max-h-none sm:justify-between sm:gap-4 sm:overflow-visible motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
      >
        <Card
          ref={controlsRef}
          id={controlsId}
          data-folded={isFolded}
          className="shrink-0 max-sm:data-[folded=true]:hidden sm:pointer-events-auto sm:min-h-0 sm:w-[22rem] sm:shrink"
        >
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {copy.title}
            </CardTitle>
            {/* On a phone, or a short window, the controls say it with their labels alone. */}
            <CardDescription className="max-sm:hidden [@media(max-height:45rem)]:hidden">{copy.intro}</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-col gap-4 sm:overflow-y-auto sm:overscroll-contain">
            <ToggleGroup
              variant="outline"
              aria-label={copy.source}
              value={[source]}
              onValueChange={(value: unknown[]) => switchSource(value[0])}
              className="grid w-full shrink-0 grid-cols-3"
            >
              {EXPLORER_SOURCES.map((item) => (
                <ToggleGroupItem key={item} value={item} className="aria-pressed:font-semibold">
                  {copy.sources[item]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {source === "preset" ? (
              <div className="flex flex-col gap-2">
                {EXPLORER_PRESETS.map((item) => {
                  const pressed = item.id === presetId;
                  const roadId = `${roadIds}-${item.id}`;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={pressed ? "secondary" : "outline"}
                      aria-pressed={pressed}
                      aria-describedby={roadId}
                      onClick={() => pickPreset(item)}
                      className="h-auto w-full flex-col items-start gap-0.5 py-2 text-left aria-pressed:font-semibold"
                    >
                      <span className="flex items-center gap-1.5">
                        {/* Picked is marked by a check as well as the fill. */}
                        {pressed ? (
                          <span aria-hidden="true" data-pressed-mark="">
                            ✓
                          </span>
                        ) : null}
                        {copy.between(item.from.name, item.to.name)}
                      </span>
                      <span id={roadId} aria-hidden="true" className="text-xs font-normal text-muted-foreground">
                        {copy.roads[item.id]}
                      </span>
                    </Button>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  {copy.namesCredit}{" "}
                  <a className="underline underline-offset-2" href={EXPLORER_CREDITS.names[lang]} target="_blank" rel="noreferrer">
                    {copy.namesSource}
                  </a>
                  ,{" "}
                  <a className="underline underline-offset-2" href={EXPLORER_CREDITS.licence[lang]} target="_blank" rel="noreferrer">
                    {copy.licence}
                  </a>
                  .
                </p>
              </div>
            ) : null}
            {source === "route" ? (
              <div className="flex flex-col gap-2">
                <div className="relative flex flex-col gap-2">
                  {/* The rail from the start's ring to the end's dot, the shapes the map pins use. */}
                  <span aria-hidden="true" className="absolute top-1/4 bottom-1/4 left-1.5 -translate-x-1/2 border-l border-dashed border-border" />
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="relative size-3 shrink-0 rounded-full border-2 border-foreground bg-background" />
                    {/* `[&>p]:hidden` hides the <p> coverage line the geocoder renders after its combobox; the line below both boxes says it once. */}
                    <Geocoder
                      mapId={EXPLORER_MAP_ID}
                      apiKey={apiKey}
                      gateway={gateway}
                      lang={lang}
                      placeholder={copy.from}
                      proximity="map"
                      flyToZoom={12}
                      onSelect={(result) => choose("from", result)}
                      className="[&>p]:hidden"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="relative size-3 shrink-0 rounded-full bg-primary" />
                    <Geocoder
                      mapId={EXPLORER_MAP_ID}
                      apiKey={apiKey}
                      gateway={gateway}
                      lang={lang}
                      placeholder={copy.to}
                      proximity="map"
                      flyToZoom={12}
                      onSelect={(result) => choose("to", result)}
                      className="[&>p]:hidden"
                    />
                  </div>
                </div>
                <p className="pl-6 text-xs text-muted-foreground">{copy.byBike}</p>
              </div>
            ) : null}
            {/* Where the route lands, always there and tall enough for an error and its retry, so nothing jumps. */}
            <div data-unmap-explorer-answer="" className="flex min-h-16 shrink-0 flex-col justify-center gap-1 text-sm">
              {current?.status === "error" ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">{current.message}</span>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={retry}>
                      {copy.retry}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : current?.status === "loading" ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Spinner /> <span>{copy.loading}</span>
                </p>
              ) : current?.status === "ready" ? (
                <p className="text-muted-foreground tabular-nums motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
                  {`${formatDistance(current.trip.distanceMeters, lang)} ${copy.by[source === "route" ? ROUTE_MODE : PRESET_MODE]}, ${formatDuration(current.trip.durationSeconds)}`}
                </p>
              ) : source === "draw" ? (
                <p className="text-muted-foreground tabular-nums">{line ? `${copy.drawn}, ${formatDistance(lineLength(line), lang)}` : copy.drawHint}</p>
              ) : (
                <p className="text-muted-foreground">{source === "route" ? copy.needEnds : copy.pickTrip}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card ref={profileRef} className="shrink-0 sm:pointer-events-auto sm:w-full sm:max-w-5xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2} className="min-w-0 truncate">
                {name ?? copy.profile}
              </CardTitle>
              {line ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 sm:hidden"
                  aria-expanded={!isFolded}
                  aria-controls={`${controlsId} ${bodyId}`}
                  onClick={() => setFolded((was) => !was)}
                >
                  {isFolded ? copy.unfold : copy.fold}
                </Button>
              ) : null}
            </div>
            {isFolded && climb ? (
              <p data-unmap-explorer-folded="" className="flex items-baseline gap-1 tabular-nums sm:hidden">
                <span className="text-2xl leading-none font-semibold">{climb.amount}</span>{" "}
                <span className="text-sm text-muted-foreground">{`${copy.climb(climb.unit)}, ${formatDistance(climb.distance, lang)}`}</span>
              </p>
            ) : null}
          </CardHeader>
          <CardContent id={bodyId} data-folded={isFolded} className="flex flex-col gap-3 max-sm:data-[folded=true]:hidden">
            {/*
              The chart's place, held at the result's height in every state so the camera frames
              once and nothing jumps; dashed while it waits for a line. The block speaks for the
              profile and credits it with links, so the profile's own live region and plain
              source line step aside.
            */}
            <div
              data-empty={line === null}
              className="flex min-h-64 flex-col justify-center sm:min-h-[13.5rem] data-[empty=true]:rounded-md data-[empty=true]:border data-[empty=true]:border-dashed data-[empty=true]:p-4 data-[empty=true]:text-center"
            >
              <ElevationProfile
                apiKey={apiKey}
                gateway={gateway}
                mapId={EXPLORER_MAP_ID}
                id={EXPLORER_LAYERS.profile}
                line={line}
                lang={lang}
                cache={cache}
                onProfile={onProfile}
                onHover={onHover}
                className="[&_[data-unmap-elevation-announce]]:hidden [&_[data-unmap-elevation-source]]:hidden"
              />
            </div>
            {/* The grade: its ramp, the same one the line is drawn in, and what the pointer or the steepest stretch says. Reserved, so nothing jumps. */}
            <div className="flex min-h-10 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              {gradient ? (
                <div data-unmap-grade-legend="" className="flex min-w-0 flex-col gap-1 sm:w-64">
                  <div aria-hidden="true" className="relative h-2 rounded-sm" style={{ background: GRADE_RAMP }}>
                    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-background" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>{`${formatGrade(GRADE_DOMAIN[0], lang, 0)} ${copy.down}`}</span>
                    <span className="font-medium text-foreground">{copy.grade}</span>
                    <span>{`${formatGrade(GRADE_DOMAIN[1], lang, 0)} ${copy.up}`}</span>
                  </div>
                </div>
              ) : null}
              <div className="flex min-w-0 flex-col gap-0.5 sm:items-end">
                <p data-unmap-explorer-readout="" className="text-sm font-medium tabular-nums">
                  {readout}
                </p>
                {points ? <p className="text-xs text-muted-foreground max-sm:hidden">{copy.hoverHint}</p> : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {copy.elevationCredit}{" "}
              <a className="underline underline-offset-2" href={EXPLORER_CREDITS.elevation[lang]} target="_blank" rel="noreferrer">
                {copy.elevationSource}
              </a>
              .
              {routed ? (
                <>
                  {" "}
                  {copy.routesCredit}{" "}
                  <a className="underline underline-offset-2" href={EXPLORER_CREDITS.routes.source} target="_blank" rel="noreferrer">
                    {copy.routesSource}
                  </a>
                  ,{" "}
                  <a className="underline underline-offset-2" href={EXPLORER_CREDITS.routes.licence} target="_blank" rel="noreferrer">
                    {copy.routesLicence}
                  </a>
                  .
                </>
              ) : null}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
