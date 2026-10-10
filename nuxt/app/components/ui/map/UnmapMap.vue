<script setup lang="ts">
/**
 * <UnmapMap> - the unmap map display component for Vue.
 *
 * Mounts a container, creates a MapLibre map wired to the unmap gateway (via `map-context`),
 * and shares it with any slotted children (UnmapGeocoder, UnmapRoutingPanel, UnmapMarker,
 * UnmapPopup) through `useMap()`.
 *
 * The container is styled with your design-system classes (`rounded-lg`, `bg-muted`), so it
 * takes your radius and palette. MapLibre's own popups and controls are restyled onto your
 * tokens by the CSS this item adds to your stylesheet, scoped under `[data-unmap-map]`.
 * The basemap follows your page's light or dark mode unless you pass `mode`.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 * Import it as `import { UnmapMap } from "@/components/ui/map"`; Nuxt auto-imports it as
 * `<UiUnmapMap>` through shadcn-nuxt.
 */

import { computed, ref, useAttrs, type HTMLAttributes, type StyleValue } from "vue";
import {
  DEFAULT_MAP_ID,
  useMapLifecycle,
  useMapStore,
  useResolvedMode,
  type MapBounds,
  type MapMode,
  type MapViewport,
} from "@/lib/map-context";
import type { MapProfile, Projection, UnmapControlsOptions } from "@unmap/maps";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// MapLibre's stylesheet. Required for controls, markers, and popups to render correctly.
import "maplibre-gl/dist/maplibre-gl.css";

// `class` is merged through cn() and `style` layered under minHeight; everything else falls through.
defineOptions({ inheritAttrs: false });

/**
 * Whose accent markers and route lines take when nothing explicit is passed: the theme code's
 * (`"theme"`) or your design system's `--primary` (`"system"`).
 */
export type MapAccent = "theme" | "system";

const props = withDefaults(
  defineProps<{
    /** unmap API key (`um_live_...` / `um_test_...`). */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /**
     * A named style ("base" | "muted" | "outdoor" | "blueprint" | "blush" | "orchid" | "canopy" | "lagoon" | "tropic" | "sunset" | "bold" | "pastel" | "atlas" | "swiss"), a full style URL, or a MapLibre style.
     * Named `mapStyle` so the plain `style` attribute keeps styling the container. Defaults to "base".
     */
    mapStyle?: string;
    /**
     * "light", "dark", or "auto" (the default) to follow your page: a `dark` or `light` class on
     * <html>, then `data-theme`, then `color-scheme`, then the OS. Switching swaps the style in
     * place; the camera, markers and popups stay.
     */
    mode?: MapMode;
    /** Label language (`en`, `fr`, ...). */
    lang?: string;
    /**
     * Compact theme code from unmap.dev/create (`u00` and up, or `ut1.`). Its marker/route
     * styles reach <UnmapMarker>/<UnmapRoutingPanel> via the style's metadata.
     */
    theme?: string;
    /** Catalog overlay ids composed onto the style. */
    overlays?: string[];
    /** Composition preset. Not a style. Explicit overlays replace the profile list. */
    profile?: MapProfile;
    /**
     * Which accent markers and routes use by default. Defaults to "theme" when a `theme` is set
     * (you composed that accent on purpose) and to "system" otherwise.
     */
    accent?: MapAccent;
    /** Centre as [longitude, latitude]. Changes move the camera in place. */
    center?: [number, number];
    /** Zoom. Changes move the camera in place. */
    zoom?: number;
    /** Bearing in degrees clockwise from north. */
    bearing?: number;
    /** Pitch in degrees from straight down. */
    pitch?: number;
    /**
     * Keeps the camera inside these bounds: `[[west, south], [east, north]]`, or `"canada"` for all
     * of Canada with a margin. Changes apply in place.
     */
    maxBounds?: MapBounds;
    /**
     * The lowest zoom the camera may reach. Above `maxZoom`, both are ignored. On its own it is
     * ignored below -2, above 22 when `maxZoom` is unset, or when it is not a finite number. Each
     * of these logs a console warning.
     */
    minZoom?: number;
    /**
     * The highest zoom the camera may reach. A value above 22 is kept as given. It is ignored, with a
     * console warning, below -2 or when it is not a finite number.
     */
    maxZoom?: number;
    /**
     * `false` turns off panning, zooming, rotating and the keyboard, for a static map. Pins (draggable
     * ones too), popups and the zoom buttons keep working.
     */
    interactive?: boolean;
    /**
     * Ask for Ctrl or Cmd with the scroll wheel, and two fingers on touch, so a map in a long page
     * does not trap the scroll.
     */
    cooperativeGestures?: boolean;
    /**
     * Keep the camera in the page URL (`#zoom/lat/lng`). A string names the parameter
     * (`#map=zoom/lat/lng`) so other hash state, or a second map, survives. A position already in
     * the URL wins over `center` and `zoom` when the map loads. A recreated map (a new `apiKey`,
     * say) starts from the props' camera, as MapLibre's own remove-and-recreate does.
     */
    hash?: boolean | string;
    /** `"globe"` draws the map as a sphere. Defaults to `"mercator"`, the flat map. */
    projection?: Projection;
    /**
     * On-map controls. `true` (the default) adds MapLibre's zoom and compass buttons at
     * `top-right`, restyled onto your tokens; `false` adds none. Pass `{ position }` to move them.
     */
    controls?: boolean | UnmapControlsOptions;
    /** Show the loading overlay regardless of the map's state, e.g. while your data loads. */
    loading?: boolean;
    /** Distinguishes multiple maps on one page. Defaults to "default". */
    id?: string;
    class?: HTMLAttributes["class"];
  }>(),
  // Vue casts an absent prop whose type includes boolean to `false`; undefined keeps "not set".
  {
    mapStyle: "base",
    id: DEFAULT_MAP_ID,
    mode: "auto",
    controls: undefined,
    interactive: undefined,
    cooperativeGestures: undefined,
    hash: undefined,
  },
);

