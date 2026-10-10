"use client";

/**
 * <FlowLayer> - origin-destination flows, the flowmap.blue look on plain MapLibre: curved lines
 * whose width follows volume, arrowheads mid-line show direction, and a circle at each location
 * sized by everything flowing in and out of it.
 *
 * `locations` is `{ id, name?, lat, lon }[]`; `flows` is `{ origin, dest, count, time? }[]`, where
 * `origin` and `dest` are location ids. Flows between the same pair are summed; `timeRange`,
 * `minCount` and `topN` choose what is drawn. A flow from a place to itself, or between two
 * places at the same coordinates, is not drawn and counts toward no location's total.
 *
 * The model is rebuilt when `locations` or `flows` change identity: pass stable arrays (useState,
 * useMemo) for large tables. New data, even with a new range, updates the sources in place, so
 * the hover highlight and the layer order survive a live feed.
 *
 * Widths and circle sizes scale over what is drawn, so the largest drawn flow is always the widest.
 * Pass `countDomain` and `totalDomain` to scale over fixed bounds instead: give every year of a
 * table the same bounds and a width means the same count in each.
 *
 * `cluster` merges nearby locations as you zoom out and re-sums the flows between the clusters;
 * a flow inside one cluster is not drawn but still counts toward its totals. It is recomputed
 * when the map stops moving, at whole zoom levels.
 *
 * Colour defaults to your `--primary` (or the theme accent, per the Map's accent), with location
 * circles stroked in `--background`. The layers sit below the labels and survive a style swap.
 * Pass `onClick` or `onHover` (or `interactive`) to highlight and report the flow or location under
 * the pointer: a flow carries `{ origin, dest, count }`, a location `{ id, name, in, out, total }`.
 * A cluster carries `{ id, in, out, total, places }`: no name, and `places` is how many locations
 * it holds, so you can label it in your own words.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Supercluster from "supercluster";
import { useMap } from "@/lib/map-context";
import {
  accentColor,
  arcBearing,
  arcLine,
  flowArrowImage,
  themeMeta,
  tokenColor,
  useLayerPointer,
  useLayerSet,
  type BeforeId,
  type LayerSpec,
  type MapFeatureEvent,
} from "@/lib/map-layers";

export interface FlowLocation {
  id: string;
  name?: string;
  /** Numeric strings are read as numbers; a location without finite coordinates is skipped. */
  lat: number;
  lon: number;
}

export interface Flow {
  /** Location id the flow starts at. */
  origin: string;
  /** Location id the flow ends at. */
  dest: string;
  /** Volume. A numeric string is read as a number; a count that is not positive is dropped. */
  count: number;
  /** A number, or a date string `Date.parse` reads. Flows without one pass every `timeRange`. */
  time?: string | number;
}

type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: unknown };
type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

export interface FlowModel {
  /**
   * One arc per origin-destination pair, properties { key, origin, dest, originName, destName, count, t },
   * where `t` is the count scaled to 0..1 over the drawn range (0.5 when every count is the same).
   */
  lines: FeatureCollection;
  /** One point at each arc's midpoint, properties { key, count, t, bearing }. */
  arrows: FeatureCollection;
  /**
   * One point per location with any flow, properties { id, name, in, out, total, tr }, where `tr`
   * is sqrt(total) scaled to 0..1 over the drawn range (0.5 when every total is the same). A
   * cluster from `flowClusters` has `places` (how many locations) and no `name`, and a line to or
   * from it no `originName` or `destName`.
   */
  locations: FeatureCollection;
  /** Range of drawn counts and location totals, for scaling. */
  count: [number, number];
  total: [number, number];
}

