"use client";

/**
 * <ViewExplorer> - can you see the Rockies from this home? Calgary in 3D, looking west. Click any
 * building and the view from its window opens across the western horizon as one surface in the
 * air, in your --primary: it leaves the window at its height and runs out until it meets the
 * ground. Its far edge is drawn bright where it strikes the mountains and in your
 * --muted-foreground where a nearer hill cuts it short. The panel scores the view
 * and draws the skyline you would see from that window, with the named peaks marked visible or
 * hidden. Downtown asks the same of the downtown towers, with one sight line to their tops.
 *
 * Every height comes from the terrain tiles the map already draws in 3D, read in the browser:
 * fine tiles near the home, where a neighbour's rise decides the view, coarse ones in the
 * mountains. The sight lines account for the curve of the Earth (with standard refraction), which
 * hides about 600 m of mountain at 100 km. The terrain is bare ground: it has the hills, not the
 * houses or the trees, and the panel says so.
 *
 * The surface is drawn by deck.gl through @unmap/deck, loaded on the first pick, so the map alone
 * never loads it. Composes the registry's map, map-controls and marker-popup items on your shadcn
 * Card, ToggleGroup, Button, Alert and Spinner, in your tokens. Each tile is a billed /terrain
 * request, so each is fetched once and kept: the first home reads about 25 tiles (the map has
 * usually loaded many of them already, and the browser answers those), the next home nearby a
 * few, and a home looked at again nothing.
 *
 * Installed by `npx shadcn add` with its page at app/view-explorer/page.tsx. Edit freely.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map } from "@/components/ui/map";
import { MapControls } from "@/components/ui/map-controls";
import { Marker, MarkerLabel } from "@/components/ui/marker-popup";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMap, useMapGeneration, useMapReady } from "@/lib/map-context";
import { tokenColor } from "@/lib/map-layers";

// --- view-explorer helpers (kept identical across both lanes) ---
export type ViewLang = "en" | "fr";
export type ViewTarget = "mountains" | "downtown";

export const VIEW_TARGETS: ViewTarget[] = ["mountains", "downtown"];

/** A home to look from: where it is, and how far above the ground the window is, in metres. */
export interface ViewHome {
  lngLat: [number, number];
  eye: number;
  /** The building's height when the click landed on one that has it. */
  building: number | null;
}

/** A named summit to test. */
export interface ViewPeak {
  id: string;
  name: string;
  lngLat: [number, number];
}

/** One sight line, sampled: metres from the home, and the ground there (null where the model has none). */
export interface ViewRay {
  azimuth: number;
  distances: number[];
  points: [number, number][];
}

/** What one sight line of the fan sees. */
export interface RayResult {
  azimuth: number;
  /** True when the skyline in this direction is mountains, not a nearer hill. */
  clear: boolean;
  /** The skyline point: where the line from the window grazes the ground last. */
  horizon: { lngLat: [number, number]; distance: number; height: number; angle: number } | null;
  /** The steepest angle up to any mountain on this line, seen or not, for the skyline's ghost. */
  mountainAngle: number | null;
}

/** Whether a single target (a summit, the downtown towers) can be seen, and what is in the way. */
export interface TargetResult {
  visible: boolean;
  /** The angle up to the target, in degrees above the level line from the window. */
  angle: number;
  distance: number;
  /** The nearer ground that rises highest in the view, and so blocks the target when it is hidden. */
  blocker: { lngLat: [number, number]; distance: number; height: number } | null;
}

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const VIEW_MAP_ID = "view-explorer";
/** Ids of what the block draws: the buildings in 3D on the map, the view in deck.gl over it. */
export const VIEW_LAYERS = {
  buildings: "view-explorer-buildings",
  surface: "view-explorer-surface",
  edge: "view-explorer-edge",
  line: "view-explorer-line",
};

/** Downtown Calgary, where the map opens and what the Downtown view looks at. */
export const CALGARY: [number, number] = [-114.0665, 51.0475];

/**
 * The top of the downtown skyline, in metres above the street. The tallest towers (Brookfield
 * Place East, The Bow) stand about 240 m; 200 m is the skyline most of them make.
 */
export const DOWNTOWN_HEIGHT = 200;

/** Where the camera stands before anything is picked: over the west side, looking west to the Rockies. */
export const OPENING_VIEW = { center: [-114.155, 51.045] as [number, number], zoom: 13.4, pitch: 72, bearing: 262 };

/**
 * Steeper than MapLibre's default 60 degrees, so the camera can look along the ground to the
 * mountains, and antialiased, as @unmap/deck asks, so the surface's edges draw smooth.
 */
export const MAP_OPTIONS = { maxPitch: 80, canvasContextAttributes: { antialias: true } };
/** The terrain drawn half again as tall, so the front ranges stand up 80 km off. The sight lines use true heights. */
export const EXAGGERATION = 1.5;

/**
 * Four places to try, each a point in a real Calgary community: two on the west hills, one on the
 * bluff over the Bow, one down on the river flats.
 */
export const VIEW_SPOTS: Array<{ id: string; lngLat: [number, number] }> = [
  { id: "patterson", lngLat: [-114.2005, 51.0575] },
  { id: "signal-hill", lngLat: [-114.1685, 51.0195] },
  { id: "crescent-heights", lngLat: [-114.0632, 51.0632] },
  { id: "inglewood", lngLat: [-114.0255, 51.0375] },
];

/**
 * Front-range summits seen from Calgary. Coordinates from the Canadian Geographical Names
 * Database (Natural Resources Canada), concise code MTN, Alberta: Moose Mountain IALHD, Prairie
 * Mountain IACLY, Mount Burns IAJMA, Mount Rae IAEFV, Banded Peak IACYD, Mount Glasgow IAGNM,
 * Fisher Peak IAERI, Mount Kidd IABDJ, Mount Bogart IAHAM, Mount Lougheed IAFIB, Mount Assiniboine
 * IACKC, Mount Inglismaldie IALBQ, Mount Aylmer IACLS, Black Rock Mountain IAGXU, Devils Head
 * IABBC. Open Government Licence, Canada.
 */
export const VIEW_PEAKS: ViewPeak[] = [
  { id: "IALHD", name: "Moose Mountain", lngLat: [-114.83806, 50.93889] },
  { id: "IACLY", name: "Prairie Mountain", lngLat: [-114.80639, 50.88806] },
  { id: "IAJMA", name: "Mount Burns", lngLat: [-114.86111, 50.64111] },
  { id: "IAEFV", name: "Mount Rae", lngLat: [-114.97472, 50.62278] },
  { id: "IACYD", name: "Banded Peak", lngLat: [-114.91806, 50.71833] },
  { id: "IAGNM", name: "Mount Glasgow", lngLat: [-114.93194, 50.75556] },
  { id: "IAERI", name: "Fisher Peak", lngLat: [-115.03, 50.81444] },
  { id: "IABDJ", name: "Mount Kidd", lngLat: [-115.18972, 50.89361] },
  { id: "IAHAM", name: "Mount Bogart", lngLat: [-115.24333, 50.91139] },
  { id: "IAFIB", name: "Mount Lougheed", lngLat: [-115.2625, 50.96556] },
  { id: "IACKC", name: "Mount Assiniboine", lngLat: [-115.65111, 50.86972] },
  { id: "IALBQ", name: "Mount Inglismaldie", lngLat: [-115.42194, 51.24167] },
  { id: "IACLS", name: "Mount Aylmer", lngLat: [-115.43333, 51.32389] },
  { id: "IAGXU", name: "Black Rock Mountain", lngLat: [-115.16833, 51.33444] },
  { id: "IABBC", name: "Devils Head", lngLat: [-115.26528, 51.34472] },
];

/** The fan: from south-southwest to west-northwest, the arc the Rockies fill from Calgary, every three degrees. */
export const FAN = { from: 200, to: 305, step: 3 };
/** How far each line of the fan reaches, in metres: past the front ranges into the main ranges. */
export const FAN_REACH = 130_000;
/** Samples per sight line, spaced closer near the home, where what blocks a view usually is. */
export const FAN_SAMPLES = 72;
export const PEAK_SAMPLES = 60;
export const DOWNTOWN_SAMPLES = 200;
/** The first sample out from the window, in metres: the next lot over. */
export const NEAREST = 40;

/** Ground this far above the home's own counts as mountain. Calgary's highest hills stop well short of it. */
export const MOUNTAIN_RELIEF = 600;

/** How far above the ground the window is when the click lands on no building: a second storey. */
export const DEFAULT_EYE = 4.5;
/** The window sits this far under the roof of a building the click landed on. */
export const ROOF_TO_EYE = 1.5;

