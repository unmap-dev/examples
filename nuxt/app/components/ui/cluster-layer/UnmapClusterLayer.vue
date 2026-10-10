<script setup lang="ts">
/**
 * <UnmapClusterLayer> - many points drawn as clusters that split as you zoom in, on MapLibre's
 * own clustering. Clusters show their count and zoom in on click; single points report `click`
 * when `interactive`. `sum` adds up a property across each cluster (e.g. `:sum="['beds']"` gives
 * `beds` on every cluster feature).
 *
 * A cluster click zooms in by default. Set `zoomOnClick` to `false` (Vue cannot see whether a
 * parent listens for `clusterClick`) to get a `clusterClick` event with the cluster's `count`
 * instead.
 *
 * Colours default to your `--primary`, with counts in `--primary-foreground`.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 */

import { computed, useId } from "vue";
import {
  accentColor,
  labelFont,
  themeMeta,
  tokenColor,
  useLayerPointer,
  useLayerSet,
  type BeforeId,
  type GeoJSONData,
  type LayerSpec,
  type MapFeatureEvent,
} from "@/lib/map-layers";

/** The last resort for count text when neither `--primary-foreground` nor `--background` resolves. */
const FALLBACK_LABEL = "#ffffff";

type ClusterSource = { getClusterExpansionZoom?: (clusterId: number) => Promise<number> };

const props = withDefaults(
  defineProps<{
    /** Point features only (a FeatureCollection; MultiPoint is not clustered) or a URL MapLibre fetches. */
    data: GeoJSONData;
    /** Map id when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Source id and layer-id prefix. Defaults to a generated id. */
    id?: string;
    /** Cluster radius in pixels. Defaults to 50. */
    radius?: number;
    /** The last zoom at which points cluster. Defaults to 14. */
    maxZoom?: number;
    /** Point counts where clusters grow: [medium, large]. Defaults to [10, 100]. */
    steps?: [number, number];
    /** Numeric properties summed into each cluster's properties. */
    sum?: string[];
    /** Colour for clusters and points. Defaults to your --primary (or the theme accent). */
    color?: string;
    /** Report single-point clicks through `@click`. Clusters always respond, regardless of this. */
    interactive?: boolean;
    /** Zoom in on a cluster click. `false` emits `clusterClick` with the cluster's count instead. */
    zoomOnClick?: boolean;
    /** Insertion point. Default: below the labels. `null`: on top. */
    beforeId?: BeforeId;
  }>(),
  { radius: 50, maxZoom: 14, steps: () => [10, 100], interactive: false, zoomOnClick: true },
);

const emit = defineEmits<{
  click: [event: MapFeatureEvent];
  clusterClick: [event: MapFeatureEvent & { count: number }];
}>();

const generated = `unmap-clusters-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
const sourceId = computed(() => props.id ?? generated);
const clustersId = computed(() => `${sourceId.value}-clusters`);
const pointsId = computed(() => `${sourceId.value}-points`);

const { map } = useLayerSet(() => ({
  mapId: props.mapId,
  sourceId: sourceId.value,
  source: {
    cluster: true,
    clusterRadius: props.radius,
    clusterMaxZoom: props.maxZoom,
    ...(props.sum && props.sum.length > 0
      ? { clusterProperties: Object.fromEntries(props.sum.map((name) => [name, ["+", ["get", name]]])) }
      : {}),
  },
  data: props.data,
  beforeId: props.beforeId,
  key: JSON.stringify([props.color, props.steps]),
  layers: (live) => {
    const colour = accentColor(live, props.color, themeMeta(live).marker?.color);
    const background = tokenColor(live, "--background");
    const label = tokenColor(live, "--primary-foreground") ?? background ?? FALLBACK_LABEL;
    return [
      {
        id: clustersId.value,
        type: "circle",
        source: sourceId.value,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": colour,
          "circle-radius": ["step", ["get", "point_count"], 16, props.steps[0], 22, props.steps[1], 30],
          "circle-stroke-color": background ?? colour,
          "circle-stroke-width": 2,
          "circle-opacity": 0.9,
        },
      },
      {
        id: `${sourceId.value}-count`,
        type: "symbol",
        source: sourceId.value,
        filter: ["has", "point_count"],
        // Symbols place top down and the counts sit below every base label: without these a
        // count that touches a city or road label is dropped.
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": labelFont(live),
          "text-size": 12,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": label },
      },
      {
        id: pointsId.value,
        type: "circle",
        source: sourceId.value,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": colour,
          "circle-radius": 5,
          "circle-stroke-color": background ?? colour,
          "circle-stroke-width": 1.5,
        },
      },
    ] as LayerSpec[];
  },
}));

useLayerPointer(() => ({
  map: map.value,
  layerIds: [clustersId.value],
  enabled: true,
  onClick: (event) => {
    const count = Number(event.feature.properties.point_count ?? 0);
    if (!props.zoomOnClick) {
      emit("clusterClick", { ...event, count });
      return;
    }
    const current = map.value;
    if (!current) return;
    const clusterId = Number(event.feature.properties.cluster_id);
    const source = current.getSource(sourceId.value) as ClusterSource | undefined;
    const center = (event.feature.geometry as { coordinates?: [number, number] }).coordinates ?? event.lngLat;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // A cluster clicked mid-swap or mid-zoom can find no source, a rejected lookup, or, once it
    // resolves, a source rebuilt under the same id whose clusters differ; ignore all three.
    source
      ?.getClusterExpansionZoom?.(clusterId)
      .then((zoom) => {
        if ((current.getSource(sourceId.value) as unknown) === source) current.easeTo({ center, zoom, duration: reduce ? 0 : 500 });
      })
      .catch(() => {});
  },
}));

useLayerPointer(() => ({
  map: map.value,
  layerIds: [pointsId.value],
  enabled: props.interactive,
  onClick: (event) => emit("click", event),
}));
</script>

<template>
  <slot />
</template>
