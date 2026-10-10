"use client";

/**
 * <Measure> - click the map to measure a distance, with Undo and Clear on your shadcn Button.
 *
 * Each click adds a point. The line between points follows the great circle and its length is the
 * haversine distance, so a line across the country is measured the way the Earth is shaped. While
 * the pointer is over the map a dashed line runs from the last point to it, and the label on the
 * map shows the total so far. Distances read in metres under 1 km and in kilometres above, written
 * the English or the French way (`lang`); `format` replaces the formatter. A double-click or
 * double-tap adds one point, not two, and does not zoom: the map's double-click zoom is off while
 * this is active. With the map focused, Escape hides the dashed line until the pointer moves and
 * Backspace undoes the last point.
 *
 * The line and points are drawn on top of the map in your `--primary` and marked as a tool's own
 * layers, so `<FeatureInspector>` skips them. They survive a style swap and come off the map when
 * this unmounts. `active={false}` stops adding points and keeps the measurement. It renders a bare
 * row: wrap it in your Card when it floats over the map.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HELPER_KEY, accentColor, labelFont, tokenColor, useLayerSet, type LayerSpec } from "@/lib/map-layers";
import { cn } from "@/lib/utils";

// --- measure helpers (kept identical across both lanes) ---

/** A position as [longitude, latitude]. */
export type LngLat = [number, number];

/** The part of a MapLibre pointer event the tool reads. */
export interface MapPointer {
  lngLat: { lng: number; lat: number };
  /** Where on the canvas, in CSS pixels. */
  point: { x: number; y: number };
  /** The DOM event behind it, read only to tell a finger from a mouse (see `measureClick`). */
  originalEvent?: object;
}

/** What `onChange` (Vue: `change`) reports: the points in click order and their length in metres. */
export interface MeasureChange {
  points: LngLat[];
  metres: number;
}

/** The Earth's mean radius in metres (IUGG): the sphere the haversine formula measures on. */
export const EARTH_RADIUS = 6_371_008.8;
const RADIANS = Math.PI / 180;

/** Great-circle distance in metres between two positions, by the haversine formula. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * RADIANS;
  const dLng = (b[0] - a[0]) * RADIANS;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RADIANS) * Math.cos(b[1] * RADIANS) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Length in metres of the line through `points`, segment by segment. */
export function pathLength(points: LngLat[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index++) total += haversine(points[index - 1]!, points[index]!);
  return total;
}

/** `lng` moved by whole turns to within 180 degrees of `reference`, so a line between them never wraps. */
function unwrapLng(lng: number, reference: number): number {
  return lng + Math.round((reference - lng) / 360) * 360;
}

/**
 * Points along the great circle from `a` to `b`, at most `spacing` metres apart, both ends
 * included, so the line drawn is the line measured. Each longitude is unwrapped against the one
 * before it, so the line never jumps across the map: past the antimeridian the longitudes run on
 * beyond 180 rather than back to -180.
 */
export function greatCircle(a: LngLat, b: LngLat, spacing = 50_000): LngLat[] {
  const distance = haversine(a, b);
  const steps = Math.ceil(distance / spacing);
  const angle = distance / EARTH_RADIUS;
  if (steps <= 1 || Math.sin(angle) < 1e-12) return [a, [unwrapLng(b[0], a[0]), b[1]]];
  const [lng1, lat1, lng2, lat2] = [a[0] * RADIANS, a[1] * RADIANS, b[0] * RADIANS, b[1] * RADIANS];
  const points: LngLat[] = [a];
  const unwrap = (lng: number) => unwrapLng(lng, points[points.length - 1]![0]);
  for (let index = 1; index < steps; index++) {
    const t = index / steps;
    const from = Math.sin((1 - t) * angle) / Math.sin(angle);
    const to = Math.sin(t * angle) / Math.sin(angle);
    const x = from * Math.cos(lat1) * Math.cos(lng1) + to * Math.cos(lat2) * Math.cos(lng2);
    const y = from * Math.cos(lat1) * Math.sin(lng1) + to * Math.cos(lat2) * Math.sin(lng2);
    const z = from * Math.sin(lat1) + to * Math.sin(lat2);
    points.push([unwrap(Math.atan2(y, x) / RADIANS), Math.atan2(z, Math.hypot(x, y)) / RADIANS]);
  }
  points.push([unwrap(b[0]), b[1]]);
  return points;
}