/**
 * The terrain zoom each sample is read at, by its distance from the home: the finest tiles where a
 * neighbour's rise matters, coarser ones in the mountains, where only the summits do. A z9 tile is
 * about 100 m a pixel at Calgary's latitude, plenty for a peak 100 km off, and twelve of them
 * cover the whole fan. The map loads the same tiles to draw its terrain.
 */
export const ZOOM_BANDS: Array<{ within: number; zoom: number }> = [
  { within: 4_000, zoom: 12 },
  { within: 12_000, zoom: 11 },
  { within: 35_000, zoom: 10 },
  { within: Infinity, zoom: 9 },
];

/** Decoded terrain tiles the block keeps, oldest dropped first: about a megabyte each. */
export const TILE_MEMORY = 48;

const EARTH_RADIUS_M = 6_371_008.8;
/** Standard atmospheric refraction: light bends a little with the curve, so a little less is hidden. */
export const REFRACTION = 0.13;

/** Camera moves, in milliseconds. Reduced motion jumps. */
export const CAMERA_MS = 1400;

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

/** Where each credit links, per language. */
export const VIEW_CREDITS = {
  elevation: { en: "https://unmap.dev/attribution", fr: "https://unmap.dev/fr/attribution" },
  licence: {
    en: "https://open.canada.ca/en/open-government-licence-canada",
    fr: "https://ouvert.canada.ca/fr/licence-du-gouvernement-ouvert-canada",
  },
  names: {
    en: "https://open.canada.ca/data/en/dataset/e27c6eba-3c5d-4051-9db2-082dc6411c2c",
    fr: "https://ouvert.canada.ca/data/fr/dataset/e27c6eba-3c5d-4051-9db2-082dc6411c2c",
  },
};

export const VIEW_COPY = {
  en: {
    title: "Find the view",
    intro: "Click any building in Calgary to see whether the Rockies, or the downtown towers, can be seen from its windows.",
    target: "Look toward",
    targets: { mountains: "Mountains", downtown: "Downtown" },
    spotsLabel: "Or try",
    spots: { patterson: "Patterson", "signal-hill": "Signal Hill", "crescent-heights": "Crescent Heights", inglewood: "Inglewood" } as Record<string, string>,
    pick: "Click a building on the map.",
    loading: "Tracing the sight lines...",
    score: (percent: string) => `Mountain view: ${percent} of the western horizon`,
    noMountains: "No mountain view: nearer ground fills the whole western horizon.",
    allMountains: "Mountains across the whole western horizon.",
    blockedBy: (direction: string, distance: string) => `Cut off to the ${direction} by higher ground ${distance} away.`,
    peaksSeen: (count: number, total: number) => `${count} of ${total} named summits in sight.`,
    downtownSeen: (distance: string) => `The downtown towers are in sight, ${distance} away.`,
    downtownHidden: (distance: string, blocker: string) => `The downtown towers, ${distance} away, are hidden by higher ground ${blocker} from here.`,
    downtownHere: "This home is downtown: pick one farther out.",
    from: (eye: string) => `From a window ${eye} up`,
    fromTop: (eye: string) => `From the top floor, ${eye} up`,
    skyline: "The skyline from this window",
    skylineHint: "Facing west, heights stretched to fit. Mountains in sight are filled; a dashed line traces mountains hidden behind nearer ground, and their names are grey.",
    crossSection: "The ground between here and downtown",
    crossHint: "The line runs from the window to the top of the towers. Where the ground rises above it, the view is cut.",
    visible: "in sight",
    hidden: "hidden",
    south: "S",
    west: "W",
    north: "N",
    home: "This home",
    downtown: "Downtown",
    caveat: "Terrain only: the elevation model is bare ground, so houses and trees in the way are not counted. Includes the Earth's curve.",
    elevationCredit: "Elevation:",
    elevationSource: "DEM suppliers and licences",
    namesCredit: "Summit names:",
    namesSource: "Canadian Geographical Names Database",
    licence: "Open Government Licence – Canada",
    retry: "Try again",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The API key was refused. Check it and try again.",
    unavailable: "The service didn't answer. Try again in a moment.",
    failed: "The request failed. Try again.",
    noData: "The terrain has no heights here.",
    noTerrain: "The map has no terrain to read. Check that your key includes terrain.",
  },
  fr: {
    title: "Trouver la vue",
    intro: "Cliquez sur un bâtiment de Calgary pour savoir si l'on voit les Rocheuses, ou les tours du centre-ville, de ses fenêtres.",
    target: "Regarder vers",
    targets: { mountains: "Montagnes", downtown: "Centre-ville" },
    spotsLabel: "Ou essayez",
    spots: { patterson: "Patterson", "signal-hill": "Signal Hill", "crescent-heights": "Crescent Heights", inglewood: "Inglewood" } as Record<string, string>,
    pick: "Cliquez sur un bâtiment de la carte.",
    loading: "Tracé des lignes de visée...",
    score: (percent: string) => `Vue sur les montagnes : ${percent} de l'horizon ouest`,
    noMountains: "Aucune vue sur les montagnes : un relief plus proche occupe tout l'horizon ouest.",
    allMountains: "Des montagnes sur tout l'horizon ouest.",
    blockedBy: (direction: string, distance: string) => `Coupée vers le ${direction} par un relief plus haut, à ${distance}.`,
    peaksSeen: (count: number, total: number) => `${count} sommets nommés sur ${total} en vue.`,
    downtownSeen: (distance: string) => `Les tours du centre-ville sont en vue, à ${distance}.`,
    downtownHidden: (distance: string, blocker: string) => `Les tours du centre-ville, à ${distance}, sont cachées par un relief plus haut à ${blocker} d'ici.`,
    downtownHere: "Ce logement est au centre-ville : choisissez-en un plus loin.",
    from: (eye: string) => `D'une fenêtre à ${eye} du sol`,
    fromTop: (eye: string) => `Du dernier étage, à ${eye} du sol`,
    skyline: "La ligne d'horizon depuis cette fenêtre",
    skylineHint: "Face à l'ouest, hauteurs étirées. Les montagnes en vue sont pleines ; un tireté suit les montagnes cachées derrière un relief plus proche, et leur nom est en gris.",
    crossSection: "Le terrain d'ici au centre-ville",
    crossHint: "La ligne va de la fenêtre au sommet des tours. Là où le terrain la dépasse, la vue est coupée.",
    visible: "en vue",
    hidden: "caché",
    south: "S",
    west: "O",
    north: "N",
    home: "Ce logement",
    downtown: "Centre-ville",
    caveat: "Relief seulement : le modèle d'altitude est le sol nu, les maisons et les arbres qui gênent ne sont pas comptés. La courbure de la Terre est comprise.",
    elevationCredit: "Altitude :",
    elevationSource: "Fournisseurs du MNA et licences",
    namesCredit: "Noms des sommets :",
    namesSource: "Base de données toponymiques du Canada",
    licence: "Licence du gouvernement ouvert – Canada",
    retry: "Réessayer",
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La clé API a été refusée. Vérifiez-la et réessayez.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    failed: "La requête a échoué. Réessayez.",
    noData: "Le relief n'a pas de hauteur ici.",
    noTerrain: "La carte n'a pas de relief à lire. Vérifiez que votre clé comprend le relief.",
  },
};

