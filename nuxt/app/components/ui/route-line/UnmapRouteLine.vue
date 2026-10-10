<script setup lang="ts">
/**
 * <UnmapRouteLine> - draw a route (or any line of [lng, lat] points) on an unmap map.
 *
 * A theme casing under a line in your `--primary` (or the theme's route colour, per the map's
 * accent). `:active="false"` draws an alternative in `--muted-foreground`. `progress` (0 to 1)
 * draws the travelled part at full strength over a faded full line. `gradient` colours the line
 * by a value per point on your `--chart-1`..`--chart-5`. Listen to `@click` to make it clickable.
 *
 * Sits below the map's labels unless you pass `beforeId`. Survives a style swap.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 */

import { computed, getCurrentInstance, useId, watch } from "vue";
import {
  accentColor,
  accentOf,
  chartRamp,
  concrete,
  hostOf,
  themeMeta,
  tokenColor,
  useLayerSet,
  type LayerSpec,
} from "@/lib/map-layers";

/** The last resort when neither a theme nor a design-system token supplies a route casing. */
const FALLBACK_CASING = "#0c1418";
/** Past this many points a gradient is sampled down; MapLibre compiles every stop. */
const MAX_GRADIENT_STOPS = 128;
const EARTH_RADIUS_METRES = 6_371_008.8;

/** Layer metadata key marking a route-line layer as the selected route or an alternative. */
const ROLE_KEY = "unmap:route-line";

type StyleWithLayers = { getStyle: () => { layers?: { id: string; metadata?: unknown }[] } | undefined };

/**
 * The lowest layer of any active route on the map, where an alternative goes so it never covers
 * the selected route whatever order they mounted in. Undefined when no route is active, which
 * puts the alternative below the labels like any other overlay.
 */
function belowActiveRoute(map: StyleWithLayers): string | undefined {
  return map.getStyle()?.layers?.find((layer) => {
    const metadata = layer.metadata as Record<string, unknown> | undefined;
    return metadata?.[ROLE_KEY] === "active";
  })?.id;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversine(a: [number, number], b: [number, number]): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cumulative distance in metres at each point; the first is 0. */
function measureLine(coordinates: [number, number][]): number[] {
  const measured: number[] = [];
  let total = 0;
  coordinates.forEach((point, index) => {
    if (index > 0) total += haversine(coordinates[index - 1]!, point);
    measured.push(total);
  });
  return measured;
}

/** The line from its start to `fraction` of its length, ending on an interpolated point. */
function sliceLine(coordinates: [number, number][], fraction: number): [number, number][] {
  if (coordinates.length < 2 || fraction <= 0) return [];
  if (fraction >= 1) return coordinates;
  const measured = measureLine(coordinates);
  const target = measured[measured.length - 1]! * fraction;
  const sliced: [number, number][] = [coordinates[0]!];
  for (let index = 1; index < coordinates.length; index++) {
    const start = measured[index - 1]!;
    const end = measured[index]!;
    if (end < target) {
      sliced.push(coordinates[index]!);
      continue;
    }
    const t = end === start ? 0 : (target - start) / (end - start);
    const [x0, y0] = coordinates[index - 1]!;
    const [x1, y1] = coordinates[index]!;
    sliced.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    break;
  }
  return sliced;
}

/**
 * A `line-gradient` expression: each point's position along the line mapped to its value's colour
 * on `ramp`. Null when there is no usable gradient (mismatched values, a zero-length line).
 */
function gradientStops(
  coordinates: [number, number][],
  values: number[],
  ramp: string[],
  domain?: [number, number],
): unknown[] | null {
  if (coordinates.length < 2 || values.length !== coordinates.length || ramp.length === 0) return null;
  const measured = measureLine(coordinates);
  const total = measured[measured.length - 1]!;
  if (total === 0) return null;
  // A loop, not Math.min(...values): spreading a long route's values overflows the call stack.
  let [low, high] = domain ?? [Infinity, -Infinity];
  if (!domain) {
    for (const value of values) {
      if (value < low) low = value;
      if (value > high) high = value;
    }
  }
  const span = high - low || 1;
  const step = Math.max(1, Math.ceil(coordinates.length / MAX_GRADIENT_STOPS));
  const stops: unknown[] = ["interpolate", ["linear"], ["line-progress"]];
  let last = -1;
  for (let index = 0; index < coordinates.length; index += step) {
    const at = measured[index]! / total;
    if (at <= last) continue; // line-progress stops must strictly increase
    const t = Math.min(1, Math.max(0, (values[index]! - low) / span));
    stops.push(at, ramp[Math.round(t * (ramp.length - 1))]!);
    last = at;
  }
  if (last < 1) {
    const t = Math.min(1, Math.max(0, (values[values.length - 1]! - low) / span));
    stops.push(1, ramp[Math.round(t * (ramp.length - 1))]!);
  }
  return stops;
}

/** A serial per geometry object, so a rebuild key can tell two same-length lines apart cheaply. */
const geometryIds = new WeakMap<object, number>();
let nextGeometryId = 0;
function geometryId(geometry: object): number {
  let id = geometryIds.get(geometry);
  if (id === undefined) {
    id = ++nextGeometryId;
    geometryIds.set(geometry, id);
  }
  return id;
}

function lineFeature(coordinates: [number, number][]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: coordinates.length < 2 ? [] : coordinates },
  };
}