/**
 * Metres under 1 km (after rounding), kilometres above with 2, 1 or 0 decimals as the number
 * grows. French writes a decimal comma and a no-break space between thousands; both
 * languages keep the number and its unit together with a no-break space.
 */
export function formatDistance(metres: number, lang: "en" | "fr" = "en"): string {
  const fr = lang === "fr";
  const km = metres / 1000;
  const [value, unit, decimals]: [number, string, number] =
    Math.round(metres) < 1000 ? [Math.round(metres), "m", 0] : [km, "km", km < 9.995 ? 2 : km < 99.95 ? 1 : 0];
  const [integer, fraction] = value.toFixed(decimals).split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, fr ? " " : ",");
  return `${fraction === undefined ? grouped : `${grouped}${fr ? "," : "."}${fraction}`} ${unit}`;
}

export const MEASURE_COPY = {
  en: {
    group: "Measure",
    hint: "Click the map to measure.",
    distance: (value: string) => `Distance: ${value}`,
    undo: "Undo",
    clear: "Clear",
  },
  fr: {
    group: "Mesure",
    hint: "Cliquez sur la carte pour mesurer.",
    distance: (value: string) => `Distance : ${value}`,
    undo: "Annuler",
    clear: "Effacer",
  },
} as const;

type MeasureKind = "path" | "preview" | "vertex" | "label";

export interface MeasureFeature {
  type: "Feature";
  properties: { kind: MeasureKind; label?: string };
  geometry: { type: "Point"; coordinates: LngLat } | { type: "LineString"; coordinates: LngLat[] };
}

export interface MeasureData {
  type: "FeatureCollection";
  features: MeasureFeature[];
}

/**
 * What the measure layers draw: the path through `points` along great circles, a preview from
 * the last point to `pointer`, a vertex per point, and `label` at the end of the line. Each point
 * (and the pointer) is unwrapped against the one before it, so a path across the antimeridian is
 * one continuous line with its vertices and label on it, not segments that jump the map.
 */
export function measureData(points: LngLat[], pointer: LngLat | null, label: string): MeasureData {
  const features: MeasureFeature[] = [];
  const placed: LngLat[] = [];
  for (const point of points) {
    const previous = placed[placed.length - 1];
    placed.push(previous ? [unwrapLng(point[0], previous[0]), point[1]] : point);
  }
  if (placed.length >= 2) {
    const path: LngLat[] = [placed[0]!];
    for (let index = 1; index < placed.length; index++) {
      path.push(...greatCircle(placed[index - 1]!, placed[index]!).slice(1));
    }
    features.push({ type: "Feature", properties: { kind: "path" }, geometry: { type: "LineString", coordinates: path } });
  }
  const last = placed[placed.length - 1];
  const reach: LngLat | null = last && pointer ? [unwrapLng(pointer[0], last[0]), pointer[1]] : null;
  if (last && reach) {
    features.push({
      type: "Feature",
      properties: { kind: "preview" },
      geometry: { type: "LineString", coordinates: greatCircle(last, reach) },
    });
  }
  for (const point of placed) {
    features.push({ type: "Feature", properties: { kind: "vertex" }, geometry: { type: "Point", coordinates: point } });
  }
  if (last) {
    features.push({
      type: "Feature",
      properties: { kind: "label", label },
      geometry: { type: "Point", coordinates: reach ?? last },
    });
  }
  return { type: "FeatureCollection", features };
}

/** A click as the tool remembers it: where on the canvas, in CSS pixels, when, in ms, and by what. */
export interface MeasureClick {
  x: number;
  y: number;
  time: number;
  /** "touch" for a finger; anything else is read as a mouse or a pen. */
  pointerType?: string;
}

/**
 * How close, in pixels and milliseconds, a second click must land to be half of a double-click.
 * A finger lands much less precisely than a mouse, so a tap gets `touchPixels`.
 */
export const DOUBLE_CLICK = { pixels: 3, touchPixels: 30, ms: 500 } as const;

