<script lang="ts">
import { HELPER_KEY, layersWithClause, matchLayers, setLayerClause, type FilterMap } from "@/lib/map-layers";

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
</script>

<script setup lang="ts">
/**
 * <UnmapTimeSlider> - your shadcn-vue Slider driving a time window on style layers, with play,
 * pause and step.
 *
 * `property` is a number on each feature: a year, or milliseconds since 1970. A single value shows
 * the features in one step, from the value up to the next; with `cumulative`, everything before
 * the end of that step. A pair `[from, to]` shows the features between them, both ends included,
 * and keeps its width when it plays. Features without the property are hidden while the slider
 * applies. Play moves one step every `interval` ms and stops at the end, or starts over with
 * `loop`; Play at the end starts from the beginning. Values sit on the step grid that starts at
 * `min`: an off-grid `modelValue` or `defaultValue` shows the step it falls in, and a `max` off the
 * grid ends at the last whole step.
 *
 * How a feature's value compares follows the layer's filter syntax. On an expression filter (or no
 * filter) the property is read with `to-number`, so a year stored as the text "2001" still
 * compares. On a legacy filter the comparison is by type, as MapLibre's legacy filters compare: a
 * year stored as text never matches. ISO date strings are not supported on either: store dates as
 * numbers, such as milliseconds since 1970.
 *
 * The window goes on top of each layer's own filter, in the layer's own syntax, next to what an
 * `<UnmapLayerLegend>` unchecks on the same layer, so neither undoes the other. It is applied again
 * after a style swap and when a named layer is added later. A tool's own layers (a measurement or
 * an outline) are never filtered. Unmounting takes the window off.
 * Filtering happens in the browser: a step is not a request.
 *
 * Use `v-model` for controlled state. A bound `modelValue` without the `update:modelValue` listener
 * (a one-way `:model-value`) is never moved: no step, slide or play tick changes it, and play never
 * advances.
 *
 * Your Slider gets `aria-labelledby`, pointing at a visually hidden label (`sr-only`). reka-ui puts
 * it on the Slider's root and does not pass a root name to its thumbs: a lone thumb has no name and
 * a pair is named "Minimum" and "Maximum", in English. For a named control, forward it to each
 * thumb in your Slider, for example `<SliderThumb :aria-labelledby="$attrs['aria-labelledby']" />`,
 * or give the thumbs an `aria-label` of their own.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 */

import { computed, ref, shallowRef, useId, watch, type HTMLAttributes } from "vue";
import { PauseIcon, PlayIcon, StepBackIcon, StepForwardIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useMap, useMapGeneration, useMapReady } from "@/lib/map-context";
import { releaseLayerClauses } from "@/lib/map-layers";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    /** Style layer ids to filter. One ending in `*` matches every layer whose id starts with the rest. */
    layers: string[];
    /** The numeric feature property the window reads: a year, or milliseconds since 1970. */
    property: string;
    min: number;
    max: number;
    /** Slider step, the width of a single value's window, and how far play moves. */
    step?: number;
    /**
     * Controlled value, for `v-model`: a number, or a `[from, to]` pair. Bound one way, without
     * `update:modelValue`, nothing moves it and play never advances.
     */
    modelValue?: TimeSliderValue;
    /** Starting value when uncontrolled. Defaults to `min`. */
    defaultValue?: TimeSliderValue;
    /** A single value shows everything before the end of its step, not only that step. */
    cumulative?: boolean;
    /** Milliseconds per step while playing. */
    interval?: number;
    /** Play starts over from the beginning instead of stopping at the end. */
    loop?: boolean;
    /** Writes a value for the label. Defaults to `String`. */
    format?: (value: number) => string;
    /** Language of the buttons and the range label. */
    lang?: "en" | "fr";
    /** Map id when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    class?: HTMLAttributes["class"];
  }>(),
  { step: 1, cumulative: false, interval: 1000, loop: false, lang: "en" },
);

const emit = defineEmits<{
  /** The next value, on every step, tick and slide. */
  "update:modelValue": [value: TimeSliderValue];
}>();