const emit = defineEmits<{
  /** Fires as the camera moves. Moves caused by the center/zoom/bearing/pitch props are not reported. */
  viewportChange: [viewport: MapViewport];
}>();

const attrs = useAttrs();
const container = ref<HTMLElement | null>(null);
const accent = computed<MapAccent>(() => props.accent ?? (props.theme ? "theme" : "system"));
const rest = computed(() => {
  const { style: _style, ...others } = attrs;
  return others;
});
const style = computed<StyleValue>(() => [{ minHeight: "320px" }, attrs.style as StyleValue]);

const resolvedMode = useResolvedMode(() => props.mode);
const store = useMapStore();
// UnmapMap provides the store itself, so it reads its own entry rather than injecting.
const generation = computed(() => store.get(props.id)?.generation ?? 0);

useMapLifecycle(
  store,
  container,
  () => ({
    apiKey: props.apiKey,
    gateway: props.gateway,
    style: props.mapStyle,
    mode: resolvedMode.value,
    lang: props.lang,
    theme: props.theme,
    ...(props.overlays && props.overlays.length > 0 ? { overlays: props.overlays } : {}),
    ...(props.profile ? { profile: props.profile } : {}),
    ...(props.center ? { center: props.center } : {}),
    ...(props.zoom != null ? { zoom: props.zoom } : {}),
    ...(props.bearing != null ? { bearing: props.bearing } : {}),
    ...(props.pitch != null ? { pitch: props.pitch } : {}),
    ...(props.maxBounds !== undefined ? { maxBounds: props.maxBounds } : {}),
    ...(props.minZoom != null ? { minZoom: props.minZoom } : {}),
    ...(props.maxZoom != null ? { maxZoom: props.maxZoom } : {}),
    ...(props.interactive !== undefined ? { interactive: props.interactive } : {}),
    ...(props.cooperativeGestures !== undefined ? { cooperativeGestures: props.cooperativeGestures } : {}),
    ...(props.hash !== undefined ? { hash: props.hash } : {}),
    ...(props.projection ? { projection: props.projection } : {}),
    ...(props.controls !== undefined ? { controls: props.controls } : {}),
    onViewportChange: (viewport: MapViewport) => emit("viewportChange", viewport),
  }),
  () => props.id,
);
</script>

<template>
  <div
    ref="container"
    v-bind="rest"
    :class="cn('relative h-full w-full overflow-hidden rounded-lg bg-muted', props.class)"
    :style="style"
    data-unmap-map=""
    :data-unmap-accent="accent"
  >
    <slot />
    <div
      v-if="props.loading || generation === 0"
      data-unmap-loading=""
      class="absolute inset-0 z-10 flex items-center justify-center bg-background/50"
    >
      <Spinner class="size-6" />
    </div>
  </div>
</template>
