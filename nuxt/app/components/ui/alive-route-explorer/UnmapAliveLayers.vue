<script setup lang="ts">
/**
 * The alive-route-explorer block's walks as map layers: the shown one in your --primary over a
 * --card casing, drawing itself in; the fastest dashed in your --muted-foreground; another walk only
 * while its row is hovered. A click on a walk selects it. Renders nothing of its own; it sits inside
 * <UnmapMap>, where useMap() can see it. Installed beside the block. Edit freely.
 */
import { computed, watch } from "vue";
import { accentColor, tokenColor, useLayerPointer, useLayerSet, type LayerSpec } from "@/lib/map-layers";
import { ALIVE_MAP_ID, DRAW_MS, prefersReducedMotion, type RankedWalk } from "@/lib/alive-route-explorer/alive-view";

const props = defineProps<{
  rows: RankedWalk[];
  shownId: string | null;
  fastestId: string | null;
  /** A walk whose row is under the pointer: drawn faint while it is. */
  hoveredId: string | null;
}>();
const emit = defineEmits<{ select: [id: string] }>();

const ROUTES_SOURCE = "alive-routes";
const SHOWN_SOURCE = "alive-shown";
const ROUTES_HIT = "alive-routes-hit";
const SHOWN_LINE = "alive-shown-line";

/** The shown walk drawn up to `t` (0-1) of its length, for line-gradient. */
type LineGradient = NonNullable<NonNullable<Extract<LayerSpec, { type: "line" }>["paint"]>["line-gradient"]>;
const drawnTo = (colour: string, t: number): LineGradient => ["step", ["line-progress"], colour, Math.min(Math.max(t, 0.0001), 1.01), "rgba(0, 0, 0, 0)"];
const ROUND = { "line-cap": "round", "line-join": "round" } as const;

const routes = computed(() => ({
  type: "FeatureCollection",
  features: props.rows
    .filter((row) => row.id !== props.shownId && (row.id === props.fastestId || row.id === props.hoveredId))
    .map((row) => ({
      type: "Feature",
      properties: { id: row.id, role: row.id === props.fastestId ? "fastest" : "other" },
      geometry: { type: "LineString", coordinates: row.coords },
    })),
}));
const shownRow = computed(() => props.rows.find((row) => row.id === props.shownId) ?? null);
const shownLine = computed(() => ({
  type: "FeatureCollection",
  features: shownRow.value ? [{ type: "Feature", properties: { id: shownRow.value.id }, geometry: { type: "LineString", coordinates: shownRow.value.coords } }] : [],
}));

const { map, ready } = useLayerSet(() => ({
  mapId: ALIVE_MAP_ID,
  sourceId: ROUTES_SOURCE,
  data: routes.value,
  layers: (live): LayerSpec[] => {
    const muted = tokenColor(live, "--muted-foreground") ?? accentColor(live, undefined, undefined);
    return [
      { id: "alive-routes-other", type: "line", source: ROUTES_SOURCE, filter: ["==", ["get", "role"], "other"], layout: ROUND, paint: { "line-color": muted, "line-width": 5, "line-opacity": 0.55 } },
      { id: "alive-routes-fastest", type: "line", source: ROUTES_SOURCE, filter: ["==", ["get", "role"], "fastest"], layout: ROUND, paint: { "line-color": muted, "line-width": 5, "line-dasharray": [1.4, 1.6] } },
      { id: ROUTES_HIT, type: "line", source: ROUTES_SOURCE, paint: { "line-color": muted, "line-width": 18, "line-opacity": 0 } },
    ];
  },
}));
useLayerSet(() => ({
  mapId: ALIVE_MAP_ID,
  sourceId: SHOWN_SOURCE,
  source: { lineMetrics: true },
  data: shownLine.value,
  layers: (live): LayerSpec[] => {
    const primary = accentColor(live, undefined, undefined);
    // --card, so the casing stays visible on a dark map as on a light one.
    const casing = tokenColor(live, "--card") ?? tokenColor(live, "--background") ?? "white";
    return [
      { id: "alive-shown-casing", type: "line", source: SHOWN_SOURCE, layout: ROUND, paint: { "line-color": casing, "line-width": 12 } },
      { id: SHOWN_LINE, type: "line", source: SHOWN_SOURCE, layout: ROUND, paint: { "line-width": 8, "line-gradient": drawnTo(primary, 1) } },
    ];
  },
}));
useLayerPointer(() => ({
  map: map.value,
  layerIds: [ROUTES_HIT],
  enabled: ready.value,
  onClick: (event) => {
    const id = event.feature.properties.id;
    if (typeof id === "string") emit("select", id);
  },
}));

// The one orchestrated moment: a newly shown walk draws itself from start to finish.
const drawKey = computed(() => (shownRow.value ? `${shownRow.value.id}:${shownRow.value.coords.length}` : ""));
watch(
  [map, ready, drawKey],
  ([live, isReady, key], _previous, onCleanup) => {
    if (!live || !isReady || !key || !live.getLayer(SHOWN_LINE)) return;
    const primary = accentColor(live, undefined, undefined);
    if (prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
      live.setPaintProperty(SHOWN_LINE, "line-gradient", drawnTo(primary, 1));
      return;
    }
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - started) / DRAW_MS, 1);
      if (!live.getLayer(SHOWN_LINE)) return;
      live.setPaintProperty(SHOWN_LINE, "line-gradient", drawnTo(primary, 1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      if (live.getStyle() && live.getLayer(SHOWN_LINE)) live.setPaintProperty(SHOWN_LINE, "line-gradient", drawnTo(primary, 1));
    });
  },
  { flush: "post" },
);
</script>

<template>
  <slot />
</template>