const map = useMap(() => props.mapId);
const ready = useMapReady(() => props.mapId);
const generation = useMapGeneration(() => props.mapId);
const writer = timeWriter();
const labelId = useId();
const own = shallowRef<TimeSliderValue>(props.defaultValue ?? props.min);
const playing = ref(false);
const bounds = computed<TimeBounds>(() => ({ min: props.min, max: props.max, step: props.step, loop: props.loop }));
const current = computed<TimeSliderValue>(() => snapTime(props.modelValue ?? own.value, bounds.value));
const span = computed(() => timeWindow(current.value, bounds.value, props.cumulative));
const back = computed(() => stepTime(current.value, -1, bounds.value));
const forward = computed(() => stepTime(current.value, 1, bounds.value));
const copy = computed(() => TIME_COPY[props.lang]);
const label = computed(() => timeLabel(current.value, props.format ?? String, props.lang));
const thumbs = computed(() => (Array.isArray(current.value) ? [...current.value] : [current.value]));
let removed = false;

function change(next: TimeSliderValue) {
  if (props.modelValue === undefined) own.value = next;
  emit("update:modelValue", next);
}

function toggle() {
  if (playing.value) {
    playing.value = false;
    return;
  }
  // At the end without `loop`, play starts over from the beginning.
  if (forward.value === null) change(firstTime(current.value, bounds.value));
  playing.value = true;
}

function slide(next: number[] | undefined) {
  if (!next || next.length === 0) return;
  const value = current.value;
  if (Array.isArray(value)) {
    const pair: [number, number] = [next[0] ?? value[0], next[1] ?? value[1]];
    change(snapTime(pair, bounds.value));
  } else {
    // The Slider reports `max` itself for End or a drag to the end, which may be off the step grid.
    change(snapTime(next[0] ?? value, bounds.value));
  }
}

function sync() {
  const live = map.value;
  if (!live || removed || !live.getStyle()) return;
  applyTime(live, props.layers, props.property, span.value, writer);
}

function onRemove() {
  removed = true;
}

// Every `styledata` (a style loaded, a layer added or changed) applies the window again. Before a
// style has loaded `getStyle()` is undefined and nothing is touched.
watch(
  map,
  (live, _previous, onCleanup) => {
    if (!live) return;
    removed = false;
    live.on("remove", onRemove);
    live.on("styledata", sync);
    onCleanup(() => {
      live.off("remove", onRemove);
      live.off("styledata", sync);
      // Unmounted, the slider cannot bring hidden features back, so its window comes off.
      if (!removed) releaseLayerClauses(live, writer);
    });
  },
  { immediate: true },
);

// Inline `layers` and pair values are compared by content, so a parent re-render is not a change.
watch(
  [map, ready, generation, () => JSON.stringify(props.layers), () => props.property, () => JSON.stringify(span.value)],
  () => {
    if (ready.value) sync();
  },
  { immediate: true },
);

watch([playing, () => props.interval], ([on, every], _previous, onCleanup) => {
  if (!on) return;
  const timer = setInterval(() => {
    const next = stepTime(current.value, 1, bounds.value);
    if (next === null) playing.value = false;
    else change(next);
  }, every);
  onCleanup(() => clearInterval(timer));
});
</script>

<template>
  <div role="group" :aria-label="copy.group" data-unmap-time-slider="" :class="cn('flex flex-col gap-3', props.class)">
    <div class="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        :aria-label="copy.back"
        :disabled="back === null"
        @click="back !== null && change(back)"
      >
        <StepBackIcon />
      </Button>
      <Button type="button" variant="outline" size="icon" :aria-label="playing ? copy.pause : copy.play" @click="toggle">
        <PauseIcon v-if="playing" />
        <PlayIcon v-else />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        :aria-label="copy.forward"
        :disabled="forward === null"
        @click="forward !== null && change(forward)"
      >
        <StepForwardIcon />
      </Button>
      <span class="text-sm tabular-nums" data-unmap-time-label="">{{ label }}</span>
    </div>
    <span :id="labelId" class="sr-only">{{ copy.slider }}</span>
    <Slider
      :aria-labelledby="labelId"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :model-value="thumbs"
      @update:model-value="slide"
    />
  </div>
</template>