export interface FlowModelOptions {
  /** Keep flows whose `time` is within this range, inclusive. */
  timeRange?: [string | number, string | number];
  /** Draw only the N largest pairs. Not a finite number: no limit. */
  topN?: number;
  /** Draw only pairs whose summed count is at least this. Not a finite number: no limit. */
  minCount?: number;
  /** How far flows bow, as a fraction of their length. Defaults to 0.25. */
  curvature?: number;
  /** Points per flow line. Defaults to 48. */
  samples?: number;
  /**
   * The counts that draw the thinnest and the widest line, instead of the range of what is drawn.
   * Give every model the same domain (each year of one table, say) and a width means the same count
   * in all of them. A count outside it clamps. Defaults to the drawn range.
   */
  countDomain?: [number, number];
  /**
   * The same for location totals and circle size, compared as square roots. Defaults to the drawn
   * range.
   */
  totalDomain?: [number, number];
}

/** A finite number, or a string that reads as one (`"2020"`, an untyped CSV cell); otherwise NaN. */
function numeric(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : NaN;
}

/**
 * Whether `time` falls in `range`, inclusive. When all three are numbers or numeric strings
 * (`"2020"`, a raw range input's value) they compare as numbers. Otherwise strings go through
 * `Date.parse` and numbers are read as epoch milliseconds. Anything that does not parse, such as
 * a period label like "2020/2021", keeps the flow, as does a flow with no time.
 */
function inRange(time: string | number | undefined, range: [string | number, string | number] | undefined): boolean {
  if (time === undefined || time === null || !range) return true;
  const values = [time, range[0], range[1]];
  const numbers = values.map(numeric);
  const [t, lo, hi] = numbers.every(Number.isFinite)
    ? numbers
    : values.map((value) => (typeof value === "number" ? value : Date.parse(value)));
  if (!Number.isFinite(t) || !Number.isFinite(lo) || !Number.isFinite(hi)) return true;
  return t! >= lo! && t! <= hi!;
}

