<script lang="ts">
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
</script>

<script setup lang="ts">
/**
 * <UnmapElevationExplorer> - an elevation page in one component, for Vue and Nuxt. The chart is
 * the second half of the map: pick a mountain trip, route your own by bike, or draw a line, and
 * its profile from unmap's elevation API runs along the bottom while the line on the
 * map takes the colour of its grade. Hover either half and the other answers: the chart follows
 * the line, and the map shows the height and the grade at the point the chart is on.
 *
 * Composes the registry's map, geocoder, draw, elevation-profile, route-line and marker-popup
 * items on your shadcn-vue Card, ToggleGroup, Button, Alert and Spinner, in your tokens. Each
 * request is billed, so each answer is asked for once and remembered for the life of the block: a
 * trip calls /route once; the search boxes call /geocode/autocomplete as you type, and
 * /geocode/reverse when you type coordinates; drawing calls nothing; each new line's profile is
 * one /elevation request for up to 500 samples (elevation-profile's default spacing), and a line
 * shown again comes from the block's profile cache. The grade colours come from the profile's own
 * samples, so they cost nothing extra.
 *
 * Installed by `npx shadcn-vue add` with its page at app/pages/elevation-explorer.vue. Edit freely.
 */
import { computed, nextTick, onScopeDispose, ref, shallowRef, useId, useTemplateRef, watch, type ComponentPublicInstance, type HTMLAttributes } from "vue";
import { Router } from "@unmap/routing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnmapDraw } from "@/components/ui/draw";
import { UnmapElevationProfile } from "@/components/ui/elevation-profile";
import { UnmapGeocoder } from "@/components/ui/geocoder";
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
    /** Where the map opens, [longitude, latitude]. Defaults to Banff. */
    center?: [number, number];
    /** Opening zoom. Defaults to 8. */
    zoom?: number;
    /** Language of the copy, the chart and the tools. Defaults to "en". */
    lang?: ExplorerLang;
    class?: HTMLAttributes["class"];
  }>(),
  { center: () => BANFF, zoom: 8, lang: "en" },
);

// Vue's inject reads only a component's ancestors, so `useMap()` here could not see the map this
// component renders. It resolves the store that map registers in instead (an outer one if there
// is one, else one it provides to it), the way compare-swipe does.
const mapStore = useMapStore();
const map = computed(() => mapStore.get(EXPLORER_MAP_ID)?.map ?? null);
const generation = computed(() => mapStore.get(EXPLORER_MAP_ID)?.generation ?? 0);

/** The profile cache elevation-profile takes: profiles already fetched, by their samples. */
type ProfileCache = NonNullable<InstanceType<typeof UnmapElevationProfile>["$props"]["cache"]>;
/** What the drawing tool holds, as it hands it over. */
type DrawnValue = NonNullable<InstanceType<typeof UnmapDraw>["$props"]["modelValue"]>;
/** A route asked for: loading, answered, or why it failed. */
type Asked = { status: "loading" } | { status: "ready"; trip: ExplorerTrip } | { status: "error"; message: string };
type Line = [number, number][];
/** The two sources that route: a trip, and your own. */
type Routed = "preset" | "route";

