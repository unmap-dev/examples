"use client";

/**
 * <TimeSlider> - your shadcn Slider driving a time window on style layers, with play, pause and step.
 *
 * `property` is a number on each feature: a year, or milliseconds since 1970. A single value shows
 * the features in one step, from the value up to the next (`[value, value + step)`); with
 * `cumulative`, everything before the end of that step. A pair `[from, to]` shows the features
 * between them, both ends included, and keeps its width when it plays. Features without the
 * property are hidden while the slider applies. Play moves one step every `interval` ms and stops
 * at the end, or starts over with `loop`; Play at the end starts from the beginning. Values sit on
 * the step grid that starts at `min`: an off-grid `value` or `defaultValue` shows the step it falls
 * in, and a `max` off the grid ends at the last whole step.
 *
 * How a feature's value compares follows the layer's filter syntax. On an expression filter (or no
 * filter) the property is read with `to-number`, so a year stored as the text "2001" still
 * compares. On a legacy filter the comparison is by type, as MapLibre's legacy filters compare: a
 * year stored as text never matches. ISO date strings are not supported on either: store dates as
 * numbers, such as milliseconds since 1970.
 *
 * The window goes on top of each layer's own filter, in the layer's own syntax (expression or
 * legacy), next to what a `<LayerLegend>` unchecks on the same layer: map-layers keeps one clause
 * per writer and layer, so neither undoes the other. It is applied again after a style swap and
 * when a named layer is added later; ids the style does not have are skipped. A layer id ending in
 * `*` matches every layer that starts with the rest, except a tool's own layers (a measurement or
 * an outline), which are never filtered. Unmounting takes the window off, so no feature
 * stays hidden without a slider to bring it back. Filtering happens in the browser: a step is not
 * a request.
 *
 * State is uncontrolled (`defaultValue`) or controlled (`value` + `onValueChange`). Controlled, the
 * slider only reports the next value: feed it back through `value` from `onValueChange`, or no
 * step, slide or play tick moves it, and play never advances.
 *
 * Your Slider is named by a visually hidden label (`sr-only`) through `aria-labelledby`, which Base
 * UI passes from the Slider's root to each thumb; an `aria-label` would only name the root.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { useEffect, useId, useRef, useState } from "react";
import { PauseIcon, PlayIcon, StepBackIcon, StepForwardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useMap, useMapGeneration, useMapReady } from "@/lib/map-context";
import { HELPER_KEY, layersWithClause, matchLayers, releaseLayerClauses, setLayerClause, type FilterMap } from "@/lib/map-layers";
import { cn } from "@/lib/utils";

// --- time helpers (kept identical across both lanes) ---

/** One instant (a step-wide window from it) or a closed `[from, to]` range. */
export type TimeSliderValue = number | [number, number];

/** The features a value shows: `from` (absent for everything before) up to `to`, `to` included when `closed`. */
export interface TimeWindow {
  from?: number;
  to: number;
  closed: boolean;
}

export interface TimeBounds {
  min: number;
  max: number;
  step: number;
  loop: boolean;
}

/** The part of a MapLibre map the slider drives. */
export interface TimeMap extends FilterMap {
  getStyle(): { layers?: Array<{ id: string; metadata?: unknown }> } | undefined;
}

export const TIME_COPY = {
  en: {
    group: "Time controls",
    slider: "Time",
    play: "Play",
    pause: "Pause",
    back: "Step back",
    forward: "Step forward",
    range: (from: string, to: string) => `${from} to ${to}`,
  },
  fr: {
    group: "Commandes de temps",
    slider: "Temps",
    play: "Lire",
    pause: "Pause",
    back: "Reculer d'un pas",
    forward: "Avancer d'un pas",
    range: (from: string, to: string) => `${from} à ${to}`,
  },
} as const;

let sliders = 0;

/** A new name for one mounted slider: the writer its clauses are held under in map-layers' store. */
export function timeWriter(): string {
  sliders += 1;
  return `time-slider-${sliders}`;
}

function decimals(value: number): number {
  const text = String(value);
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return (text.split(".")[1] ?? "").length;
}

/** `value` rounded to the decimals of `step` and `min`, so ten steps of 0.1 land on exactly 1. */
function tidy(value: number, bounds: TimeBounds): number {
  return Number(value.toFixed(Math.min(20, Math.max(decimals(bounds.step), decimals(bounds.min)))));
}

/** The first value of the last whole step at or below `max`: the end of the step grid. */
function lastStart(bounds: TimeBounds): number {
  return tidy(bounds.min + Math.floor((bounds.max - bounds.min) / bounds.step + 1e-9) * bounds.step, bounds);
}

/** The start of the step `value` falls in, on the grid from `min`, kept between `min` and the grid's end. */
function snapOne(value: number, bounds: TimeBounds): number {
  const steps = Math.floor((value - bounds.min) / bounds.step + 1e-9);
  return Math.min(lastStart(bounds), Math.max(bounds.min, tidy(bounds.min + steps * bounds.step, bounds)));
}

