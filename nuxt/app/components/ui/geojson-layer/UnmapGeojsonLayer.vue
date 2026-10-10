<script setup lang="ts">
/**
 * <UnmapGeojsonLayer> - draw any GeoJSON on an unmap map: polygons as a fill with an outline,
 * lines, and points as circles, each filtered to its geometry type.
 *
 * Colours default to your `--primary`, with a `--background` stroke on points. Set `interactive`
 * (Vue cannot see whether a parent listens) and the feature under the pointer is highlighted and
 * reported through `@click`/`@hover`. `data` can be an object or a URL; a new value updates the
 * map in place.
 *
 * Sits below the map's labels unless you pass `beforeId`. Survives a style swap.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 */

import { computed, useId } from "vue";
import {
  accentColor,
  themeMeta,
  tokenColor,
  useLayerPointer,
  useLayerSet,
  type BeforeId,
  type GeoJSONData,
  type LayerSpec,
  type MapFeatureEvent,
} from "@/lib/map-layers";

type Paint = Record<string, unknown>;

const POLYGONS = ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]];
const LINES = ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]];
const POINTS = ["in", ["geometry-type"], ["literal", ["Point", "MultiPoint"]]];

function hovered(on: unknown, off: unknown): unknown[] {
  return ["case", ["boolean", ["feature-state", "hover"], false], on, off];
}

const props = withDefaults(
  defineProps<{
    /** GeoJSON (a FeatureCollection, Feature or geometry) or a URL MapLibre fetches. */
    data: GeoJSONData;
    /** Map id when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Source id and layer-id prefix. Defaults to a generated id. */
    id?: string;
    /** A property to use as the feature id (stable hover across `data` updates). Ids are generated otherwise. */
    promoteId?: string;
    /** Colour for fills, lines and points. Defaults to your --primary (or the theme accent). */
    color?: string;
    /** Fill paint merged over the defaults, or `false` for no fill layer. */
    fillPaint?: Paint | false;
    /** Line paint merged over the defaults, or `false` for no line layer. */
    linePaint?: Paint | false;
    /** Circle paint merged over the defaults, or `false` for no circle layer. */
    circlePaint?: Paint | false;
    /** Highlight and report the feature under the pointer. */
    interactive?: boolean;
    /** Insertion point. Default: below the labels. `null`: on top. */
    beforeId?: BeforeId;
  }>(),
  { interactive: false, fillPaint: undefined, linePaint: undefined, circlePaint: undefined },
);

const emit = defineEmits<{
  click: [event: MapFeatureEvent];
  hover: [event: MapFeatureEvent | null];
}>();

const generated = `unmap-geojson-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
const sourceId = computed(() => props.id ?? generated);
const layerIds = computed(() => [
  ...(props.fillPaint === false ? [] : [`${sourceId.value}-fill`]),
  ...(props.linePaint === false ? [] : [`${sourceId.value}-line`]),
  ...(props.circlePaint === false ? [] : [`${sourceId.value}-circle`]),
]);

const { map } = useLayerSet(() => ({
  mapId: props.mapId,
  sourceId: sourceId.value,
  source: props.promoteId ? { promoteId: props.promoteId } : { generateId: true },
  data: props.data,
  beforeId: props.beforeId,
  key: JSON.stringify([props.color, props.fillPaint, props.linePaint, props.circlePaint]),
  layers: (live) => {
    const colour = accentColor(live, props.color, themeMeta(live).marker?.color);
    const stroke = tokenColor(live, "--background") ?? colour;
    const layers: LayerSpec[] = [];
    if (props.fillPaint !== false) {
      layers.push({
        id: `${sourceId.value}-fill`,
        type: "fill",
        source: sourceId.value,
        filter: POLYGONS,
        paint: { "fill-color": colour, "fill-opacity": hovered(0.45, 0.25), ...props.fillPaint },
      } as LayerSpec);
    }
    if (props.linePaint !== false) {
      layers.push({
        id: `${sourceId.value}-line`,
        type: "line",
        source: sourceId.value,
        filter: LINES,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colour, "line-width": hovered(3, 1.5), ...props.linePaint },
      } as LayerSpec);
    }
    if (props.circlePaint !== false) {
      layers.push({
        id: `${sourceId.value}-circle`,
        type: "circle",
        source: sourceId.value,
        filter: POINTS,
        paint: {
          "circle-color": colour,
          "circle-radius": hovered(7, 5),
          "circle-stroke-color": stroke,
          "circle-stroke-width": 1.5,
          ...props.circlePaint,
        },
      } as LayerSpec);
    }
    return layers;
  },
}));

useLayerPointer(() => ({
  map: map.value,
  layerIds: layerIds.value,
  enabled: props.interactive,
  hoverSource: sourceId.value,
  onClick: (event) => emit("click", event),
  onHover: (event) => emit("hover", event),
  // Generated ids follow feature order, so new data can hand the hovered id to another feature.
  resetOn: props.promoteId ? undefined : props.data,
}));
</script>

<template>
  <slot />
</template>