const copy = computed(() => EXPLORER_COPY[props.lang]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const router = computed(() => new Router({ key: props.apiKey, gateway: props.gateway }));
const source = ref<ExplorerSource>("preset");
// Each source keeps its own line, so switching back shows it again without asking again.
const presetId = ref<string | null>(null);
const from = shallowRef<ExplorerPlace | null>(null);
const to = shallowRef<ExplorerPlace | null>(null);
const drawn = shallowRef<DrawnValue | null>(null);
// Every route asked for, by key, remembered for the life of the block.
const asked = shallowRef<Record<string, Asked>>({});
// Every profile fetched, by its samples, so a line shown again is not billed again. Cleared with the routes.
const cache = new globalThis.Map<string, NonNullable<ReturnType<ProfileCache["get"]>>>();
// The profile's samples, with the line they were taken on.
const profile = shallowRef<{ line: Line; points: ExplorerPoint[] } | null>(null);
const hovered = shallowRef<ExplorerHover | null>(null);
const said = ref("");
// On a phone the sheet can fold to the profile's headline, to give the map back.
const folded = ref(false);
const flights: Record<Routed, { key: string; controller: AbortController } | null> = { preset: null, route: null };
const panels = useTemplateRef<HTMLElement>("panels");
const controls = useTemplateRef<ComponentPublicInstance>("controls");
const profileCard = useTemplateRef<ComponentPublicInstance>("profileCard");
const controlsId = useId();
const bodyId = useId();
const roadIds = useId();

const chosen = computed(() => EXPLORER_PRESETS.find((item) => item.id === presetId.value) ?? null);
const presetKey = computed(() => (chosen.value ? `preset:${chosen.value.id}` : null));
const routeKey = computed(() => (from.value && to.value ? `route:${placeKey(from.value)}>${placeKey(to.value)}` : null));
const key = computed(() => (source.value === "preset" ? presetKey.value : source.value === "route" ? routeKey.value : null));
const current = computed(() => (key.value ? asked.value[key.value] : undefined));
const drawnLine = computed(() => lastLine(drawn.value));
const line = computed<Line | null>(() => {
  if (source.value === "draw") return drawnLine.value;
  const answer = current.value;
  return answer?.status === "ready" ? answer.trip.coordinates : null;
});
const ends = computed(() =>
  source.value === "preset" && chosen.value
    ? { from: chosen.value.from, to: chosen.value.to }
    : source.value === "route"
      ? { from: from.value, to: to.value }
      : { from: null, to: null },
);
const name = computed(() => {
  if (!line.value) return null;
  if (source.value === "draw") return copy.value.drawn;
  const { from: start, to: end } = ends.value;
  return start && end ? copy.value.between(start.name, end.name) : null;
});
const points = computed(() => (profile.value && profile.value.line === line.value ? profile.value.points : null));
const isFolded = computed(() => folded.value && line.value !== null);
// The line as drawn on the map: with the profile's samples merged in once they arrive, and coloured by grade.
const graded = computed(() => (line.value && points.value ? gradedLine(line.value, points.value) : null));
const gradient = computed(() => (graded.value ? { values: graded.value.values, domain: GRADE_DOMAIN } : undefined));
const steepest = computed(() => (points.value ? steepestClimb(points.value) : null));
const summary = computed(() => (points.value ? profileSummary(points.value) : null));
const routed = computed(() => source.value !== "draw" && line.value !== null);
const sides = computed(() => labelSides(ends.value.from, ends.value.to));
const hoverGrade = computed(() => (hovered.value && points.value ? gradeAt(points.value, hovered.value.index) : null));
const hoverHeight = computed(() => {
  const point = hovered.value;
  if (!point) return "";
  return point.elevation === null ? copy.value.noHeight : formatElevation(point.elevation, props.lang);
});
const hoverLabel = computed(() =>
  hoverGrade.value === null ? hoverHeight.value : `${hoverHeight.value}, ${formatGrade(hoverGrade.value, props.lang)}`,
);
const readout = computed(() => {
  if (!line.value || !points.value) return "";
  const point = hovered.value;
  if (point) {
    const grade = hoverGrade.value === null ? "" : formatGrade(hoverGrade.value, props.lang);
    return copy.value.at(formatDistance(point.distance, props.lang), hoverHeight.value, grade);
  }
  const top = steepest.value;
  return top ? copy.value.steepest(formatGrade(top.grade, props.lang), formatDistance(top.distance, props.lang)) : copy.value.noClimb;
});
const answerText = computed(() => {
  const answer = current.value;
  if (answer?.status === "ready") {
    const by = copy.value.by[source.value === "route" ? ROUTE_MODE : PRESET_MODE];
    return `${formatDistance(answer.trip.distanceMeters, props.lang)} ${by}, ${formatDuration(answer.trip.durationSeconds)}`;
  }
  if (source.value === "draw") return line.value ? `${copy.value.drawn}, ${formatDistance(lineLength(line.value), props.lang)}` : copy.value.drawHint;
  return source.value === "route" ? copy.value.needEnds : copy.value.pickTrip;
});
// The folded headline: the climb, set large, its unit and the length quieter.
const climb = computed(() => {
  const total = summary.value;
  if (!total) return null;
  const text = formatElevation(total.gain, props.lang);
  const at = text.lastIndexOf(" ");
  return { amount: text.slice(0, at), rest: `${copy.value.climb(text.slice(at + 1))}, ${formatDistance(total.distance, props.lang)}` };
});

const element = (target: ComponentPublicInstance | HTMLElement | null) =>
  (target && "$el" in target ? (target.$el as HTMLElement) : target) ?? null;

function padding(gutter = GUTTER): ExplorerPadding {
  const container = map.value?.getContainer();
  const none = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  if (!container) return framePadding(none, [], gutter);
  const rect = (target: ComponentPublicInstance | HTMLElement | null) => element(target)?.getBoundingClientRect?.() ?? null;
  // Wide, the controls sit at the left and the profile along the bottom; on a phone they are one sheet.
  const boxes = isWide() ? [rect(controls.value), rect(profileCard.value)] : [rect(panels.value)];
  return framePadding(container.getBoundingClientRect(), boxes, gutter);
}
const duration = () => (prefersReducedMotion() ? 0 : CAMERA_MS);
function frame(next: Line) {
  map.value?.fitBounds(lineBounds(next), { padding: padding(FRAME_GUTTER), maxZoom: ROUTE_MAX_ZOOM, duration: duration() });
}
/** Frames a routed line once it is on screen: after the render that shows it, so the panels have their final size. */
function frameShown(next: Line) {
  void nextTick(() => {
    if (line.value === next) frame(next);
  });
}

onScopeDispose(() => {
  flights.preset?.controller.abort();
  flights.route?.controller.abort();
});

// A new line starts quiet: its samples, its hover and its sentence belong to the old one.
watch(
  line,
  (next) => {
    hovered.value = null;
    said.value = "";
    // On a phone, bring the profile into view in the sheet (the sheet scrolls, never the page).
    const sheet = panels.value;
    const card = element(profileCard.value);
    if (next && sheet && card && !isWide() && sheet.scrollHeight > sheet.clientHeight) sheet.scrollTop = card.offsetTop;
  },
  { flush: "post" },
);

// Folding or unfolding the sheet changes how much map there is: frame the line again.
watch(
  isFolded,
  () => {
    if (line.value && source.value !== "draw") frame(line.value);
  },
  { flush: "post" },
);

// One end chosen in the search boxes: the map eases to it, clear of the panels. This runs after
// the search box's own fly to the result, and takes over from it.
const fromKey = computed(() => (from.value ? placeKey(from.value) : ""));
const toKey = computed(() => (to.value ? placeKey(to.value) : ""));
watch([fromKey, toKey], () => {
  const live = map.value;
  if (!live || source.value !== "route") return;
  const start = from.value;
  const end = to.value;
  if (start && end) {
    if (routeKey.value && asked.value[routeKey.value]?.status === "ready") return;
    frame([start.lngLat, end.lngLat]);
    return;
  }
  const place = start ?? end;
  if (!place) return;
  live.easeTo({ center: place.lngLat, zoom: Math.max(live.getZoom(), 12), offset: paddingOffset(padding()), duration: duration() });
});

// A new key or gateway is a new account: forget what the old one was told.
watch(router, () => {
  flights.preset?.controller.abort();
  flights.route?.controller.abort();
  flights.preset = null;
  flights.route = null;
  asked.value = {};
  cache.clear();
  presetId.value = null;
});

// The grade line under the drawing's handles, and the profile's dot on top: now, after every
// swap, and whenever the drawing adds its layers while it is out.
watch(
  [map, generation, source, gradient],
  (_next, _previous, onCleanup) => {
    const live = map.value;
    if (!live) return;
    keepOrder(live);
    if (source.value !== "draw") return;
    const hold = () => keepOrder(live);
    live.on("styledata", hold);
    onCleanup(() => live.off("styledata", hold));
  },
  { flush: "post", immediate: true },
);

/**
 * The route for one key: remembered, or asked once. A newer request from the same source
 * overtakes one in flight (its answer would be for ends no longer chosen); the other source's
 * request lands in the memory, since it is billed either way.
 */
function ask(kind: Routed, routeFor: string, start: ExplorerPlace, end: ExplorerPlace) {
  const known = asked.value[routeFor];
  if (known?.status === "ready") {
    frameShown(known.trip.coordinates);
    return;
  }
  const flying = flights[kind];
  if (flying?.key === routeFor) return;
  if (flying) {
    flying.controller.abort();
    const rest = { ...asked.value };
    delete rest[flying.key];
    asked.value = rest;
  }
  const controller = new AbortController();
  flights[kind] = { key: routeFor, controller };
  const mine = () => flights[kind]?.controller === controller;
  asked.value = { ...asked.value, [routeFor]: { status: "loading" } };
  const mode = kind === "preset" ? PRESET_MODE : ROUTE_MODE;
  router.value.route(start.lngLat, end.lngLat, { mode, signal: controller.signal }).then(
    (result) => {
      if (!mine()) return;
      flights[kind] = null;
      const trip = { coordinates: result.geometry.coordinates, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds };
      asked.value = { ...asked.value, [routeFor]: { status: "ready", trip } };
      // Framed only if the reader is still looking at it; otherwise it waits in the memory.
      if (key.value === routeFor) frameShown(trip.coordinates);
    },
    (caught: unknown) => {
      if (!mine()) return;
      flights[kind] = null;
      const rest = { ...asked.value };
      if (isAbort(caught)) delete rest[routeFor];
      else rest[routeFor] = { status: "error", message: requestError(caught, props.lang) };
      asked.value = rest;
    },
  );
}

function pickPreset(item: ExplorerPreset) {
  presetId.value = item.id;
  folded.value = false;
  ask("preset", `preset:${item.id}`, item.from, item.to);
}

function retry() {
  const routeFor = key.value;
  if (!routeFor) return;
  const rest = { ...asked.value };
  delete rest[routeFor];
  asked.value = rest;
  if (source.value === "preset" && chosen.value) ask("preset", routeFor, chosen.value.from, chosen.value.to);
  if (source.value === "route" && from.value && to.value) ask("route", routeFor, from.value, to.value);
}

function choose(end: "from" | "to", result: { name: string; lng: number; lat: number }) {
  const place: ExplorerPlace = { name: result.name, lngLat: [result.lng, result.lat] };
  if (end === "from") from.value = place;
  else to.value = place;
  folded.value = false;
  const start = from.value;
  const finish = to.value;
  if (start && finish) ask("route", `route:${placeKey(start)}>${placeKey(finish)}`, start, finish);
}

function switchSource(next: unknown) {
  // Pressing the pressed item empties a single ToggleGroup; the source stays.
  if (!isSource(next) || next === source.value) return;
  source.value = next;
  // A routed line already known is framed again when its source comes back.
  const known = key.value ? asked.value[key.value] : undefined;
  if (known?.status === "ready") frameShown(known.trip.coordinates);
}

function onProfile(next: { points: ExplorerPoint[] } | null) {
  const shown = line.value;
  if (!next || !shown) {
    profile.value = null;
    return;
  }
  // An answer for a line no longer on screen is not this line's profile.
  if (!profileBelongs(next.points, shown)) return;
  profile.value = { line: shown, points: next.points };
  said.value = name.value ? describeProfile(name.value, next.points, props.lang) : "";
}

function onHover(point: ExplorerHover | null) {
  hovered.value = point;
}

function onDraw(value: DrawnValue) {
  drawn.value = value;
}
</script>

<template>
  <!-- Where the map would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="elevation-explorer"
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
  <div v-else data-unmap-block="elevation-explorer" :class="['relative h-full min-h-[480px]', props.class]">
    <UnmapMap
      :id="EXPLORER_MAP_ID"
      :api-key="props.apiKey"
      :gateway="props.gateway"
      :center="props.center"
      :zoom="props.zoom"
      :lang="props.lang"
      :class="['h-full', GRADE_TOKENS]"
    >
      <!-- Beside the map's zoom buttons, which hold the top-right corner. -->
      <UnmapDraw
        v-if="source === 'draw'"
        :map-id="EXPLORER_MAP_ID"
        :id="EXPLORER_LAYERS.draw"
        :modes="LINE_ONLY"
        :model-value="drawn ?? undefined"
        :lang="props.lang"
        position="top-right"
        class="right-12"
        @update:model-value="onDraw"
      />
      <!-- A routed line sits below the labels; a drawn one over the drawing's own line, so its grades show, and under its handles. -->
      <UnmapRouteLine
        v-if="line"
        :map-id="EXPLORER_MAP_ID"
        :id="EXPLORER_LAYERS.line"
        :coordinates="graded?.coordinates ?? line"
        :gradient="gradient"
        :before-id="source === 'draw' ? `${EXPLORER_LAYERS.draw}-point` : undefined"
      />
      <!-- The start: a ring in --foreground. The end: your pin in --primary. Each is named. -->
      <UnmapMarker
        v-if="source !== 'draw' && ends.from"
        :key="`from:${placeKey(ends.from)}`"
        :map-id="EXPLORER_MAP_ID"
        :lng-lat="ends.from.lngLat"
      >
        <template #marker>
          <span class="block size-4 rounded-full border-[3px] border-foreground bg-background" />
        </template>
        <UnmapMarkerLabel :position="sides.from">{{ ends.from.name }}</UnmapMarkerLabel>
      </UnmapMarker>
      <UnmapMarker v-if="source !== 'draw' && ends.to" :key="`to:${placeKey(ends.to)}`" :map-id="EXPLORER_MAP_ID" :lng-lat="ends.to.lngLat">
        <UnmapMarkerLabel :position="sides.to">{{ ends.to.name }}</UnmapMarkerLabel>
      </UnmapMarker>
      <!-- The map's answer to a hover: the height and grade where the chart is, above the profile's own dot. -->
      <UnmapMarker v-if="hovered && points" :map-id="EXPLORER_MAP_ID" :lng-lat="[hovered.lng, hovered.lat]">
        <template #marker>
          <span class="block size-4" />
        </template>
        <UnmapMarkerLabel position="top" class="tabular-nums">{{ hoverLabel }}</UnmapMarkerLabel>
      </UnmapMarker>
      <!-- While the line on screen is being routed, the wait is said; then the profile's sentence. -->
      <p data-unmap-explorer-announce="" aria-live="polite" aria-atomic="true" class="sr-only">{{ current?.status === "loading" ? copy.loading : said }}</p>
      <!--
        Wide: the controls float at the top left and the profile runs along the bottom, the chart
        as the map's second half. Below `sm`: one sheet across the bottom, at most half the map,
        clear of the attribution, that scrolls and folds to the profile's headline.
      -->
      <div
        ref="panels"
        class="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col gap-3 overflow-y-auto overscroll-contain sm:pointer-events-none sm:inset-x-6 sm:top-6 sm:bottom-10 sm:max-h-none sm:justify-between sm:gap-4 sm:overflow-visible motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
      >
        <Card
          :id="controlsId"
          ref="controls"
          :data-folded="isFolded"
          class="shrink-0 max-sm:data-[folded=true]:hidden sm:pointer-events-auto sm:min-h-0 sm:w-[22rem] sm:shrink"
        >
          <CardHeader>
            <CardTitle role="heading" aria-level="2">{{ copy.title }}</CardTitle>
            <!-- On a phone, or a short window, the controls say it with their labels alone. -->
            <CardDescription class="max-sm:hidden [@media(max-height:45rem)]:hidden">{{ copy.intro }}</CardDescription>
          </CardHeader>
          <CardContent class="flex min-h-0 flex-col gap-4 sm:overflow-y-auto sm:overscroll-contain">
            <ToggleGroup
              type="single"
              variant="outline"
              :aria-label="copy.source"
              :model-value="source"
              class="grid w-full shrink-0 grid-cols-3"
              @update:model-value="switchSource"
            >
              <ToggleGroupItem v-for="item in EXPLORER_SOURCES" :key="item" :value="item" class="aria-pressed:font-semibold">
                {{ copy.sources[item] }}
              </ToggleGroupItem>
            </ToggleGroup>
            <div v-if="source === 'preset'" class="flex flex-col gap-2">
              <Button
                v-for="item in EXPLORER_PRESETS"
                :key="item.id"
                type="button"
                :variant="item.id === presetId ? 'secondary' : 'outline'"
                :aria-pressed="item.id === presetId"
                :aria-describedby="`${roadIds}-${item.id}`"
                class="h-auto w-full flex-col items-start gap-0.5 py-2 text-left aria-pressed:font-semibold"
                @click="pickPreset(item)"
              >
                <span class="flex items-center gap-1.5">
                  <!-- Picked is marked by a check as well as the fill. -->
                  <span v-if="item.id === presetId" aria-hidden="true" data-pressed-mark="">✓</span>
                  {{ copy.between(item.from.name, item.to.name) }}
                </span>
                <span :id="`${roadIds}-${item.id}`" aria-hidden="true" class="text-xs font-normal text-muted-foreground">{{ copy.roads[item.id] }}</span>
              </Button>
              <p class="text-xs text-muted-foreground">
                {{ copy.namesCredit }} <a class="underline underline-offset-2" :href="EXPLORER_CREDITS.names[props.lang]" target="_blank" rel="noreferrer">{{ copy.namesSource }}</a>, <a class="underline underline-offset-2" :href="EXPLORER_CREDITS.licence[props.lang]" target="_blank" rel="noreferrer">{{ copy.licence }}</a>.
              </p>
            </div>
            <div v-if="source === 'route'" class="flex flex-col gap-2">
              <div class="relative flex flex-col gap-2">
                <!-- The rail from the start's ring to the end's dot, the shapes the map pins use. -->
                <span aria-hidden="true" class="absolute top-1/4 bottom-1/4 left-1.5 -translate-x-1/2 border-l border-dashed border-border" />
                <div class="flex items-center gap-3">
                  <span aria-hidden="true" class="relative size-3 shrink-0 rounded-full border-2 border-foreground bg-background" />
                  <!-- `[&>p]:hidden` hides the <p> coverage line the geocoder renders after its combobox; the line below both boxes says it once. -->
                  <UnmapGeocoder
                    :map-id="EXPLORER_MAP_ID"
                    :api-key="props.apiKey"
                    :gateway="props.gateway"
                    :lang="props.lang"
                    :placeholder="copy.from"
                    proximity="map"
                    :fly-to-zoom="12"
                    class="[&>p]:hidden"
                    @select="(result) => choose('from', result)"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span aria-hidden="true" class="relative size-3 shrink-0 rounded-full bg-primary" />
                  <UnmapGeocoder
                    :map-id="EXPLORER_MAP_ID"
                    :api-key="props.apiKey"
                    :gateway="props.gateway"
                    :lang="props.lang"
                    :placeholder="copy.to"
                    proximity="map"
                    :fly-to-zoom="12"
                    class="[&>p]:hidden"
                    @select="(result) => choose('to', result)"
                  />
                </div>
              </div>
              <p class="pl-6 text-xs text-muted-foreground">{{ copy.byBike }}</p>
            </div>
            <!-- Where the route lands, always there and tall enough for an error and its retry, so nothing jumps. -->
            <div data-unmap-explorer-answer="" class="flex min-h-16 shrink-0 flex-col justify-center gap-1 text-sm">
              <Alert v-if="current?.status === 'error'" variant="destructive" role="alert">
                <AlertDescription class="flex flex-row flex-wrap items-center justify-between gap-2">
                  <span class="min-w-0">{{ current.message }}</span>
                  <Button type="button" variant="outline" size="sm" class="shrink-0" @click="retry">{{ copy.retry }}</Button>
                </AlertDescription>
              </Alert>
              <p v-else-if="current?.status === 'loading'" class="flex items-center gap-2 text-muted-foreground">
                <Spinner /> <span>{{ copy.loading }}</span>
              </p>
              <p
                v-else-if="current?.status === 'ready'"
                class="text-muted-foreground tabular-nums motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
              >
                {{ answerText }}
              </p>
              <p v-else class="text-muted-foreground tabular-nums">{{ answerText }}</p>
            </div>
          </CardContent>
        </Card>
        <Card ref="profileCard" class="shrink-0 sm:pointer-events-auto sm:w-full sm:max-w-5xl">
          <CardHeader>
            <div class="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level="2" class="min-w-0 truncate">{{ name ?? copy.profile }}</CardTitle>
              <Button
                v-if="line"
                type="button"
                variant="ghost"
                size="sm"
                class="shrink-0 sm:hidden"
                :aria-expanded="!isFolded"
                :aria-controls="`${controlsId} ${bodyId}`"
                @click="folded = !folded"
              >
                {{ isFolded ? copy.unfold : copy.fold }}
              </Button>
            </div>
            <p v-if="isFolded && climb" data-unmap-explorer-folded="" class="flex items-baseline gap-1 tabular-nums sm:hidden">
              <span class="text-2xl leading-none font-semibold">{{ climb.amount }}</span> <span class="text-sm text-muted-foreground">{{ climb.rest }}</span>
            </p>
          </CardHeader>
          <CardContent :id="bodyId" :data-folded="isFolded" class="flex flex-col gap-3 max-sm:data-[folded=true]:hidden">
            <!--
              The chart's place, held at the result's height in every state so the camera frames
              once and nothing jumps; dashed while it waits for a line. The block speaks for the
              profile and credits it with links, so the profile's own live region and plain
              source line step aside.
            -->
            <div
              :data-empty="line === null"
              class="flex min-h-64 flex-col justify-center sm:min-h-[13.5rem] data-[empty=true]:rounded-md data-[empty=true]:border data-[empty=true]:border-dashed data-[empty=true]:p-4 data-[empty=true]:text-center"
            >
              <UnmapElevationProfile
                :api-key="props.apiKey"
                :gateway="props.gateway"
                :map-id="EXPLORER_MAP_ID"
                :id="EXPLORER_LAYERS.profile"
                :line="line"
                :lang="props.lang"
                :cache="cache"
                class="[&_[data-unmap-elevation-announce]]:hidden [&_[data-unmap-elevation-source]]:hidden"
                @profile="onProfile"
                @hover="onHover"
              />
            </div>
            <!-- The grade: its ramp, the same one the line is drawn in, and what the pointer or the steepest stretch says. Reserved, so nothing jumps. -->
            <div class="flex min-h-10 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div v-if="gradient" data-unmap-grade-legend="" class="flex min-w-0 flex-col gap-1 sm:w-64">
                <div aria-hidden="true" class="relative h-2 rounded-sm" :style="{ background: GRADE_RAMP }">
                  <span class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-background" />
                </div>
                <div class="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{{ `${formatGrade(GRADE_DOMAIN[0], props.lang, 0)} ${copy.down}` }}</span>
                  <span class="font-medium text-foreground">{{ copy.grade }}</span>
                  <span>{{ `${formatGrade(GRADE_DOMAIN[1], props.lang, 0)} ${copy.up}` }}</span>
                </div>
              </div>
              <div class="flex min-w-0 flex-col gap-0.5 sm:items-end">
                <p data-unmap-explorer-readout="" class="text-sm font-medium tabular-nums">{{ readout }}</p>
                <p v-if="points" class="text-xs text-muted-foreground max-sm:hidden">{{ copy.hoverHint }}</p>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ copy.elevationCredit }} <a class="underline underline-offset-2" :href="EXPLORER_CREDITS.elevation[props.lang]" target="_blank" rel="noreferrer">{{ copy.elevationSource }}</a>.<template v-if="routed">{{ " " }}{{ copy.routesCredit }} <a class="underline underline-offset-2" :href="EXPLORER_CREDITS.routes.source" target="_blank" rel="noreferrer">{{ copy.routesSource }}</a>, <a class="underline underline-offset-2" :href="EXPLORER_CREDITS.routes.licence" target="_blank" rel="noreferrer">{{ copy.routesLicence }}</a>.</template>
            </p>
          </CardContent>
        </Card>
      </div>
    </UnmapMap>
  </div>
</template>