/**
 * `value` on the step grid that starts at `min`, each end of a range on its own, so an off-grid
 * value or a `max` off the grid cannot drift the steps that follow.
 */
export function snapTime(value: TimeSliderValue, bounds: TimeBounds): TimeSliderValue {
  return Array.isArray(value) ? [snapOne(value[0], bounds), snapOne(value[1], bounds)] : snapOne(value, bounds);
}

/** The window `value` shows, once snapped to the step grid. */
export function timeWindow(value: TimeSliderValue, bounds: TimeBounds, cumulative: boolean): TimeWindow {
  const snapped = snapTime(value, bounds);
  if (Array.isArray(snapped)) return { from: snapped[0], to: snapped[1], closed: true };
  const to = tidy(snapped + bounds.step, bounds);
  return cumulative ? { to, closed: false } : { from: snapped, to, closed: false };
}

/**
 * The clause that keeps the features whose `property` is in `window`, for an expression filter
 * (`expression`) or a legacy one. The expression reads the property through `to-number`, so a
 * number stored as text still compares; both guard with `has`.
 */
export function timeClause(expression: boolean, property: string, window: TimeWindow): unknown {
  const read = expression ? ["to-number", ["get", property]] : property;
  const parts: unknown[] = [["has", property]];
  if (window.from !== undefined) parts.push([">=", read, window.from]);
  parts.push([window.closed ? "<=" : "<", read, window.to]);
  return ["all", ...parts];
}

/**
 * `value`, snapped to the step grid, moved one step forward (`1`) or back (`-1`). Past either end of
 * the grid it wraps with `loop` and is `null` without. A range keeps its width.
 */
export function stepTime(value: TimeSliderValue, direction: 1 | -1, bounds: TimeBounds): TimeSliderValue | null {
  const shift = direction * bounds.step;
  const last = lastStart(bounds);
  const snapped = snapTime(value, bounds);
  if (Array.isArray(snapped)) {
    const width = tidy(snapped[1] - snapped[0], bounds);
    const next: [number, number] = [tidy(snapped[0] + shift, bounds), tidy(snapped[1] + shift, bounds)];
    if (next[1] > last) return bounds.loop ? [bounds.min, tidy(bounds.min + width, bounds)] : null;
    if (next[0] < bounds.min) return bounds.loop ? [tidy(last - width, bounds), last] : null;
    return next;
  }
  const next = tidy(snapped + shift, bounds);
  if (next > last) return bounds.loop ? bounds.min : null;
  if (next < bounds.min) return bounds.loop ? last : null;
  return next;
}

/** Where play starts again from the end: the first step, or the range moved to the start. */
export function firstTime(value: TimeSliderValue, bounds: TimeBounds): TimeSliderValue {
  const snapped = snapTime(value, bounds);
  return Array.isArray(snapped) ? [bounds.min, tidy(bounds.min + snapped[1] - snapped[0], bounds)] : bounds.min;
}

/**
 * Put `window` on every layer `layers` names that the style has now, as `writer`'s clause next to
 * any other writer's, and take it off the layers `writer` no longer names. Nothing happens before
 * the style has loaded.
 */
export function applyTime(map: TimeMap, layers: string[], property: string, window: TimeWindow, writer: string): void {
  const style = map.getStyle();
  if (!style) return;
  const ids = (style.layers ?? []).map((layer) => layer.id);
  // A tool's own layers (a measurement, an outline) are drawn for the reader, not data: never filtered.
  const helpers = (style.layers ?? [])
    .filter((layer) => (layer.metadata as Record<string, unknown> | undefined)?.[HELPER_KEY] === true)
    .map((layer) => layer.id);
  const matched = matchLayers(ids, layers).filter((id) => !helpers.includes(id));
  for (const id of layersWithClause(map, writer)) {
    if (!matched.includes(id) && ids.includes(id)) setLayerClause(map, id, writer, null);
  }
  for (const id of matched) setLayerClause(map, id, writer, (expression) => timeClause(expression, property, window));
}

/** `value` as text: a range as "from to to", in `lang`. */
export function timeLabel(value: TimeSliderValue, format: (value: number) => string, lang: "en" | "fr"): string {
  return Array.isArray(value) ? TIME_COPY[lang].range(format(value[0]), format(value[1])) : format(value);
}
// --- end time helpers ---