export interface RouteGradient {
  /** One value per coordinate, e.g. grade in percent or elevation in metres. */
  values: number[];
  /** The value range mapped onto the ramp. Defaults to the values' own minimum and maximum. */
  domain?: [number, number];
}

const props = withDefaults(
  defineProps<{
    /** The line as [longitude, latitude] pairs, e.g. a route's `geometry.coordinates`. */
    coordinates: [number, number][];
    /** Map id when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Source id and layer-id prefix. Give each line on a map its own. Defaults to a generated id. */
    id?: string;
    /** Line colour. Defaults to the theme's route colour or your --primary, per the map's accent. */
    color?: string;
    /** Line width in pixels. Defaults to the theme's route width, else 5. */
    width?: number;
    /** Line opacity, 0 to 1. Defaults to the theme's route opacity, else 0.9. */
    opacity?: number;
    /** `false` draws an alternative: --muted-foreground, 1px thinner, fainter. */
    active?: boolean;
    /** Travelled fraction, 0 to 1. */
    progress?: number;
    /** Colour the line by a value per coordinate. Ignored when `values` does not match. */
    gradient?: RouteGradient;
    /**
     * Insertion point. Default: below the labels, and for an alternative, below the lowest
     * active route too, so the selected route is never covered. `null`: on top.
     */
    beforeId?: string | null;
  }>(),
  { active: true },
);