/** True when the page's primary pointer is coarse (a finger); false without `matchMedia` (server, tests). */
function coarsePointer(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * The click `event` was, as the tool remembers it. A tap is a click whose pointer is "touch". A
 * click is a PointerEvent in current browsers and says so in `pointerType`; Chromium's older
 * clicks say so in `sourceCapabilities`; a click with neither (older iOS Safari hands a tap on as
 * a plain MouseEvent) counts as a tap when the page's primary pointer is coarse.
 */
export function measureClick(event: MapPointer, time: number = Date.now()): MeasureClick {
  const original = event.originalEvent as
    | { pointerType?: string; sourceCapabilities?: { firesTouchEvents?: boolean } | null }
    | undefined;
  const touch = original?.pointerType
    ? original.pointerType === "touch"
    : original?.sourceCapabilities
      ? original.sourceCapabilities.firesTouchEvents === true
      : coarsePointer();
  return { x: event.point.x, y: event.point.y, time, pointerType: touch ? "touch" : "mouse" };
}

/**
 * True when `next` is the second half of a double-click or double-tap that `previous` began: on
 * screen within a few pixels of it (a trackpad never lands twice on one pixel; a finger lands
 * within a fingertip) and soon after.
 */
export function isRepeatClick(previous: MeasureClick | null, next: MeasureClick): boolean {
  const reach = next.pointerType === "touch" ? DOUBLE_CLICK.touchPixels : DOUBLE_CLICK.pixels;
  return (
    previous !== null &&
    next.time - previous.time <= DOUBLE_CLICK.ms &&
    Math.hypot(next.x - previous.x, next.y - previous.y) <= reach
  );
}

/**
 * What a key does while the map has focus (`event.target` is one of `focus`: the canvas or the
 * container): Escape hides the dashed line until the pointer moves, Backspace undoes the last
 * point. Keys typed into a field over the map, or pressed with a modifier, do nothing.
 */
export function measureKey(event: KeyboardEvent, focus: EventTarget[]): "cancel" | "undo" | null {
  if (!event.target || !focus.includes(event.target) || event.altKey || event.ctrlKey || event.metaKey) return null;
  return event.key === "Escape" ? "cancel" : event.key === "Backspace" ? "undo" : null;
}

/** Label text and halo on a page with no design tokens. */
const FALLBACK_TEXT = "#111111";
const FALLBACK_HALO = "#ffffff";

type LiveMap = Parameters<typeof labelFont>[0];

const kindIs = (kind: MeasureKind): ["==", ["get", string], string] => ["==", ["get", "kind"], kind];

/** The measure layers on `sourceId`, bottom first, in `color` or your `--primary`. */
export function measureLayers(live: LiveMap, sourceId: string, color: string | undefined): LayerSpec[] {
  const colour = accentColor(live, color, undefined);
  const halo = tokenColor(live, "--background") ?? FALLBACK_HALO;
  const text = tokenColor(live, "--foreground") ?? FALLBACK_TEXT;
  const metadata = { [HELPER_KEY]: true };
  return [
    {
      id: `${sourceId}-path`,
      type: "line",
      source: sourceId,
      filter: kindIs("path"),
      metadata,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": colour, "line-width": 2.5 },
    } as LayerSpec,
    {
      id: `${sourceId}-preview`,
      type: "line",
      source: sourceId,
      filter: kindIs("preview"),
      metadata,
      layout: { "line-cap": "round" },
      paint: { "line-color": colour, "line-width": 2, "line-dasharray": [2, 2], "line-opacity": 0.8 },
    } as LayerSpec,
    {
      id: `${sourceId}-vertex`,
      type: "circle",
      source: sourceId,
      filter: kindIs("vertex"),
      metadata,
      paint: { "circle-color": colour, "circle-radius": 4, "circle-stroke-color": halo, "circle-stroke-width": 1.5 },
    } as LayerSpec,
    {
      id: `${sourceId}-label`,
      type: "symbol",
      source: sourceId,
      filter: kindIs("label"),
      metadata,
      layout: {
        "text-field": ["get", "label"],
        "text-font": labelFont(live),
        "text-size": 12,
        "text-anchor": "left",
        "text-offset": [0.8, 0],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": text, "text-halo-color": halo, "text-halo-width": 1.5 },
    } as LayerSpec,
  ];
}
// --- end measure helpers ---

export interface MeasureProps {
  /** Map id when multiple maps share a page. Defaults to "default". */
  mapId?: string;
  /** Clicks add points while true. False keeps the measurement on the map. Defaults to true. */
  active?: boolean;
  /** Language of the readout, the buttons and the number format. Defaults to "en". */
  lang?: "en" | "fr";
  /** Line and point colour. Defaults to your --primary. */
  color?: string;
  /** Writes a distance in metres. Defaults to `formatDistance(metres, lang)`. */
  format?: (metres: number) => string;
  /** Called with the points and their length after every click, Undo and Clear. */
  onChange?: (change: MeasureChange) => void;
  className?: string;
}

export function Measure({ mapId, active = true, lang = "en", color, format, onChange, className }: MeasureProps) {
  const sourceId = `unmap-measure-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [points, setPoints] = useState<LngLat[]>([]);
  const [pointer, setPointer] = useState<LngLat | null>(null);
  const copy = MEASURE_COPY[lang];
  const write = format ?? ((metres: number) => formatDistance(metres, lang));
  const committed = pathLength(points);
  const last = points[points.length - 1];
  const preview = active && last ? pointer : null;
  const label = write(committed + (last && preview ? haversine(last, preview) : 0));
  const data = useMemo(() => measureData(points, preview, label), [points, preview, label]);

  const { map } = useLayerSet({
    mapId,
    sourceId,
    data,
    beforeId: null,
    key: color ?? "",
    layers: (live) => measureLayers(live, sourceId, color),
  });

  const latest = useRef({ points, onChange });
  latest.current = { points, onChange };
  const commit = (next: LngLat[]) => {
    // Two clicks before a re-render must see each other.
    latest.current.points = next;
    setPoints(next);
    latest.current.onChange?.({ points: next, metres: pathLength(next) });
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (!map || !active) return;
    let removed = false;
    let lastClick: MeasureClick | null = null;
    const canvas = map.getCanvas();
    const container = map.getContainer();
    const cursor = canvas.style.cursor;
    // A double-click would zoom as well as add a point; hand it back as it was found.
    const zoomOnDoubleClick = map.doubleClickZoom.isEnabled();
    const onRemove = () => {
      removed = true;
    };
    const onClick = (event: MapPointer) => {
      const click = measureClick(event);
      const repeat = isRepeatClick(lastClick, click);
      lastClick = click;
      if (repeat) return;
      commitRef.current([...latest.current.points, [event.lngLat.lng, event.lngLat.lat]]);
    };
    const onMove = (event: MapPointer) => {
      if (latest.current.points.length > 0) setPointer([event.lngLat.lng, event.lngLat.lat]);
    };
    const onOut = () => setPointer(null);
    const onKey = (event: KeyboardEvent) => {
      const action = measureKey(event, [canvas, container]);
      if (action === "cancel") {
        lastClick = null;
        setPointer(null);
      } else if (action === "undo" && latest.current.points.length > 0) {
        event.preventDefault();
        commitRef.current(latest.current.points.slice(0, -1));
      }
    };
    canvas.style.cursor = "crosshair";
    if (zoomOnDoubleClick) map.doubleClickZoom.disable();
    map.on("remove", onRemove);
    map.on("click", onClick);
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    container.addEventListener("keydown", onKey);
    return () => {
      map.off("remove", onRemove);
      map.off("click", onClick);
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      container.removeEventListener("keydown", onKey);
      setPointer(null);
      if (removed) return;
      canvas.style.cursor = cursor;
      if (zoomOnDoubleClick) map.doubleClickZoom.enable();
    };
  }, [map, active]);

  return (
    <div role="group" aria-label={copy.group} data-unmap-measure="" className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm tabular-nums" aria-live="polite" data-unmap-measure-total="">
        {points.length > 0 ? copy.distance(write(committed)) : copy.hint}
      </span>
      <Button type="button" variant="outline" size="sm" disabled={points.length === 0} onClick={() => commit(points.slice(0, -1))}>
        {copy.undo}
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={points.length === 0} onClick={() => commit([])}>
        {copy.clear}
      </Button>
    </div>
  );
}