export interface TimeSliderProps {
  /** Style layer ids to filter. One ending in `*` matches every layer whose id starts with the rest. */
  layers: string[];
  /** The numeric feature property the window reads: a year, or milliseconds since 1970. */
  property: string;
  min: number;
  max: number;
  /** Slider step, the width of a single value's window, and how far play moves. Defaults to 1. */
  step?: number;
  /**
   * Controlled value: a number, or a `[from, to]` pair. Pair with `onValueChange` and feed the next
   * value back, or nothing moves it and play never advances.
   */
  value?: TimeSliderValue;
  /** Starting value when uncontrolled. Defaults to `min`. */
  defaultValue?: TimeSliderValue;
  /** Called with the next value on every step, tick and slide. */
  onValueChange?: (value: TimeSliderValue) => void;
  /** A single value shows everything before the end of its step, not only that step. */
  cumulative?: boolean;
  /** Milliseconds per step while playing. Defaults to 1000. */
  interval?: number;
  /** Play starts over from the beginning instead of stopping at the end. */
  loop?: boolean;
  /** Writes a value for the label. Defaults to `String`. */
  format?: (value: number) => string;
  /** Language of the buttons and the range label. Defaults to "en". */
  lang?: "en" | "fr";
  /** Map id when multiple maps share a page. Defaults to "default". */
  mapId?: string;
  className?: string;
}

export function TimeSlider({
  layers,
  property,
  min,
  max,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  cumulative = false,
  interval = 1000,
  loop = false,
  format = String,
  lang = "en",
  mapId,
  className,
}: TimeSliderProps) {
  const map = useMap(mapId);
  const ready = useMapReady(mapId);
  const generation = useMapGeneration(mapId);
  const [writer] = useState(timeWriter);
  const [own, setOwn] = useState<TimeSliderValue>(() => defaultValue ?? min);
  const [playing, setPlaying] = useState(false);
  const labelId = useId();
  const bounds: TimeBounds = { min, max, step, loop };
  const current = snapTime(value ?? own, bounds);
  const span = timeWindow(current, bounds, cumulative);
  const back = stepTime(current, -1, bounds);
  const forward = stepTime(current, 1, bounds);
  const copy = TIME_COPY[lang];

  const latest = useRef({ layers, property, span, current, bounds, value, onValueChange });
  latest.current = { layers, property, span, current, bounds, value, onValueChange };
  const sync = useRef(() => {});

  const change = (next: TimeSliderValue) => {
    if (latest.current.value === undefined) setOwn(next);
    latest.current.onValueChange?.(next);
  };
  const changeRef = useRef(change);
  changeRef.current = change;

  // Every `styledata` (a style loaded, a layer added or changed) applies the window again. Before a
  // style has loaded `getStyle()` is undefined and nothing is touched.
  useEffect(() => {
    if (!map) return;
    let removed = false;
    const onRemove = () => {
      removed = true;
    };
    const run = () => {
      if (removed || !map.getStyle()) return;
      applyTime(map, latest.current.layers, latest.current.property, latest.current.span, writer);
    };
    sync.current = run;
    map.on("remove", onRemove);
    map.on("styledata", run);
    return () => {
      sync.current = () => {};
      map.off("remove", onRemove);
      map.off("styledata", run);
      // Unmounted, the slider cannot bring hidden features back, so its window comes off.
      if (!removed) releaseLayerClauses(map, writer);
    };
  }, [map, writer]);

  // Inline `layers` and pair values are compared by content, so a parent re-render is not a change.
  const layersKey = JSON.stringify(layers);
  const spanKey = JSON.stringify(span);
  useEffect(() => {
    if (ready) sync.current();
  }, [map, ready, generation, layersKey, property, spanKey]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const next = stepTime(latest.current.current, 1, latest.current.bounds);
      if (next === null) setPlaying(false);
      else changeRef.current(next);
    }, interval);
    return () => clearInterval(timer);
  }, [playing, interval]);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // At the end without `loop`, play starts over from the beginning.
    if (forward === null) change(firstTime(current, bounds));
    setPlaying(true);
  };

  const slide = (next: number | readonly number[]) => {
    const thumbs = typeof next === "number" ? [next] : [...next];
    if (Array.isArray(current)) {
      const pair: [number, number] = [thumbs[0] ?? current[0], thumbs[1] ?? current[1]];
      change(snapTime(pair, bounds));
    } else {
      // The Slider reports `max` itself for End or a drag to the end, which may be off the step grid.
      change(snapTime(thumbs[0] ?? current, bounds));
    }
  };

  return (
    <div role="group" aria-label={copy.group} data-unmap-time-slider="" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={copy.back}
          disabled={back === null}
          onClick={() => back !== null && change(back)}
        >
          <StepBackIcon />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label={playing ? copy.pause : copy.play} onClick={toggle}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={copy.forward}
          disabled={forward === null}
          onClick={() => forward !== null && change(forward)}
        >
          <StepForwardIcon />
        </Button>
        <span className="text-sm tabular-nums" data-unmap-time-label="">
          {timeLabel(current, format, lang)}
        </span>
      </div>
      <span id={labelId} className="sr-only">
        {copy.slider}
      </span>
      <Slider
        aria-labelledby={labelId}
        min={min}
        max={max}
        step={step}
        value={Array.isArray(current) ? [...current] : [current]}
        onValueChange={slide}
      />
    </div>
  );
}