const emit = defineEmits<{ click: [] }>();
const instance = getCurrentInstance();
const generated = `unmap-route-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
const sourceId = computed(() => props.id ?? generated);
const lineId = computed(() => `${sourceId.value}-line`);
const hasProgress = computed(() => props.progress !== undefined);
const useGradient = computed(
  () =>
    props.gradient !== undefined &&
    props.gradient.values.length === props.coordinates.length &&
    props.coordinates.length >= 2,
);
// Memoized so useLayerSet's data watcher fires only when the line's own inputs change, not on
// every prop change (e.g. `progress` ticking must not re-upload the unchanged full route).
const lineData = computed(() => lineFeature(props.coordinates));
const progressData = computed(() => lineFeature(hasProgress.value ? sliceLine(props.coordinates, props.progress!) : []));
const metadata = computed(() => ({ [ROLE_KEY]: props.active ? "active" : "alternative" }));
const insertBefore = computed(() => (props.beforeId !== undefined || props.active ? props.beforeId : belowActiveRoute));

// The gradient's stops are computed from the coordinates, so a new line (even one of the same
// length) must rebuild the layer; setData alone would leave the old stops on the new shape.
const lineKey = computed(() =>
  JSON.stringify([
    props.color,
    props.width,
    props.opacity,
    props.active,
    hasProgress.value,
    useGradient.value ? props.gradient : null,
    useGradient.value ? geometryId(lineData.value) : 0,
  ]),
);

const { map } = useLayerSet(() => ({
  mapId: props.mapId,
  sourceId: sourceId.value,
  source: useGradient.value ? { lineMetrics: true } : undefined,
  data: lineData.value,
  beforeId: insertBefore.value,
  key: lineKey.value,
  layers: (live) => {
    const theme = themeMeta(live).route;
    // An alternative is 1px thinner, but never thinner than 1px.
    const lineWidth = Math.max(1, (props.width ?? theme?.width ?? 5) - (props.active ? 0 : 1));
    const baseOpacity = props.opacity ?? theme?.opacity ?? 0.9;
    const lineColor = props.active
      ? accentColor(live, props.color, theme?.color)
      : props.color ?? tokenColor(live, "--muted-foreground") ?? accentColor(live, undefined, theme?.color);
    const layers: LayerSpec[] = [];
    if (props.active && theme && (theme.casingWidth ?? 0) > 0) {
      // Mirrors `accentColor`, but for the casing: under accent="system" the --background token
      // comes before the theme's casing colour; under accent="theme" the theme's casing colour
      // comes first.
      const themedCasing = concrete(theme.casingColor);
      const systemCasing = () => tokenColor(live, "--background");
      const casingColor =
        (accentOf(hostOf(live)) === "system" ? systemCasing() ?? themedCasing : themedCasing ?? systemCasing()) ??
        FALLBACK_CASING;
      layers.push({
        id: `${sourceId.value}-casing`,
        type: "line",
        source: sourceId.value,
        metadata: metadata.value,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": casingColor,
          "line-width": theme.casingWidth ?? 10,
          "line-opacity": theme.casingOpacity ?? 0.2,
        },
      } as LayerSpec);
    }
    const stops = useGradient.value
      ? gradientStops(props.coordinates, props.gradient!.values, chartRamp(live), props.gradient!.domain)
      : null;
    layers.push({
      id: lineId.value,
      type: "line",
      source: sourceId.value,
      metadata: metadata.value,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        ...(stops ? { "line-gradient": stops } : { "line-color": lineColor }),
        "line-width": lineWidth,
        "line-opacity": hasProgress.value ? baseOpacity * 0.35 : props.active ? baseOpacity : baseOpacity * 0.7,
      },
    } as LayerSpec);
    return layers;
  },
}));

useLayerSet(() => ({
  mapId: props.mapId,
  sourceId: `${sourceId.value}-progress`,
  data: progressData.value,
  beforeId: insertBefore.value,
  // Built from the line's key: whenever the line re-adds, the travelled part re-adds after it and
  // so stays on top of it.
  key: JSON.stringify([lineKey.value, useGradient.value]),
  layers: (live) => {
    if (!hasProgress.value) return [];
    const theme = themeMeta(live).route;
    return [
      {
        id: `${sourceId.value}-progress-line`,
        type: "line",
        source: `${sourceId.value}-progress`,
        metadata: metadata.value,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": accentColor(live, props.color, theme?.color),
          "line-width": props.width ?? theme?.width ?? 5,
          "line-opacity": props.opacity ?? theme?.opacity ?? 0.9,
        },
      } as LayerSpec,
    ];
  },
}));

// Clickable only when a parent listens to @click.
const clickable = computed(() => Boolean(instance?.vnode.props?.onClick));

watch(
  [map, lineId, clickable],
  ([current, layerId, isClickable], _previous, onCleanup) => {
    if (!current || !isClickable) return;
    const canvas = current.getCanvas();
    const enter = () => {
      canvas.style.cursor = "pointer";
    };
    const leave = () => {
      canvas.style.cursor = "";
    };
    const click = () => emit("click");
    current.on("mouseenter", layerId, enter);
    current.on("mouseleave", layerId, leave);
    current.on("click", layerId, click);
    onCleanup(() => {
      current.off("mouseenter", layerId, enter);
      current.off("mouseleave", layerId, leave);
      current.off("click", layerId, click);
      canvas.style.cursor = "";
    });
  },
  { immediate: true, flush: "post" },
);
</script>

<template>
  <slot />
</template>