export function isTarget(value: unknown): value is ViewTarget {
  return VIEW_TARGETS.includes(value as ViewTarget);
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Great-circle distance in metres. */
export function distanceMetres(a: [number, number], b: [number, number]): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The initial bearing from `a` to `b`, in degrees clockwise from north, 0 to 360. */
export function bearingDegrees(a: [number, number], b: [number, number]): number {
  const φ1 = toRadians(a[1]);
  const φ2 = toRadians(b[1]);
  const Δλ = toRadians(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** The point `metres` from `origin` along `azimuth`, on the sphere, rounded to five decimals (about a metre). */
export function destination(origin: [number, number], azimuth: number, metres: number): [number, number] {
  const δ = metres / EARTH_RADIUS_M;
  const θ = toRadians(azimuth);
  const φ1 = toRadians(origin[1]);
  const λ1 = toRadians(origin[0]);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [round5(toDegrees(λ2)), round5(toDegrees(φ2))];
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/**
 * `count` distances from `near` to `far`, each a fixed ratio past the last: about 100 m apart a
 * kilometre out, a few kilometres apart in the mountains, where only the summits matter.
 */
export function sampleDistances(count: number, far: number, near = NEAREST): number[] {
  if (count <= 1) return [far];
  const ratio = (far / near) ** (1 / (count - 1));
  return Array.from({ length: count }, (_value, index) => (index === count - 1 ? far : near * ratio ** index));
}

/** A sight line from `origin` along `azimuth`, sampled at `distances`. */
export function sightRay(origin: [number, number], azimuth: number, distances: number[]): ViewRay {
  return { azimuth, distances, points: distances.map((distance) => destination(origin, azimuth, distance)) };
}

/** The fan's azimuths, inclusive of both ends. */
export function fanAzimuths(fan = FAN): number[] {
  const out: number[] = [];
  for (let azimuth = fan.from; azimuth <= fan.to + 1e-9; azimuth += fan.step) out.push(azimuth);
  return out;
}

/** The fan's sight lines, every one the same reach and spacing. */
export function fanRays(origin: [number, number], fan = FAN, reach = FAN_REACH, samples = FAN_SAMPLES): ViewRay[] {
  const distances = sampleDistances(samples, reach);
  return fanAzimuths(fan).map((azimuth) => sightRay(origin, azimuth, distances));
}

/** A sight line ending exactly on `target`. */
export function targetRay(origin: [number, number], target: [number, number], samples: number): ViewRay {
  const ray = sightRay(origin, bearingDegrees(origin, target), sampleDistances(samples, distanceMetres(origin, target), Math.min(NEAREST, distanceMetres(origin, target) / samples)));
  ray.points[ray.points.length - 1] = [round5(target[0]), round5(target[1])];
  return ray;
}

/**
 * How far the ground at `metres` sits below the level line from the window, from the Earth's
 * curve less the share refraction gives back: about 680 m at 100 km.
 */
export function curveDrop(metres: number, refraction = REFRACTION): number {
  return ((metres * metres) / (2 * EARTH_RADIUS_M)) * (1 - refraction);
}

/** The angle up (or down) from the window to ground of `height` at `metres`, in degrees. */
export function sightAngle(eyeHeight: number, metres: number, height: number): number {
  return toDegrees(Math.atan2(height - curveDrop(metres) - eyeHeight, metres));
}

/**
 * What a sight line of the fan sees from a window at `eyeHeight` (metres above sea level) over
 * ground at `groundHeight`. The skyline point is the sample at the steepest angle up; the line is
 * clear when that sample is mountain, at least MOUNTAIN_RELIEF above the home's own ground.
 */
export function readRay(ray: ViewRay, heights: (number | null)[], groundHeight: number, eyeHeight: number, relief = MOUNTAIN_RELIEF): RayResult {
  let best = -Infinity;
  let at = -1;
  let mountainAngle: number | null = null;
  for (let index = 0; index < ray.distances.length; index++) {
    const height = heights[index];
    if (height === null || height === undefined) continue;
    const angle = sightAngle(eyeHeight, ray.distances[index]!, height);
    if (angle > best) {
      best = angle;
      at = index;
    }
    if (height >= groundHeight + relief && (mountainAngle === null || angle > mountainAngle)) mountainAngle = angle;
  }
  if (at < 0) return { azimuth: ray.azimuth, clear: false, horizon: null, mountainAngle: null };
  const height = heights[at]!;
  return {
    azimuth: ray.azimuth,
    clear: height >= groundHeight + relief,
    horizon: { lngLat: ray.points[at]!, distance: ray.distances[at]!, height, angle: best },
    mountainAngle,
  };
}

/**
 * Whether the last sample of `ray` (a summit, or the towers `targetLift` metres above their
 * street) can be seen: nothing nearer rises to a steeper angle. Within a hundredth of a degree
 * counts as seen, the model's own half-metre steps.
 */
export function readTarget(ray: ViewRay, heights: (number | null)[], eyeHeight: number, targetLift = 0): TargetResult | null {
  const last = ray.distances.length - 1;
  const ground = heights[last];
  if (ground === null || ground === undefined) return null;
  const distance = ray.distances[last]!;
  const angle = sightAngle(eyeHeight, distance, ground + targetLift);
  let best = -Infinity;
  let blocker: TargetResult["blocker"] = null;
  for (let index = 0; index < last; index++) {
    const height = heights[index];
    if (height === null || height === undefined) continue;
    const nearer = sightAngle(eyeHeight, ray.distances[index]!, height);
    if (nearer > best) {
      best = nearer;
      blocker = { lngLat: ray.points[index]!, distance: ray.distances[index]!, height };
    }
  }
  return { visible: angle >= best - 0.01, angle, distance, blocker };
}

/** The terrain zoom to read a sample at, by its distance from the home. */
export function zoomFor(metres: number): number {
  return ZOOM_BANDS.find((band) => metres < band.within)!.zoom;
}

/** A terrain tile, decoded: its RGBA pixels, row by row, `size` on a side. */
export interface TerrainTile {
  size: number;
  data: ArrayLike<number>;
}

/** Terrarium: `elevation = R * 256 + G + B / 256 - 32768`, the encoding the map's terrain uses. */
export function terrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** The tile a coordinate falls in at zoom `z`, and its fractional pixel inside a `size` tile. */
export function tilePixel(lng: number, lat: number, z: number, size: number): { x: number; y: number; px: number; py: number } {
  const n = 2 ** z;
  const gx = ((lng + 180) / 360) * n;
  const gy = ((1 - Math.asinh(Math.tan(toRadians(lat))) / Math.PI) / 2) * n;
  const x = Math.floor(gx);
  const y = Math.floor(gy);
  return { x, y, px: (gx - x) * size, py: (gy - y) * size };
}

/**
 * The height at a pixel position, bilinear between the four pixel centres around it. At a tile's
 * edge the nearest pixels stand in for the neighbour's: a few metres of error, never a hole.
 */
export function sampleTile(tile: TerrainTile, px: number, py: number): number {
  const size = tile.size;
  const fx = Math.min(Math.max(px - 0.5, 0), size - 1);
  const fy = Math.min(Math.max(py - 0.5, 0), size - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, size - 1);
  const y1 = Math.min(y0 + 1, size - 1);
  const at = (x: number, y: number) => {
    const i = (y * size + x) * 4;
    return terrarium(tile.data[i]!, tile.data[i + 1]!, tile.data[i + 2]!);
  };
  const tx = fx - x0;
  const ty = fy - y0;
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** A tile's URL from the map's terrain source template. */
export function tileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

/** Loads one terrain tile, null where the terrain has none. */
export type TileLoader = (z: number, x: number, y: number) => Promise<TerrainTile | null>;

/**
 * The ground under every sample of every ray, each read at its distance's zoom. Each tile is
 * loaded once however many samples fall in it, all of them at once. `home` is read at the finest
 * zoom and answered first.
 */
export async function groundHeights(home: [number, number], rays: ViewRay[], load: TileLoader): Promise<{ ground: number | null; perRay: (number | null)[][] }> {
  const wanted = new globalThis.Map<string, Promise<TerrainTile | null>>();
  const read = (lngLat: [number, number], metres: number) => {
    const z = zoomFor(metres);
    const at = tilePixel(lngLat[0], lngLat[1], z, 512);
    const id = `${z}/${at.x}/${at.y}`;
    if (!wanted.has(id)) wanted.set(id, load(z, at.x, at.y));
    return { id, at };
  };
  const homeRead = read(home, 0);
  const rayReads = rays.map((ray) => ray.points.map((point, index) => read(point, ray.distances[index]!)));
  const ids = [...wanted.keys()];
  const loaded = await Promise.all(ids.map((id) => wanted.get(id)!));
  const tiles = new globalThis.Map(ids.map((id, index) => [id, loaded[index]!]));
  const height = ({ id, at }: { id: string; at: { px: number; py: number } }) => {
    const tile = tiles.get(id);
    if (!tile) return null;
    const scale = tile.size / 512;
    return sampleTile(tile, at.px * scale, at.py * scale);
  };
  return { ground: height(homeRead), perRay: rayReads.map((reads) => reads.map(height)) };
}

/** The share of the fan that reaches the mountains, 0 to 1. */
export function viewShare(results: RayResult[]): number {
  const read = results.filter((result) => result.horizon !== null);
  return read.length === 0 ? 0 : read.filter((result) => result.clear).length / read.length;
}

/**
 * The widest run of blocked lines in the fan: its middle azimuth, and the median distance to
 * what blocks it. Null when nothing is blocked.
 */
export function widestBlock(results: RayResult[]): { azimuth: number; distance: number } | null {
  let best: RayResult[] = [];
  let run: RayResult[] = [];
  for (const result of results) {
    if (result.horizon && !result.clear) run.push(result);
    else run = [];
    if (run.length > best.length) best = [...run];
  }
  if (best.length === 0) return null;
  const distances = best.map((result) => result.horizon!.distance).sort((a, b) => a - b);
  return { azimuth: (best[0]!.azimuth + best[best.length - 1]!.azimuth) / 2, distance: distances[Math.floor(distances.length / 2)]! };
}

/** A point as the scene draws it: longitude, latitude, and metres up on the map's drawn terrain. */
export type ScenePoint = [number, number, number];

/**
 * Where a height sits in the drawn scene. The map draws the terrain EXAGGERATION times as tall,
 * and the buildings at their own heights on top of it, so ground scales and what stands on it
 * (a window, a tower) does not: a top-floor window sits on its drawn building's roof.
 */
export function sceneZ(ground: number, above = 0, exaggeration = EXAGGERATION): number {
  return ground * exaggeration + above;
}

/** Steps each sight line is drawn in, closer together near the window, where the line skims the ground. */
export const SIGHT_STEPS = 24;

/**
 * One sight line as the scene draws it: from the window out `distance` metres along `azimuth`,
 * climbing at `angle` degrees as the true line does. The map is drawn flat, so the line is
 * lifted by the Earth's curve as it goes (it skims the city near the window and bends up to meet
 * the mountains far out, which is why it is drawn in steps, not straight), and set on the drawn
 * terrain: its height above sea level scales with the exaggeration, and its height above the
 * ground at either end (the window's `eye`, the target's `lift`) does not, so it leaves the
 * window on its roof and lands on the drawn summit or tower top.
 */
export function sightPath(
  home: [number, number],
  azimuth: number,
  distance: number,
  eyeHeight: number,
  eye: number,
  angle: number,
  lift = 0,
  steps = SIGHT_STEPS,
  exaggeration = EXAGGERATION,
): ScenePoint[] {
  const slope = Math.tan(toRadians(angle));
  return Array.from({ length: steps + 1 }, (_value, step) => {
    const along = distance * (step / steps) ** 2;
    const [lng, lat] = destination(home, azimuth, along);
    const height = eyeHeight + slope * along + curveDrop(along);
    const standing = eye + (lift - eye) * (along / distance);
    return [lng, lat, height * exaggeration - standing * (exaggeration - 1)];
  });
}

/** The far edge of the view, in stretches: where it lies on the mountains, and where a nearer hill stops it. */
export interface ViewEdge {
  clear: boolean;
  path: ScenePoint[];
}

/** The view as one surface: triangles between neighbouring sight lines, step by step, edge to edge. */
export interface ViewSurface {
  triangles: ScenePoint[][];
  edges: ViewEdge[];
}

/**
 * The view as a single surface in the air: every line of the fan drawn as it runs from the window
 * to its skyline point, south to north, and the surface stretched between neighbouring lines, so it
 * skims the ground near the window and its far edge traces where the view meets the ground. Null
 * with fewer than two lines read.
 */
export function viewSurface(home: [number, number], groundHeight: number, eye: number, results: RayResult[]): ViewSurface | null {
  const lines = results.flatMap((result) =>
    result.horizon ? [{ clear: result.clear, path: sightPath(home, result.azimuth, result.horizon.distance, groundHeight + eye, eye, result.horizon.angle) }] : [],
  );
  if (lines.length < 2) return null;
  const edges: ViewEdge[] = [];
  const triangles: ScenePoint[][] = [];
  for (let index = 1; index < lines.length; index++) {
    const left = lines[index - 1]!;
    const right = lines[index]!;
    const clear = left.clear && right.clear;
    const last = edges[edges.length - 1];
    if (last && last.clear === clear) last.path.push(right.path[right.path.length - 1]!);
    else edges.push({ clear, path: [left.path[left.path.length - 1]!, right.path[right.path.length - 1]!] });
    for (let step = 1; step < left.path.length; step++) {
      const [a, b, c, d] = [left.path[step - 1]!, left.path[step]!, right.path[step]!, right.path[step - 1]!];
      // The first step starts at the window on both lines: one triangle, not two.
      if (step === 1) triangles.push([a, b, c]);
      else triangles.push([a, b, c], [a, c, d]);
    }
  }
  return { triangles, edges };
}

/**
 * The downtown view in the scene: the sight line from the window toward the top of the towers,
 * drawn as the line runs; when nearer ground hides them, it stops where it runs into that ground.
 */
export function downtownScene(home: [number, number], groundHeight: number, eye: number, result: TargetResult): { line: ScenePoint[] } {
  const azimuth = bearingDegrees(home, CALGARY);
  const distance = !result.visible && result.blocker ? result.blocker.distance : result.distance;
  return { line: sightPath(home, azimuth, distance, groundHeight + eye, eye, result.angle, distance === result.distance ? DOWNTOWN_HEIGHT : 0) };
}

const COMPASS = {
  en: ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast", "southeast", "south-southeast", "south", "south-southwest", "southwest", "west-southwest", "west", "west-northwest", "northwest", "north-northwest"],
  fr: ["nord", "nord-nord-est", "nord-est", "est-nord-est", "est", "est-sud-est", "sud-est", "sud-sud-est", "sud", "sud-sud-ouest", "sud-ouest", "ouest-sud-ouest", "ouest", "ouest-nord-ouest", "nord-ouest", "nord-nord-ouest"],
};

/** An azimuth as one of the sixteen compass points, spelled out. */
export function compass(azimuth: number, lang: ViewLang): string {
  return COMPASS[lang][Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16]!;
}

/**
 * The camera that looks from a home toward what it is asked about: low and steep, facing the
 * middle of the fan (or downtown, closer in), the home held a little above the middle (by
 * `offset`, which unlike padding does not stick), clear of the skyline card along the bottom, so
 * the sight lines run up the map to the horizon. On a phone the sheet covers the bottom half, so
 * the home sits in the top third instead.
 */
export function homeCamera(home: [number, number], toward: ViewTarget, height: number, wide: boolean, fan = FAN): { center: [number, number]; zoom: number; pitch: number; bearing: number; offset: [number, number] } {
  const offset: [number, number] = [0, Math.round(height * (wide ? -0.08 : -0.2))];
  if (toward === "downtown") return { center: home, zoom: 13, pitch: 72, bearing: bearingDegrees(home, CALGARY), offset };
  return { center: home, zoom: 11.8, pitch: 78, bearing: (fan.from + fan.to) / 2, offset };
}

/** True from Tailwind's `sm` up, where the panels float apart; below it they are one sheet. True when it cannot tell. */
export function isWide(): boolean {
  return typeof window === "undefined" || window.matchMedia?.("(min-width: 40rem)")?.matches !== false;
}

/** A label laid out above the skyline: its row, counted down from the top, or null when no row has room. */
export interface SkylineLabel {
  x: number;
  width: number;
  row: number | null;
}

/**
 * Rows for labels at `x` of `width` (centred), so none overlaps another in its row: each takes
 * the highest row whose last label ends `gap` before it starts, the order given. Visible summits
 * go first, so a hidden one gives way.
 */
export function labelRows(labels: Array<{ x: number; width: number }>, rows: number, gap = 8): Array<number | null> {
  const spans: Array<Array<[number, number]>> = Array.from({ length: rows }, () => []);
  return labels.map(({ x, width }) => {
    const left = x - width / 2;
    const right = x + width / 2;
    for (let row = 0; row < rows; row++) {
      if (spans[row]!.every(([start, end]) => right + gap <= start || left - gap >= end)) {
        spans[row]!.push([left, right]);
        return row;
      }
    }
    return null;
  });
}

/**
 * What to tell the reader about a failed request: the key or the rate when the gateway says so; a
 * service that did not answer for a 5xx or a request that never got an HTTP answer.
 */
export function requestError(caught: unknown, lang: ViewLang): string {
  const copy = VIEW_COPY[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { status?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : null;
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

function numberFormat(lang: ViewLang, digits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** `850 m` under a kilometre, `12.3 km` (fr: `12,3 km`) from there. */
export function formatDistance(metres: number, lang: ViewLang): string {
  return metres < 1000 ? `${numberFormat(lang, 0).format(metres)} m` : `${numberFormat(lang, metres < 10_000 ? 1 : 0).format(metres / 1000)} km`;
}

/** Whole metres, or one decimal under ten. */
export function formatHeight(metres: number, lang: ViewLang): string {
  return `${numberFormat(lang, metres < 10 ? 1 : 0).format(metres)} m`;
}

/** A share as a whole percent: "71%" (fr: "71 %"). */
export function formatShare(share: number, lang: ViewLang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "percent", maximumFractionDigits: 0 }).format(share);
}

/** A home as a primitive, so the same home clicked again is the same home. */
export function homeKey(home: ViewHome): string {
  return `${round5(home.lngLat[0])},${round5(home.lngLat[1])},${home.eye}`;
}

/** The window's height from the building under the click: just under its roof, or a second storey when it has no height. */
export function eyeFor(building: number | null): number {
  return building !== null && building > DEFAULT_EYE + ROOF_TO_EYE ? building - ROOF_TO_EYE : DEFAULT_EYE;
}
// --- end view-explorer helpers ---

export interface ViewExplorerProps {
  /** unmap API key. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** Language of the copy and the map. Defaults to "en". */
  lang?: ViewLang;
  className?: string;
}

export function ViewExplorer({ apiKey, gateway, lang = "en", className }: ViewExplorerProps) {
  if (!apiKey.trim()) {
    const copy = VIEW_COPY[lang];
    return (
      <div
        data-unmap-block="view-explorer"
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
    <div data-unmap-block="view-explorer" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map
        id={VIEW_MAP_ID}
        apiKey={apiKey}
        gateway={gateway}
        center={OPENING_VIEW.center}
        zoom={OPENING_VIEW.zoom}
        pitch={OPENING_VIEW.pitch}
        bearing={OPENING_VIEW.bearing}
        terrain
        exaggeration={EXAGGERATION}
        // Flat, not the default globe: deck.gl places the view on the drawn terrain only in Mercator.
        projection="mercator"
        maplibre={MAP_OPTIONS}
        lang={lang}
        controls={false}
        className="h-full"
      >
        <MapControls mapId={VIEW_MAP_ID} lang={lang} />
        <Explorer apiKey={apiKey} gateway={gateway} lang={lang} />
      </Map>
    </div>
  );
}

/** A mountain view, read: the fan and the summits. */
interface MountainView {
  rays: RayResult[];
  peaks: Array<{ peak: ViewPeak; result: TargetResult }>;
}
/** A downtown view, read, with the ground under the line for the cross-section. */
interface DowntownView {
  result: TargetResult;
  distances: number[];
  heights: (number | null)[];
  groundHeight: number;
  eyeHeight: number;
}
type Asked<T> = { status: "loading" } | { status: "ready"; value: T; ground: number } | { status: "error"; message: string };

/** The map's part of a MapLibre map this block reads, beyond what the items already handle. */
interface ViewMap {
  getStyle():
    | { layers?: Array<{ id: string; type: string; source?: string; "source-layer"?: string }>; sources?: Record<string, { type?: string; tiles?: string[] }> }
    | undefined;
  getLayer(id: string): unknown;
  addLayer(layer: Record<string, unknown>, beforeId?: string): void;
  removeLayer(id: string): void;
  getPaintProperty(layer: string, name: string): unknown;
  queryRenderedFeatures(point: { x: number; y: number }, options: { layers: string[] }): Array<{ properties?: Record<string, unknown> }>;
  easeTo(options: Record<string, unknown>): void;
  on(type: string, listener: (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => void): void;
  off(type: string, listener: (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => void): void;
  getCanvas(): { style: { cursor: string } };
}

/** The building extrusion: the style's own buildings, raised to their heights, in the style's own building colour. */
function addBuildings(map: ViewMap): void {
  if (map.getLayer(VIEW_LAYERS.buildings)) return;
  const layers = map.getStyle()?.layers ?? [];
  const flat = layers.find((layer) => layer["source-layer"] === "buildings" && layer.type === "fill");
  if (!flat?.source) return;
  const color = map.getPaintProperty(flat.id, "fill-color");
  const labels = layers.find((layer) => layer.type === "symbol")?.id;
  map.addLayer(
    {
      id: VIEW_LAYERS.buildings,
      type: "fill-extrusion",
      source: flat.source,
      "source-layer": "buildings",
      minzoom: 13,
      paint: {
        ...(color === undefined ? {} : { "fill-extrusion-color": color }),
        "fill-extrusion-height": ["coalesce", ["get", "height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
        "fill-extrusion-opacity": 0.9,
      },
    },
    labels,
  );
}

/** The URL template of the map's own terrain tiles, carrying the key the map was given. */
function terrainTemplate(map: ViewMap): string | null {
  for (const source of Object.values(map.getStyle()?.sources ?? {})) {
    if (source.type === "raster-dem" && source.tiles?.[0]) return source.tiles[0];
  }
  return null;
}

/** A terrain tile's pixels, exactly as encoded: no premultiplying, no colour management. */
async function decodeTile(response: Response): Promise<TerrainTile> {
  const bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const size = bitmap.width;
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, bitmap.height) : Object.assign(document.createElement("canvas"), { width: size, height: bitmap.height });
  const context = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error("no 2d canvas");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { size, data: context.getImageData(0, 0, size, size).data };
}

/** What the scene draws: the view's surface, or the sight line and sheet to downtown. */
type Scene = { surface: ViewSurface; downtown?: never } | { downtown: ReturnType<typeof downtownScene> & { visible: boolean }; surface?: never };
type RGBA = [number, number, number, number];

/** The renderer, loaded on demand: @unmap/deck's overlay and deck.gl's two layers the scene needs. */
async function loadDeck() {
  const [{ createDeckOverlay }, { PathLayer, SolidPolygonLayer }] = await Promise.all([import("@unmap/deck"), import("@deck.gl/layers")]);
  return { createDeckOverlay, PathLayer, SolidPolygonLayer };
}
type DeckKit = Awaited<ReturnType<typeof loadDeck>>;

/** A CSS colour (hex, rgb() or oklch(), as your tokens hold it) as the RGB deck.gl takes, through a one-pixel canvas. */
function rgba(css: string | null): (alpha: number) => RGBA {
  let rgb: [number, number, number] = [128, 128, 128];
  const context = css && typeof document !== "undefined" ? document.createElement("canvas").getContext("2d", { willReadFrequently: true }) : null;
  if (css && context) {
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    rgb = [r ?? 128, g ?? 128, b ?? 128];
  }
  return (alpha) => [...rgb, Math.round(alpha * 255)];
}

/**
 * The scene's layers. The surface is see-through and writes no depth, so the map shows through it;
 * the terrain still hides what lies behind a ridge. Polygons are triangulated on the map's plane and
 * keep each corner's height, which is what a fan from the window wants.
 */
function sceneLayers(kit: DeckKit, scene: Scene, colours: { primary: (alpha: number) => RGBA; muted: (alpha: number) => RGBA }): unknown[] {
  const { primary, muted } = colours;
  const sheet = { filled: true, parameters: { depthWriteEnabled: false } };
  const line = { widthUnits: "pixels" as const, capRounded: true, jointRounded: true };
  if (scene.surface) {
    return [
      new kit.SolidPolygonLayer<ScenePoint[]>({
        id: VIEW_LAYERS.surface,
        data: scene.surface.triangles,
        getPolygon: (points) => points,
        getFillColor: primary(0.38),
        ...sheet,
      }),
      new kit.PathLayer<ViewEdge>({
        id: VIEW_LAYERS.edge,
        data: scene.surface.edges,
        getPath: (edge) => edge.path,
        getColor: (edge) => (edge.clear ? primary(1) : muted(0.9)),
        getWidth: (edge) => (edge.clear ? 4 : 2),
        ...line,
      }),
    ];
  }
  const { downtown } = scene;
  return [
    new kit.PathLayer<ScenePoint[]>({
      id: VIEW_LAYERS.line,
      data: [downtown.line],
      getPath: (points) => points,
      getColor: (downtown.visible ? primary : muted)(1),
      getWidth: 4,
      ...line,
    }),
  ];
}

/** Everything that needs the map. It renders inside <Map>, where useMap() can see it. */
function Explorer({ apiKey, gateway, lang }: { apiKey: string; gateway?: string; lang: ViewLang }) {
  const copy = VIEW_COPY[lang];
  const map = useMap(VIEW_MAP_ID) as unknown as (ViewMap & Parameters<typeof tokenColor>[0]) | null;
  const ready = useMapReady(VIEW_MAP_ID);
  const generation = useMapGeneration(VIEW_MAP_ID);
  // Decoded terrain tiles, by z/x/y, oldest dropped first. A new key or gateway gets a new store.
  const tiles = useMemo(() => {
    void apiKey;
    void gateway;
    return new globalThis.Map<string, Promise<TerrainTile | null>>();
  }, [apiKey, gateway]);
  const [target, setTarget] = useState<ViewTarget>("mountains");
  const [home, setHome] = useState<ViewHome | null>(null);
  // Every view asked for, by home and target, remembered for the life of the block.
  const [mountains, setMountains] = useState<Record<string, Asked<MountainView>>>({});
  const [downtown, setDowntown] = useState<Record<string, Asked<DowntownView>>>({});
  const flight = useRef<{ key: string; controller: AbortController } | null>(null);
  // The memory as of the last render, read by a click handler bound before it changed.
  const memory = useRef({ mountains, downtown });
  memory.current = { mountains, downtown };

  const key = home ? `${target}:${homeKey(home)}` : null;
  const current: Asked<MountainView> | Asked<DowntownView> | undefined = key ? (target === "mountains" ? mountains[key] : downtown[key]) : undefined;
  const mountainView = target === "mountains" && current?.status === "ready" ? (current.value as MountainView) : null;
  const downtownView = target === "downtown" && current?.status === "ready" ? (current.value as DowntownView) : null;
  const tooClose = home !== null && target === "downtown" && distanceMetres(home.lngLat, CALGARY) < 600;

  // A new key or gateway is a new account: forget what the old one was told.
  const askedWith = useRef(tiles);
  useEffect(() => {
    if (askedWith.current === tiles) return;
    askedWith.current = tiles;
    flight.current?.controller.abort();
    flight.current = null;
    setMountains({});
    setDowntown({});
  }, [tiles]);

  useEffect(() => () => flight.current?.controller.abort(), []);

  // The buildings in 3D, now and after every style swap.
  useEffect(() => {
    if (!map || !ready) return;
    addBuildings(map);
    const again = () => addBuildings(map);
    map.on("styledata", again as never);
    return () => {
      map.off("styledata", again as never);
    };
  }, [map, ready, generation]);

  // A click picks a home: the building under it if there is one, for its height.
  useEffect(() => {
    if (!map || !ready) return;
    const onClick = (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      const hit = map.getLayer(VIEW_LAYERS.buildings) ? map.queryRenderedFeatures(event.point, { layers: [VIEW_LAYERS.buildings] })[0] : undefined;
      const height = typeof hit?.properties?.height === "number" ? hit.properties.height : null;
      pick({ lngLat: [event.lngLat.lng, event.lngLat.lat], eye: eyeFor(height), building: height });
    };
    map.on("click", onClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
    // pick reads the latest state through its arguments and refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, target, tiles]);

  function look(next: ViewHome, toward: ViewTarget) {
    if (!map) return;
    const height = (map as unknown as { getContainer(): HTMLElement }).getContainer().clientHeight;
    map.easeTo({ ...homeCamera(next.lngLat, toward, height, isWide()), duration: prefersReducedMotion() ? 0 : CAMERA_MS });
  }

  function pick(next: ViewHome, toward: ViewTarget = target, force = false) {
    setHome(next);
    if (toward === "mountains" || distanceMetres(next.lngLat, CALGARY) >= 600) look(next, toward);
    ask(next, toward, force);
  }

  /** The view for one home and target: remembered, or asked once. A newer pick overtakes one in flight. */
  function ask(next: ViewHome, toward: ViewTarget, force: boolean) {
    const askKey = `${toward}:${homeKey(next)}`;
    const known = toward === "mountains" ? memory.current.mountains[askKey] : memory.current.downtown[askKey];
    if (!force && known && known.status !== "error") return;
    if (toward === "downtown" && distanceMetres(next.lngLat, CALGARY) < 600) return;
    flight.current?.controller.abort();
    const controller = new AbortController();
    flight.current = { key: askKey, controller };
    const mine = () => flight.current?.controller === controller;
    // Either memory, written the same way: only the states that carry no view are set through it.
    const set = (update: (all: Record<string, Asked<never>>) => Record<string, Asked<never>>) =>
      (toward === "mountains" ? setMountains : setDowntown)(update as never);
    set((all) => ({ ...all, [askKey]: { status: "loading" } }));

    const fan = toward === "mountains" ? fanRays(next.lngLat) : [];
    const peakRays = toward === "mountains" ? VIEW_PEAKS.map((peak) => targetRay(next.lngLat, peak.lngLat, PEAK_SAMPLES)) : [];
    const rays = toward === "mountains" ? [...fan, ...peakRays] : [targetRay(next.lngLat, CALGARY, DOWNTOWN_SAMPLES)];
    const template = map ? terrainTemplate(map) : null;
    if (!template) {
      set((all) => ({ ...all, [askKey]: { status: "error", message: copy.noTerrain } }));
      return;
    }
    const load: TileLoader = (z, x, y) => {
      const id = `${z}/${x}/${y}`;
      const known = tiles.get(id);
      if (known) {
        // Most recently used goes to the back of the queue.
        tiles.delete(id);
        tiles.set(id, known);
        return known;
      }
      const loading = fetch(tileUrl(template, z, x, y)).then((response) => {
        if (response.status === 404 || response.status === 204) return null;
        if (!response.ok) throw Object.assign(new Error(`terrain ${response.status}`), { status: response.status });
        return decodeTile(response);
      });
      loading.catch(() => tiles.delete(id));
      tiles.set(id, loading);
      while (tiles.size > TILE_MEMORY) tiles.delete(tiles.keys().next().value!);
      return loading;
    };
    groundHeights(next.lngLat, rays, load).then(
      ({ ground, perRay }) => {
        if (!mine()) return;
        flight.current = null;
        if (ground === null) {
          set((all) => ({ ...all, [askKey]: { status: "error", message: copy.noData } }));
          return;
        }
        const eyeHeight = ground + next.eye;
        if (toward === "mountains") {
          const value: MountainView = {
            rays: fan.map((ray, index) => readRay(ray, perRay[index]!, ground, eyeHeight)),
            peaks: VIEW_PEAKS.flatMap((peak, index) => {
              const result = readTarget(peakRays[index]!, perRay[fan.length + index]!, eyeHeight);
              return result ? [{ peak, result }] : [];
            }),
          };
          setMountains((all) => ({ ...all, [askKey]: { status: "ready", value, ground } }));
        } else {
          const result = readTarget(rays[0]!, perRay[0]!, eyeHeight, DOWNTOWN_HEIGHT);
          if (!result) {
            setDowntown((all) => ({ ...all, [askKey]: { status: "error", message: copy.noData } }));
            return;
          }
          const value: DowntownView = { result, distances: rays[0]!.distances, heights: perRay[0]!, groundHeight: ground, eyeHeight };
          setDowntown((all) => ({ ...all, [askKey]: { status: "ready", value, ground } }));
        }
      },
      (caught: unknown) => {
        if (!mine()) return;
        flight.current = null;
        set((all) => {
          const rest = { ...all };
          if (isAbort(caught)) delete rest[askKey];
          else rest[askKey] = { status: "error", message: requestError(caught, lang) };
          return rest;
        });
      },
    );
  }

  // The sample spot the home is, if it is one and was not a building clicked on the map.
  const spotId = home && home.building === null ? (VIEW_SPOTS.find((spot) => spot.lngLat[0] === home.lngLat[0] && spot.lngLat[1] === home.lngLat[1])?.id ?? null) : null;

  function pickSpot(id: unknown) {
    // Pressing the pressed spot empties the group; the home stays.
    const spot = VIEW_SPOTS.find((entry) => entry.id === id);
    if (spot) pick({ lngLat: spot.lngLat, eye: DEFAULT_EYE, building: null });
  }

  function switchTarget(next: unknown) {
    // Pressing the pressed item empties a single ToggleGroup; the target stays.
    if (!isTarget(next) || next === target) return;
    setTarget(next);
    if (home) pick(home, next);
  }

  // The view in the air, as plain data: one surface, or the line to downtown.
  const scene = useMemo((): Scene | null => {
    if (!home || !current || current.status !== "ready") return null;
    if (mountainView) {
      const surface = viewSurface(home.lngLat, current.ground, home.eye, mountainView.rays);
      return surface ? { surface } : null;
    }
    if (downtownView) return { downtown: { ...downtownScene(home.lngLat, current.ground, home.eye, downtownView.result), visible: downtownView.result.visible } };
    return null;
  }, [home, current, mountainView, downtownView]);

  // deck.gl, loaded on the first view and drawn into the map's own WebGL, kept for the block's life.
  const deck = useRef<Promise<DeckKit> | null>(null);
  const overlay = useRef<{ setLayers(layers: unknown[]): void; remove(): void } | null>(null);
  useEffect(
    () => () => {
      overlay.current?.remove();
      overlay.current = null;
    },
    [map],
  );
  useEffect(() => {
    if (!map || !ready || (!scene && !overlay.current)) return;
    let live = true;
    const colours = { primary: rgba(tokenColor(map, "--primary")), muted: rgba(tokenColor(map, "--muted-foreground")) };
    (deck.current ??= loadDeck()).then(
      (kit) => {
        if (!live) return;
        overlay.current ??= kit.createDeckOverlay(map as never, {});
        overlay.current.setLayers(scene ? sceneLayers(kit, scene, colours) : []);
      },
      // The answer is in the panel either way; a renderer that will not load leaves the map plain.
      () => {
        deck.current = null;
      },
    );
    return () => {
      live = false;
    };
  }, [map, ready, scene]);

  const share = mountainView ? viewShare(mountainView.rays) : null;
  const block = mountainView ? widestBlock(mountainView.rays) : null;
  const seen = mountainView ? mountainView.peaks.filter((item) => item.result.visible) : [];
  const eyeText = home ? (home.building !== null && home.eye > DEFAULT_EYE ? copy.fromTop(formatHeight(home.eye, lang)) : copy.from(formatHeight(home.eye, lang))) : "";

  const headline = mountainView
    ? share === 0
      ? copy.noMountains
      : share === 1
        ? copy.allMountains
        : copy.score(formatShare(share!, lang))
    : downtownView
      ? downtownView.result.visible
        ? copy.downtownSeen(formatDistance(downtownView.result.distance, lang))
        : copy.downtownHidden(formatDistance(downtownView.result.distance, lang), formatDistance(downtownView.result.blocker?.distance ?? 0, lang))
      : "";
  const detail = mountainView
    ? [block && share !== 0 ? copy.blockedBy(compass(block.azimuth, lang), formatDistance(block.distance, lang)) : "", copy.peaksSeen(seen.length, mountainView.peaks.length)].filter(Boolean).join(" ")
    : "";

  return (
    <>
      {home ? (
        // A ring centred on the window, where the sight lines start: a pin would stand above it.
        <Marker
          key={`home:${homeKey(home)}`}
          mapId={VIEW_MAP_ID}
          lngLat={home.lngLat}
          markerContent={<span className="block size-4 rounded-full border-[3px] border-foreground bg-background" />}
        >
          <MarkerLabel position="top">{copy.home}</MarkerLabel>
        </Marker>
      ) : null}
      {mountainView
        ? mountainView.peaks.map(({ peak, result }) => (
            <Marker
              key={`peak:${peak.id}`}
              mapId={VIEW_MAP_ID}
              lngLat={peak.lngLat}
              markerContent={
                <span
                  data-visible={result.visible}
                  className="block size-2.5 rounded-full border-2 border-background bg-primary data-[visible=false]:bg-muted-foreground"
                />
              }
            >
              <MarkerLabel position="top" className={result.visible ? "font-medium" : "text-muted-foreground"}>
                {peak.name}
              </MarkerLabel>
            </Marker>
          ))
        : null}
      {target === "downtown" && home ? (
        <Marker key="downtown" mapId={VIEW_MAP_ID} lngLat={CALGARY} markerContent={<span className="block size-3 bg-foreground" />}>
          <MarkerLabel position="top">{copy.downtown}</MarkerLabel>
        </Marker>
      ) : null}
      <p data-unmap-view-announce="" aria-live="polite" aria-atomic="true" className="sr-only">
        {current?.status === "loading" ? copy.loading : headline}
      </p>
      {/*
        Wide: the controls float at the top left, clear of the mountains on the horizon, and the
        skyline runs along the bottom, under the home and its fan; from `md` it sits beside the
        controls rather than under them, so both fit a map only a few hundred pixels tall. When
        they still do not, the controls scroll and the skyline stays whole. Below `sm`: one sheet
        across the bottom, at most half the map, that scrolls.
      */}
      <div className="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col gap-3 overflow-y-auto overscroll-contain sm:pointer-events-none sm:inset-x-6 sm:top-6 sm:bottom-10 sm:max-h-none sm:justify-between sm:gap-4 sm:overflow-visible md:grid md:grid-cols-[22rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
        <Card className="shrink-0 sm:pointer-events-auto sm:min-h-0 sm:w-[22rem] sm:shrink sm:overflow-y-auto sm:overscroll-contain md:max-h-full md:self-start">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {copy.title}
            </CardTitle>
            <CardDescription className="max-sm:hidden">{copy.intro}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ToggleGroup
              variant="outline"
              aria-label={copy.target}
              value={[target]}
              onValueChange={(value: unknown[]) => switchTarget(value[0])}
              className="grid w-full grid-cols-2"
            >
              {VIEW_TARGETS.map((item) => (
                <ToggleGroupItem key={item} value={item} className="aria-pressed:font-semibold">
                  {copy.targets[item]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{copy.spotsLabel}</p>
              {/* The same toggle as the target above, so the spot picked shows the same way; a click on the map clears it. */}
              <ToggleGroup
                variant="outline"
                aria-label={copy.spotsLabel}
                value={spotId ? [spotId] : []}
                onValueChange={(value: unknown[]) => pickSpot(value[0])}
                className="grid w-full grid-cols-2"
              >
                {VIEW_SPOTS.map((spot) => (
                  <ToggleGroupItem key={spot.id} value={spot.id} className="aria-pressed:font-semibold">
                    {copy.spots[spot.id]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            {/* Where the answer lands, always there and tall enough for an error and its retry, so nothing jumps. */}
            <div data-unmap-view-answer="" className="flex min-h-20 flex-col justify-center gap-1 text-sm">
              {tooClose ? (
                <p className="text-muted-foreground">{copy.downtownHere}</p>
              ) : current?.status === "error" ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">{current.message}</span>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => home && pick(home, target, true)}>
                      {copy.retry}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : current?.status === "loading" ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Spinner /> <span>{copy.loading}</span>
                </p>
              ) : headline ? (
                <div className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
                  <p data-unmap-view-headline="" className="font-semibold tabular-nums">
                    {headline}
                  </p>
                  {mountainView && share !== null ? (
                    <div aria-hidden="true" className="h-2 w-full bg-muted-foreground/30">
                      <div className="h-full bg-primary" style={{ width: `${Math.round(share * 100)}%` }} />
                    </div>
                  ) : null}
                  {detail ? <p className="text-muted-foreground">{detail}</p> : null}
                  <p className="text-xs text-muted-foreground">{eyeText}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">{copy.pick}</p>
              )}
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <p>{copy.caveat}</p>
              <p>
                {copy.elevationCredit}{" "}
                <a className="underline underline-offset-2" href={VIEW_CREDITS.elevation[lang]} target="_blank" rel="noreferrer">
                  {copy.elevationSource}
                </a>
                .{" "}
                {copy.namesCredit}{" "}
                <a className="underline underline-offset-2" href={VIEW_CREDITS.names[lang]} target="_blank" rel="noreferrer">
                  {copy.namesSource}
                </a>
                ,{" "}
                <a className="underline underline-offset-2" href={VIEW_CREDITS.licence[lang]} target="_blank" rel="noreferrer">
                  {copy.licence}
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>
        {mountainView || downtownView ? (
          <Card className="shrink-0 sm:pointer-events-auto sm:w-full sm:max-w-3xl sm:self-center md:col-start-2 md:self-end md:justify-self-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                {mountainView ? copy.skyline : copy.crossSection}
              </CardTitle>
              <CardDescription className="text-xs max-sm:hidden">{mountainView ? copy.skylineHint : copy.crossHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {mountainView && home ? <Skyline view={mountainView} home={home} lang={lang} /> : null}
              {downtownView ? <CrossSection view={downtownView} lang={lang} /> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

/**
 * The skyline's drawing box, in SVG units; it scales to the card. Labels take the top rows. The
 * box is `width` units wide on a wide card and narrows with the card, down to `narrowest`, at
 * `scale` pixels a unit, so the names stay readable instead of shrinking with it.
 */
const SKY = { width: 1000, narrowest: 480, scale: 0.72, height: 230, ground: 206, rows: 3, row: 19, char: 7.4 };

/** The skyline's width in SVG units for a card `pixels` wide. */
function skyWidth(pixels: number): number {
  if (!(pixels > 0)) return SKY.width;
  return Math.round(Math.min(SKY.width, Math.max(SKY.narrowest, pixels / SKY.scale)));
}

/**
 * The horizon from the window, facing west: south on the left, north on the right. The skyline is
 * the steepest angle up in each direction, filled; where that skyline is mountains it takes your
 * --primary, where a nearer hill makes it, your --muted-foreground. Mountains hidden behind a
 * nearer hill are traced dashed above it. The angles are tiny (a mountain 100 km off stands about
 * a degree high), so the vertical is stretched to fit the card: it shows the order, not the size.
 */
function Skyline({ view, home, lang }: { view: MountainView; home: ViewHome; lang: ViewLang }) {
  const copy = VIEW_COPY[lang];
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [width, setWidth] = useState<number>(SKY.width);
  useEffect(() => {
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(skyWidth(svg.getBoundingClientRect().width)));
    observer.observe(svg);
    return () => observer.disconnect();
  }, [svg]);
  const read = view.rays.filter((result) => result.horizon);
  if (read.length < 2) return null;
  const from = view.rays[0]!.azimuth;
  const to = view.rays[view.rays.length - 1]!.azimuth;
  const peaks = view.peaks
    .map(({ peak, result }) => ({ peak, result, azimuth: bearingDegrees(home.lngLat, peak.lngLat) }))
    .filter((item) => item.azimuth >= from && item.azimuth <= to);
  const angles = [...read.flatMap((result) => [result.horizon!.angle, result.mountainAngle ?? result.horizon!.angle]), ...peaks.map((item) => item.result.angle)];
  const low = Math.min(...angles);
  const high = Math.max(...angles);
  const span = Math.max(high - low, 0.2);
  const top = SKY.rows * SKY.row + 14;
  const x = (azimuth: number) => ((azimuth - from) / (to - from)) * width;
  const y = (angle: number) => SKY.ground - 10 - ((angle - low) / span) * (SKY.ground - 10 - top);
  const outline = read.map((result) => `${x(result.azimuth).toFixed(1)},${y(result.horizon!.angle).toFixed(1)}`);
  const silhouette = `M0,${SKY.ground} L${outline.join(" L")} L${width},${SKY.ground} Z`;
  // The mountain stretches: consecutive clear lines, each a polygon of its own.
  const runs: RayResult[][] = [];
  for (const result of read) {
    if (!result.clear) continue;
    const last = runs[runs.length - 1];
    const previous = last?.[last.length - 1];
    if (last && previous && Math.abs(result.azimuth - previous.azimuth - FAN.step) < 1e-6) last.push(result);
    else runs.push([result]);
  }
  const half = (FAN.step / 2 / (to - from)) * width;
  const mountainPaths = runs.map((run) => {
    const left = Math.max(0, x(run[0]!.azimuth) - half);
    const right = Math.min(width, x(run[run.length - 1]!.azimuth) + half);
    const edge = run.map((result) => `${x(result.azimuth).toFixed(1)},${y(result.horizon!.angle).toFixed(1)}`);
    return `M${left.toFixed(1)},${SKY.ground} L${left.toFixed(1)},${y(run[0]!.horizon!.angle).toFixed(1)} L${edge.join(" L")} L${right.toFixed(1)},${y(run[run.length - 1]!.horizon!.angle).toFixed(1)} L${right.toFixed(1)},${SKY.ground} Z`;
  });
  // Hidden mountains: the steepest mountain on each blocked line, which the nearer ground outranks.
  const ghost = read
    .filter((result) => !result.clear && result.mountainAngle !== null)
    .map((result) => `${x(result.azimuth).toFixed(1)},${y(result.mountainAngle!).toFixed(1)}`);
  // Visible summits claim label rows first; a hidden one takes what is left, or goes unnamed.
  const ordered = [...peaks].sort((a, b) => Number(b.result.visible) - Number(a.result.visible) || a.azimuth - b.azimuth);
  const rows = labelRows(
    ordered.map((item) => ({ x: Math.min(Math.max(x(item.azimuth), 4 + (item.peak.name.length * SKY.char) / 2), width - 4 - (item.peak.name.length * SKY.char) / 2), width: item.peak.name.length * SKY.char })),
    SKY.rows,
  );
  return (
    <svg ref={setSvg} data-unmap-view-skyline="" viewBox={`0 0 ${width} ${SKY.height}`} className="h-auto w-full" role="img" aria-label={copy.skyline}>
      <rect x={0} y={0} width={width} height={SKY.ground} className="fill-muted" />
      <path d={silhouette} className="fill-muted-foreground/45" />
      {mountainPaths.map((d, index) => (
        <path key={index} d={d} className="fill-primary motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500" />
      ))}
      {ghost.length > 1 ? <polyline points={ghost.join(" ")} fill="none" strokeDasharray="6 5" strokeWidth={2} className="stroke-muted-foreground" /> : null}
      <rect x={0} y={SKY.ground} width={width} height={SKY.height - SKY.ground} className="fill-foreground/80" />
      {ordered.map(({ peak, result, azimuth }, index) => {
        const row = rows[index];
        if (row === null || row === undefined) return null;
        const px = x(azimuth);
        const label = Math.min(Math.max(px, 4 + (peak.name.length * SKY.char) / 2), width - 4 - (peak.name.length * SKY.char) / 2);
        const baseline = 14 + row * SKY.row;
        return (
          <g key={peak.id} data-visible={result.visible} className="text-[13px]">
            <line x1={px} y1={baseline + 4} x2={px} y2={y(result.angle) - 3} strokeWidth={1} strokeDasharray={result.visible ? undefined : "3 3"} className="stroke-foreground/60" />
            <text x={label} y={baseline} textAnchor="middle" className={result.visible ? "fill-foreground font-medium" : "fill-muted-foreground"}>
              {peak.name}
            </text>
          </g>
        );
      })}
      <g className="fill-background text-[13px] font-medium">
        <text x={8} y={SKY.height - 7}>{copy.south}</text>
        <text x={x(270)} y={SKY.height - 7} textAnchor="middle">
          {copy.west}
        </text>
        <text x={width - 8} y={SKY.height - 7} textAnchor="end">
          {copy.north}
        </text>
      </g>
    </svg>
  );
}

/** The cross-section's drawing box, in SVG units. */
const SECTION = { width: 1000, height: 180, pad: 12 };

/** The ground from the window to downtown, as the window sees it (the curve taken off), and the line to the top of the towers. */
function CrossSection({ view, lang }: { view: DowntownView; lang: ViewLang }) {
  const copy = VIEW_COPY[lang];
  const { distances, heights, groundHeight, eyeHeight, result } = view;
  const last = distances.length - 1;
  const seenHeights = heights.map((height, index) => (height === null ? null : height - curveDrop(distances[index]!)));
  const towerTop = (seenHeights[last] ?? eyeHeight) + DOWNTOWN_HEIGHT;
  const known = seenHeights.filter((height): height is number => height !== null);
  const low = Math.min(...known, eyeHeight) - 10;
  const high = Math.max(...known, eyeHeight, towerTop) + 10;
  const x = (metres: number) => SECTION.pad + (metres / distances[last]!) * (SECTION.width - 2 * SECTION.pad);
  const y = (metres: number) => SECTION.height - SECTION.pad - ((metres - low) / (high - low)) * (SECTION.height - 2 * SECTION.pad);
  const ground = [`${x(0)},${y(groundHeight).toFixed(1)}`]
    .concat(seenHeights.flatMap((height, index) => (height === null ? [] : [`${x(distances[index]!).toFixed(1)},${y(height).toFixed(1)}`])))
    .join(" L");
  const area = `M${x(0)},${SECTION.height} L${ground} L${x(distances[last]!)},${SECTION.height} Z`;
  return (
    <svg data-unmap-view-section="" viewBox={`0 0 ${SECTION.width} ${SECTION.height}`} className="h-auto w-full" role="img" aria-label={copy.crossSection}>
      <path d={area} className="fill-muted-foreground/45" />
      <rect x={x(distances[last]!) - 10} y={y(towerTop)} width={20} height={y(seenHeights[last] ?? low) - y(towerTop)} className="fill-foreground/80" />
      <line
        x1={x(0)}
        y1={y(eyeHeight)}
        x2={x(distances[last]!)}
        y2={y(towerTop)}
        strokeWidth={3}
        strokeDasharray={result.visible ? undefined : "8 6"}
        className={result.visible ? "stroke-primary" : "stroke-muted-foreground"}
      />
      {!result.visible && result.blocker ? <circle cx={x(result.blocker.distance)} cy={y(result.blocker.height - curveDrop(result.blocker.distance))} r={7} className="fill-destructive" /> : null}
      <circle cx={x(0)} cy={y(eyeHeight)} r={7} className="fill-primary stroke-background" strokeWidth={2} />
      <g className="fill-foreground text-[13px] font-medium">
        <text x={x(0) + 12} y={y(eyeHeight) - 10}>{copy.home}</text>
        <text x={x(distances[last]!) - 16} y={y(towerTop) - 8} textAnchor="end">
          {`${copy.downtown}, ${formatDistance(distances[last]!, lang)}`}
        </text>
      </g>
    </svg>
  );
}