/** [min, max], or [0, 0] for none. A loop, not a spread: a large flow table overflows the stack. */
function extent(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

/**
 * `value` scaled to 0..1 over `[min, max]`, or 0.5 when they are equal. Paint interpolates over
 * this rather than over raw counts, so a new range is new data, not new layers.
 */
function unit(value: number, [min, max]: [number, number]): number {
  return max > min ? (value - min) / (max - min) : 0.5;
}

/** `value` kept within 0..1: a count outside a fixed domain draws at its thinnest or widest. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** The fixed scales a model may draw on instead of its own drawn range. */
type Domains = Pick<FlowModelOptions, "countDomain" | "totalDomain">;

type Pair = { origin: string; dest: string; count: number };

/** Where a flow can start or end: a location, or a cluster of them (no name; `places` is how many). */
type Place = { id: string; name?: string; lon: number; lat: number; places?: number };

/**
 * Sum per origin-destination pair and rank by count, descending. A pair with an unknown end, or
 * whose ends are one place or two places at the same point, has no length to draw: it is dropped
 * here, before anything is summed.
 */
function sumPairs(places: Map<string, Place>, flows: Iterable<Pair>): [string, Pair][] {
  const pairs = new Map<string, Pair>();
  for (const flow of flows) {
    const o = places.get(flow.origin);
    const d = places.get(flow.dest);
    if (!o || !d || flow.origin === flow.dest || (o.lon === d.lon && o.lat === d.lat)) continue;
    const key = `${flow.origin}->${flow.dest}`;
    const pair = pairs.get(key);
    if (pair) pair.count += flow.count;
    else pairs.set(key, { origin: flow.origin, dest: flow.dest, count: flow.count });
  }
  return [...pairs.entries()].sort(([, a], [, b]) => b.count - a.count);
}

/**
 * The three collections a flow map draws from ranked pairs: an arc and a mid-line arrow per pair,
 * and a circle at every place with a total, each scaled over what is drawn, or over `domains` when
 * given. `internal` is flow that stays inside a place (between a cluster's own members): it adds to
 * that place's in and out.
 */
function drawFlows(
  places: Map<string, Place>,
  ranked: [string, Pair][],
  curvature: number,
  samples: number,
  domains: Domains = {},
  internal: Map<string, number> = new Map(),
): FlowModel {
  const countRange = extent(ranked.map(([, pair]) => pair.count));
  const countScale = domains.countDomain ?? countRange;

  const totals = new Map<string, { in: number; out: number }>();
  const tally = (id: string) => {
    const entry = totals.get(id) ?? { in: 0, out: 0 };
    totals.set(id, entry);
    return entry;
  };
  for (const [id, count] of internal) {
    tally(id).in += count;
    tally(id).out += count;
  }
  const lines: Feature[] = [];
  const arrows: Feature[] = [];
  for (const [key, { origin, dest, count }] of ranked) {
    const o = places.get(origin)!;
    const d = places.get(dest)!;
    tally(origin).out += count;
    tally(dest).in += count;
    const line = arcLine([o.lon, o.lat], [d.lon, d.lat], curvature, samples);
    const t = clamp01(unit(count, countScale));
    // Mid-line, not at the end: at the destination the arrow would sit under its circle.
    const mid = Math.floor(line.length / 2);
    lines.push({
      type: "Feature",
      properties: {
        key,
        origin,
        dest,
        ...(o.name === undefined ? {} : { originName: o.name }),
        ...(d.name === undefined ? {} : { destName: d.name }),
        count,
        t,
      },
      geometry: { type: "LineString", coordinates: line },
    });
    arrows.push({
      type: "Feature",
      properties: { key, count, t, bearing: arcBearing(line.slice(0, mid + 1)) },
      geometry: { type: "Point", coordinates: line[mid] },
    });
  }

  const drawn = [...places.values()].flatMap((place) => {
    const entry = totals.get(place.id);
    return entry && entry.in + entry.out > 0 ? [{ place, ...entry, total: entry.in + entry.out }] : [];
  });
  const totalRange = extent(drawn.map(({ total }) => total));
  const totalScale = domains.totalDomain ?? totalRange;
  const rootRange: [number, number] = [Math.sqrt(Math.max(0, totalScale[0])), Math.sqrt(Math.max(0, totalScale[1]))];
  const points: Feature[] = drawn.map(({ place, in: inbound, out, total }) => ({
    type: "Feature",
    properties: {
      id: place.id,
      ...(place.name === undefined ? {} : { name: place.name }),
      in: inbound,
      out,
      total,
      ...(place.places === undefined ? {} : { places: place.places }),
      tr: clamp01(unit(Math.sqrt(total), rootRange)),
    },
    geometry: { type: "Point", coordinates: [place.lon, place.lat] },
  }));

  return {
    lines: { type: "FeatureCollection", features: lines },
    arrows: { type: "FeatureCollection", features: arrows },
    locations: { type: "FeatureCollection", features: points },
    count: countRange,
    total: totalRange,
  };
}

/**
 * Filter, sum per origin-destination pair, rank by count, and emit the three collections a flow
 * map draws. Pure: no map, no DOM. Self-flows and flows between co-located places are dropped
 * before anything is summed, so they add to no location total.
 */
export function buildFlowModel(locations: FlowLocation[], flows: Flow[], options: FlowModelOptions = {}): FlowModel {
  const { timeRange, topN, minCount, curvature = 0.25, samples = 48, countDomain, totalDomain } = options;
  // Untyped input (a CSV) carries numbers as strings: read them, and skip what is not a number.
  const places = new Map<string, Place>(
    locations.flatMap((location): [string, Place][] => {
      const lon = numeric(location.lon);
      const lat = numeric(location.lat);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
      return [[location.id, { id: location.id, name: location.name ?? location.id, lon, lat }]];
    }),
  );
  const kept = flows.flatMap((flow): Pair[] => {
    const count = numeric(flow.count);
    return count > 0 && inRange(flow.time, timeRange) ? [{ origin: flow.origin, dest: flow.dest, count }] : [];
  });

  let ranked = sumPairs(places, kept);
  if (typeof minCount === "number" && Number.isFinite(minCount)) ranked = ranked.filter(([, pair]) => pair.count >= minCount);
  if (typeof topN === "number" && Number.isFinite(topN)) ranked = ranked.slice(0, Math.max(0, topN));
  return drawFlows(places, ranked, curvature, samples, { countDomain, totalDomain });
}

/**
 * Zoom-dependent clustering of a model's locations: a supercluster index over them, by distance
 * alone, and a function from a zoom to the model drawn at that zoom. Locations that merge become
 * one `cluster-<id>` place at the plain mean of their positions, with no name (a label is yours to
 * word) and `places`, how many locations it holds; its in, out and total are its members' sums. The drawn pairs are re-summed between whatever each end became and go
 * through the same drop rules and scaling as the model: a pair inside one cluster is not drawn,
 * but still counts toward that cluster's in and out. Results are cached per integer zoom, and a
 * zoom where nothing merges returns the model itself, as does every zoom for a model with no
 * locations.
 */
export function flowClusters(
  model: FlowModel,
  options: Pick<FlowModelOptions, "curvature" | "samples" | "countDomain" | "totalDomain"> = {},
): (zoom: number) => FlowModel {
  const { curvature = 0.25, samples = 48, countDomain, totalDomain } = options;
  const located = model.locations.features;
  if (located.length === 0) return () => model;

  const locations = new Map<string, Place>();
  const points = located.map((feature) => {
    const id = String(feature.properties.id);
    const coordinates = (feature.geometry as { coordinates: [number, number] }).coordinates;
    const name = feature.properties.name;
    locations.set(id, { id, ...(name === undefined ? {} : { name: String(name) }), lon: coordinates[0], lat: coordinates[1] });
    return {
      type: "Feature" as const,
      properties: { id, total: Number(feature.properties.total) },
      geometry: { type: "Point" as const, coordinates },
    };
  });
  const index = new Supercluster<{ id: string; total: number }, { total: number }>({
    radius: 40,
    maxZoom: 12,
    map: (props) => ({ total: props.total }),
    reduce: (accumulated, props) => {
      accumulated.total += props.total;
    },
  }).load(points);
  const pairs = model.lines.features.map(({ properties }) => ({
    origin: String(properties.origin),
    dest: String(properties.dest),
    count: Number(properties.count),
  }));

  const cache = new Map<number, FlowModel>();
  return (zoom) => {
    const level = Number.isFinite(zoom) ? Math.floor(zoom) : 0;
    const cached = cache.get(level);
    if (cached) return cached;

    const places = new Map(locations);
    const merged = new Map<string, string>();
    for (const feature of index.getClusters([-180, -85, 180, 85], level)) {
      if (!("cluster_id" in feature.properties)) continue;
      const { cluster_id: clusterId, point_count: size } = feature.properties;
      const id = `cluster-${clusterId}`;
      for (const leaf of index.getLeaves(clusterId, Infinity)) {
        merged.set(leaf.properties.id, id);
        places.delete(leaf.properties.id);
      }
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      places.set(id, { id, lon, lat, places: size });
    }
    if (merged.size === 0) {
      cache.set(level, model);
      return model;
    }

    const internal = new Map<string, number>();
    const between: Pair[] = [];
    for (const pair of pairs) {
      const origin = merged.get(pair.origin) ?? pair.origin;
      const dest = merged.get(pair.dest) ?? pair.dest;
      if (origin === dest) internal.set(origin, (internal.get(origin) ?? 0) + pair.count);
      else between.push({ origin, dest, count: pair.count });
    }
    const clustered = drawFlows(places, sumPairs(places, between), curvature, samples, { countDomain, totalDomain }, internal);
    cache.set(level, clustered);
    return clustered;
  };
}

export interface FlowLayerProps {
  locations: FlowLocation[];
  flows: Flow[];
  mapId?: string;
  /** Source id and layer-id prefix. Defaults to a generated id. */
  id?: string;
  /** Draw only flows whose `time` is within this range, inclusive. */
  timeRange?: [string | number, string | number];
  /** Draw only the N largest origin-destination pairs. Not a finite number: no limit. */
  topN?: number;
  /** Draw only pairs whose summed count is at least this. Not a finite number: no limit. */
  minCount?: number;
  /** How far flows bow, as a fraction of their length. Defaults to 0.25. */
  curvature?: number;
  /**
   * The counts that draw the thinnest and the widest line, instead of the range of what is drawn:
   * pass one domain for every year of a table and widths compare across years. Counts outside it
   * clamp.
   */
  countDomain?: [number, number];
  /** The same for location totals and circle size. */
  totalDomain?: [number, number];
  /** Flow, arrow and location colour. Defaults to your --primary (or the theme accent). */
  color?: string;
  /** Width in pixels of the largest flow. Defaults to 8. */
  maxWidth?: number;
  /**
   * Merge nearby locations into clusters by zoom, re-summing the flows between them. Recomputed
   * when the map stops moving; a cluster reports `{ id: "cluster-<n>", in, out, total, places }`.
   */
  cluster?: boolean;
  /** Highlight and report the flow or location under the pointer. Defaults to true when a handler is passed. */
  interactive?: boolean;
  onClick?: (event: MapFeatureEvent) => void;
  onHover?: (event: MapFeatureEvent | null) => void;
  /** Insertion point. Default: below the labels. `null`: on top. */
  beforeId?: BeforeId;
}

const ARROW_IMAGE = "unmap-flow-arrow";

function hovered(on: unknown, off: unknown): unknown[] {
  return ["case", ["boolean", ["feature-state", "hover"], false], on, off];
}

/** `from` where the feature's 0..1 `property` is 0, `to` where it is 1. */
function scale(property: "t" | "tr", from: number, to: number): unknown {
  return ["interpolate", ["linear"], ["get", property], 0, from, 1, to];
}

/** What the pointer is over on each of the two pointer layers. */
type HoverState = { line: MapFeatureEvent | null; location: MapFeatureEvent | null; reported: string | null };

export function FlowLayer({
  locations,
  flows,
  mapId,
  id,
  timeRange,
  topN,
  minCount,
  curvature,
  countDomain,
  totalDomain,
  color,
  maxWidth = 8,
  cluster = false,
  interactive,
  onClick,
  onHover,
  beforeId,
}: FlowLayerProps) {
  const generated = `unmap-flows-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const sourceId = id ?? generated;
  const linesId = `${sourceId}-lines`;
  const arrowsId = `${sourceId}-arrows`;
  const locationsId = `${sourceId}-locations`;
  const active = interactive ?? (onClick !== undefined || onHover !== undefined);

  const from = timeRange?.[0];
  const to = timeRange?.[1];
  // Keyed on the bounds, not the arrays, so an inline `[0, max]` is not a change on every render.
  const countLo = countDomain?.[0];
  const countHi = countDomain?.[1];
  const totalLo = totalDomain?.[0];
  const totalHi = totalDomain?.[1];
  const domains = useMemo(
    () => ({
      countDomain: countLo !== undefined && countHi !== undefined ? ([countLo, countHi] as [number, number]) : undefined,
      totalDomain: totalLo !== undefined && totalHi !== undefined ? ([totalLo, totalHi] as [number, number]) : undefined,
    }),
    [countLo, countHi, totalLo, totalHi],
  );
  const model = useMemo(
    () =>
      buildFlowModel(locations, flows, {
        timeRange: from !== undefined && to !== undefined ? [from, to] : undefined,
        topN,
        minCount,
        curvature,
        ...domains,
      }),
    [locations, flows, from, to, topN, minCount, curvature, domains],
  );

  // With `cluster`, draw the model at the map's zoom, re-read on every moveend. Only the zoom the
  // map is at when the handler runs matters, and a moveend within the same zoom level changes
  // nothing, so a storm of them costs a cache lookup each.
  const map = useMap(mapId);
  const clusters = useMemo(() => (cluster ? flowClusters(model, { curvature, ...domains }) : null), [cluster, model, curvature, domains]);
  const [view, setView] = useState<{ clusters: (zoom: number) => FlowModel; zoom: number } | null>(null);
  useEffect(() => {
    if (!map || !clusters) return;
    const sync = () => {
      const zoom = Math.floor(map.getZoom());
      setView((previous) => (previous?.clusters === clusters && previous.zoom === zoom ? previous : { clusters, zoom }));
    };
    sync();
    map.on("moveend", sync);
    return () => {
      map.off("moveend", sync);
    };
  }, [map, clusters]);
  const drawn = clusters && map ? clusters(view?.clusters === clusters ? view.zoom : map.getZoom()) : model;

  // Sizes interpolate over the model's per-feature `t`/`tr`, so no data change re-adds a layer:
  // hover survives a live feed and the three sets keep their order.
  const key = JSON.stringify([color, maxWidth]);
  const colour = (live: Parameters<typeof accentColor>[0]) => accentColor(live, color, themeMeta(live).marker?.color);

  useLayerSet({
    mapId,
    sourceId,
    source: { promoteId: "key" },
    data: drawn.lines,
    beforeId,
    key,
    layers: (live) => [
      {
        id: linesId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": colour(live),
          "line-width": scale("t", 1, maxWidth),
          "line-opacity": hovered(0.95, 0.45),
        },
      } as LayerSpec,
    ],
  });

  useLayerSet({
    mapId,
    sourceId: arrowsId,
    source: { promoteId: "key" },
    data: drawn.arrows,
    beforeId,
    key,
    layers: (live) => {
      // A style swap drops images, so this runs again before the layer that needs it.
      if (!live.hasImage(ARROW_IMAGE)) live.addImage(ARROW_IMAGE, flowArrowImage(), { sdf: true, pixelRatio: 2 });
      return [
        {
          id: arrowsId,
          type: "symbol",
          source: arrowsId,
          layout: {
            "icon-image": ARROW_IMAGE,
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": scale("t", 0.35, 0.8),
          },
          paint: { "icon-color": colour(live), "icon-opacity": 0.9 },
        } as LayerSpec,
      ];
    },
  });

  useLayerSet({
    mapId,
    sourceId: locationsId,
    source: { promoteId: "id" },
    data: drawn.locations,
    beforeId,
    key,
    layers: (live) => {
      const fill = colour(live);
      return [
        {
          id: locationsId,
          type: "circle",
          source: locationsId,
          paint: {
            "circle-color": fill,
            "circle-opacity": hovered(1, 0.85),
            "circle-radius": scale("tr", 3, 14),
            "circle-stroke-color": tokenColor(live, "--background") ?? fill,
            "circle-stroke-width": 1.5,
          },
        } as LayerSpec,
      ];
    },
  });

  // Circles sit on the ends of lines, so the pointer is often over both. Each pointer records what
  // it is over, and `onHover` hears the location if any, else the line, only when that changes:
  // leaving a circle for the line under it reports the line, never `null` in between.
  const reportHover = useRef(onHover);
  reportHover.current = onHover;
  const hover = useRef<HoverState>({ line: null, location: null, reported: null });
  useEffect(() => {
    if (!active) hover.current = { line: null, location: null, reported: null };
  }, [active]);
  const track = (layer: "line" | "location") => (event: MapFeatureEvent | null) => {
    const state = hover.current;
    state[layer] = event;
    const current = state.location ?? state.line;
    const identity = current
      ? `${state.location ? "location" : "line"}:${String(current.feature.id ?? JSON.stringify(current.feature.properties))}`
      : null;
    if (identity === state.reported) return;
    state.reported = identity;
    reportHover.current?.(current);
  };

  useLayerPointer({ map, layerIds: [linesId], enabled: active, hoverSource: sourceId, onHover: track("line") });
  useLayerPointer({ map, layerIds: [locationsId], enabled: active, hoverSource: locationsId, onHover: track("location") });
  // One click binding over both layers: MapLibre calls it once per click with the topmost feature
  // first, so a click on a circle over a line's end reports the location, once.
  useLayerPointer({ map, layerIds: [locationsId, linesId], enabled: active, onClick });
  return null;
}
