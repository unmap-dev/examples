<script setup lang="ts">
/**
 * <UnmapMapControls> - zoom, compass, locate, fullscreen, globe and 3D terrain buttons for an
 * unmap map, in Vue.
 *
 * Built on your shadcn-vue ButtonGroup, Button, Tooltip and Alert, so the buttons take your
 * radius, palette and focus ring, and the icons follow your icon library. Put it inside
 * `<UnmapMap :controls="false">`: the map's own zoom and compass buttons are then off and these
 * take their place. The attribution stays either way; the OpenStreetMap licence requires it.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 * Import it as `import { UnmapMapControls } from "@/components/ui/map-controls"`; Nuxt
 * auto-imports it as `<UiUnmapMapControls>` through shadcn-nuxt.
 */

import { computed, ref, watch, type Component, type HTMLAttributes } from "vue";
import { maplibregl, type Map } from "@unmap/maps";
import {
  GlobeIcon,
  LocateFixedIcon,
  MaximizeIcon,
  MinimizeIcon,
  MinusIcon,
  MountainIcon,
  Navigation2Icon,
  PlusIcon,
} from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMap, useMapGeneration, useMapReady, useMapTerrain } from "@/lib/map-context";
import { cn } from "@/lib/utils";

// Other attributes land on the controls' own div, not on the tooltip provider.
defineOptions({ inheritAttrs: false });

/* map-controls:shared:start */
type Lang = "en" | "fr";

/** The corner the controls sit in. */
export type MapControlsPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Where the reader is, as the locate event reports it. `accuracy` is in metres. */
export interface MapLocation {
  lngLat: [number, number];
  accuracy: number;
}

/** Why the reader's location could not be shown, as the locate error event reports it. */
export interface MapLocateError {
  code: "denied" | "unavailable" | "timeout" | "unsupported";
  /** The sentence for this code, in the `lang` the controls had when the error happened. */
  message: string;
}

const COPY = {
  en: {
    zoomGroup: "Zoom",
    viewGroup: "Map view",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    compass: "Reset to north",
    globe: "Globe view",
    terrain: "3D terrain",
    locate: "Show my location",
    fullscreen: "Fullscreen",
    here: "Your location",
    errors: {
      denied: "Location permission was denied.",
      unavailable: "Your location could not be found.",
      timeout: "Finding your location took too long.",
      unsupported: "This browser cannot share its location.",
    },
  },
  fr: {
    zoomGroup: "Zoom",
    viewGroup: "Vue de la carte",
    zoomIn: "Zoom avant",
    zoomOut: "Zoom arrière",
    compass: "Réorienter vers le nord",
    globe: "Vue globe",
    terrain: "Relief 3D",
    locate: "Afficher ma position",
    fullscreen: "Plein écran",
    here: "Votre position",
    errors: {
      denied: "L'accès à votre position a été refusé.",
      unavailable: "Votre position est introuvable.",
      timeout: "La recherche de votre position a pris trop de temps.",
      unsupported: "Ce navigateur ne peut pas partager sa position.",
    },
  },
} as const;

/**
 * The source the terrain button adds: its own copy of the style's DEM. MapLibre renders terrain
 * better from a source no hillshade layer shares, and warns when they share one.
 */
const TERRAIN_SOURCE_ID = "unmap-controls-terrain";
/** Seen from straight above, terrain is a flat map: below FLAT_PITCH, turning it on tilts to TERRAIN_PITCH. */
const TERRAIN_PITCH = 60;
const FLAT_PITCH = 30;
/** How close locate flies: street level, unless the camera is already closer. */
const LOCATE_ZOOM = 14;
const LOCATE_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 };
/** MapLibre's own fill-the-window class, styled by the stylesheet the `map` item imports. */
const PSEUDO_FULLSCREEN = "maplibregl-pseudo-fullscreen";

/** Layout per corner, on MapLibre's 10px control margin. Bottom-right clears the attribution. */
const CORNERS: Record<MapControlsPosition, string> = {
  "top-left": "top-2.5 left-2.5 items-start",
  "top-right": "top-2.5 right-2.5 items-end",
  "bottom-left": "bottom-2.5 left-2.5 items-start",
  "bottom-right": "bottom-10 right-2.5 items-end",
};

type StyleSource = ReturnType<Map["getStyle"]>["sources"][string];

/** The style's own elevation source, or null. The terrain copy is skipped, so a re-check finds the original. */
function demSourceOf(map: Map): StyleSource | null {
  const sources = map.getStyle()?.sources ?? {};
  for (const [id, source] of Object.entries(sources)) {
    if (id !== TERRAIN_SOURCE_ID && source.type === "raster-dem") return source;
  }
  return null;
}

/** A Geolocation error code (1 denied, 2 unavailable, 3 timeout), or null when there is no Geolocation API. */
function locateErrorOf(code: number | null, lang: Lang): MapLocateError {
  const kind: MapLocateError["code"] =
    code === null ? "unsupported" : code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable";
  return { code: kind, message: COPY[lang].errors[kind] };
}

/** The reader's position: a dot in your --primary, ringed in --background so it reads on any map. */
function locationDot(label: string): HTMLElement {
  const dot = document.createElement("span");
  dot.className = "block size-4 rounded-full border-2 border-background bg-primary";
  dot.setAttribute("role", "img");
  dot.setAttribute("aria-label", label);
  dot.setAttribute("data-unmap-location", "");
  return dot;
}
/* map-controls:shared:end */

type MarkerHandle = InstanceType<typeof maplibregl.Marker>;

interface Control {
  name: string;
  label: string;
  icon: Component;
  iconClass?: string;
  iconStyle?: Record<string, string>;
  pressed?: boolean;
  busy?: boolean;
  disabled: boolean;
  run: () => void;
}

const props = withDefaults(
  defineProps<{
    /** Map id when several maps share a page. Defaults to "default". */
    mapId?: string;
    /** The corner the controls sit in. Defaults to "top-right", where the map's own buttons were. */
    position?: MapControlsPosition;
    /** Zoom in and out. On by default. */
    zoom?: boolean;
    /** A needle that follows the bearing; a press turns the map back to north and flat. On by default. */
    compass?: boolean;
    /** Fly to the reader's location and mark it. The browser asks for permission on the first press. */
    locate?: boolean;
    /** Fill the screen with the map, or the window where the page cannot go fullscreen. */
    fullscreen?: boolean;
    /** Switch between the flat map and the globe. */
    globe?: boolean;
    /**
     * Tilt the map over 3D terrain, on any style. A style that carries elevation (`outdoor`, `atlas`,
     * `swiss`, `winter`) lifts in place; any other reloads with the gateway's `terrain=on`.
     */
    terrain?: boolean;
    /** Button names, tooltips and messages. Defaults to English. */
    lang?: "en" | "fr";
    /** Show locate errors in an Alert under the buttons. Set false when you show your own from `@locate-error`. */
    locateAlert?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    position: "top-right",
    zoom: true,
    compass: true,
    locate: false,
    fullscreen: false,
    globe: false,
    terrain: false,
    lang: "en",
    locateAlert: true,
  },
);

const emit = defineEmits<{
  /** The reader's position, after a successful locate. */
  locate: [location: MapLocation];
  /** Why the location could not be shown: denied, unavailable, timed out or unsupported. */
  locateError: [error: MapLocateError];
}>();

const map = useMap(() => props.mapId);
const ready = useMapReady(() => props.mapId);
const generation = useMapGeneration(() => props.mapId);
const requestTerrain = useMapTerrain(() => props.mapId);
const copy = computed(() => COPY[props.lang]);

const bearing = ref(0);
const isGlobe = ref(false);
const hasDem = ref(false);
const terrainOn = ref(false);
// A style without elevation is lifted by the gateway instead (`terrain=on`, through map-context),
// which reloads the style. `requested` is this button's last ask, shown at once rather than after
// the reload; otherwise the button reads the loaded style, whose terrain the `<UnmapMap terrain>`
// prop may have asked for. Both are reset with the map, as `terrainOn` is.
const styleTerrain = ref(false);
const requested = ref<boolean | null>(null);
const gatewayOn = computed(() => requested.value ?? styleTerrain.value);
const terrainPressed = computed(() => terrainOn.value || gatewayOn.value);
const isFullscreen = ref(false);
const atMaxZoom = ref(false);
const atMinZoom = ref(false);
const locating = ref(false);
// The code, not the sentence, so the Alert follows a `lang` change.
const locateError = ref<MapLocateError["code"] | null>(null);
let dot: MarkerHandle | null = null;
let locateRequest = 0;

// The compass, the zoom limits, fullscreen, terrain, the location dot and its Alert belong to
// one map. A new map (or unmounting) leaves fullscreen and terrain, removes the dot and the
// Alert and ignores any location answer still on its way. A style swap keeps the same map.
watch(
  map,
  (m, _previous, onCleanup) => {
    if (!m) return;
    const container = m.getContainer();
    const updateBearing = () => {
      bearing.value = m.getBearing();
    };
    // As NavigationControl does: the constrained minimum, which maxBounds can raise.
    const updateZoom = () => {
      const now = m.getZoom();
      atMaxZoom.value = now >= m.getMaxZoom();
      atMinZoom.value = now <= m.getMinZoom(true);
    };
    const updateFullscreen = () => {
      isFullscreen.value = document.fullscreenElement === container || container.classList.contains(PSEUDO_FULLSCREEN);
    };
    const onKey = (event: KeyboardEvent) => {
      // A select, a dialog or a search box that closed on this Escape has handled it.
      if (event.key !== "Escape" || event.defaultPrevented || !container.classList.contains(PSEUDO_FULLSCREEN)) return;
      container.classList.remove(PSEUDO_FULLSCREEN);
      updateFullscreen();
    };
    updateBearing();
    updateZoom();
    updateFullscreen();
    m.on("rotate", updateBearing);
    m.on("move", updateZoom);
    document.addEventListener("fullscreenchange", updateFullscreen);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      m.off("rotate", updateBearing);
      m.off("move", updateZoom);
      document.removeEventListener("fullscreenchange", updateFullscreen);
      document.removeEventListener("keydown", onKey);
      container.classList.remove(PSEUDO_FULLSCREEN);
      if (document.fullscreenElement === container) void document.exitFullscreen?.().catch(() => {});
      locateRequest += 1;
      locating.value = false;
      locateError.value = null;
      terrainOn.value = false;
      requested.value = null;
      dot?.remove();
      dot = null;
    });
  },
  { immediate: true },
);

// The dot is made once per map, so a language change relabels the one already there.
watch(
  () => props.lang,
  (lang) => dot?.getElement().setAttribute("aria-label", COPY[lang].here),
);

// Turning the `terrain` prop off forgets the press, so turning it back on starts flat, and
// drops any terrain this button asked the gateway for.
watch(
  () => props.terrain,
  (allowed) => {
    if (allowed) return;
    terrainOn.value = false;
    if (requested.value) {
      requested.value = null;
      requestTerrain(null);
    }
  },
);

// Globe: read the projection back from the map, as MapLibre's own GlobeControl does, so the
// button shows the `projection` prop, a style swap and its own presses alike.
watch(
  [map, generation],
  ([m], _previous, onCleanup) => {
    if (!m) {
      isGlobe.value = false;
      return;
    }
    const update = () => {
      isGlobe.value = m.getProjection()?.type === "globe";
    };
    update();
    m.on("projectiontransition", update);
    onCleanup(() => m.off("projectiontransition", update));
  },
  { immediate: true },
);

// Whether the style carries a raster-dem source decides how terrain turns on: in place from a
// copy of it, or through the gateway. Mid-swap the previous answer stands.
watch(
  [map, ready, generation],
  ([m, isReady]) => {
    if (!m) {
      hasDem.value = false;
      return;
    }
    if (isReady) hasDem.value = demSourceOf(m) !== null;
  },
  { immediate: true },
);

// Terrain the loaded style already draws: the gateway's, never this button's own DEM copy.
watch(
  [map, ready, generation],
  ([m, isReady]) => {
    if (!m) {
      styleTerrain.value = false;
      return;
    }
    if (!isReady) return;
    const drawn = m.getTerrain();
    styleTerrain.value = drawn != null && drawn.source !== TERRAIN_SOURCE_ID;
  },
  { immediate: true },
);

// Terrain on: add the DEM copy and set it as terrain. A style swap drops both, and the new
// generation puts them back when the new style has elevation too.
watch(
  [map, ready, generation, () => props.terrain, terrainOn],
  ([m, isReady, _generation, allowed, on], _previous, onCleanup) => {
    if (!m || !isReady || !allowed || !on) return;
    const dem = demSourceOf(m);
    if (!dem) {
      // Swapped to a style without elevation: the gateway lifts this one.
      terrainOn.value = false;
      requested.value = true;
      requestTerrain(true);
      return;
    }
    let removed = false;
    const onRemove = () => {
      removed = true;
    };
    m.on("remove", onRemove);
    if (!m.getSource(TERRAIN_SOURCE_ID)) m.addSource(TERRAIN_SOURCE_ID, dem);
    m.setTerrain({ source: TERRAIN_SOURCE_ID });
    onCleanup(() => {
      m.off("remove", onRemove);
      // A removed map throws on every call; a style mid-swap has already dropped both.
      if (removed || !m.getStyle()) return;
      if (m.getTerrain()?.source === TERRAIN_SOURCE_ID) m.setTerrain(null);
      if (m.getSource(TERRAIN_SOURCE_ID)) m.removeSource(TERRAIN_SOURCE_ID);
    });
  },
  { immediate: true },
);

function toggleGlobe() {
  // The projectiontransition listener updates the button; map-context carries it across a swap.
  map.value?.setProjection({ type: isGlobe.value ? "mercator" : "globe" });
}

function toggleTerrain() {
  const m = map.value;
  if (!m) return;
  if (terrainPressed.value) {
    terrainOn.value = false;
    if (gatewayOn.value) {
      requested.value = false;
      requestTerrain(false);
    }
    return;
  }
  // A style with its own DEM lifts in place; any other reloads with the gateway's terrain.
  if (hasDem.value) terrainOn.value = true;
  else {
    requested.value = true;
    requestTerrain(true);
  }
  if (m.getPitch() < FLAT_PITCH) m.easeTo({ pitch: TERRAIN_PITCH });
}

function toggleFullscreen() {
  const m = map.value;
  if (!m) return;
  const container = m.getContainer();
  if (container.classList.contains(PSEUDO_FULLSCREEN)) {
    container.classList.remove(PSEUDO_FULLSCREEN);
    isFullscreen.value = false;
    return;
  }
  if (document.fullscreenElement === container) {
    void document.exitFullscreen().catch(() => {});
    return;
  }
  const fillWindow = () => {
    container.classList.add(PSEUDO_FULLSCREEN);
    isFullscreen.value = true;
  };
  if (!document.fullscreenEnabled || typeof container.requestFullscreen !== "function") {
    fillWindow();
    return;
  }
  container.requestFullscreen().catch(fillWindow);
}

function locateMe() {
  const target = map.value;
  if (!target) return;
  locateError.value = null;
  const request = ++locateRequest;
  const fail = (code: number | null) => {
    if (request !== locateRequest) return;
    const error = locateErrorOf(code, props.lang);
    locating.value = false;
    if (props.locateAlert) locateError.value = error.code;
    emit("locateError", error);
  };
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    fail(null);
    return;
  }
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (found) => {
      if (request !== locateRequest) return;
      locating.value = false;
      const lngLat: [number, number] = [found.coords.longitude, found.coords.latitude];
      dot ??= new maplibregl.Marker({ element: locationDot(copy.value.here) });
      dot.setLngLat(lngLat).addTo(target);
      target.flyTo({ center: lngLat, zoom: Math.max(target.getZoom(), LOCATE_ZOOM) });
      emit("locate", { lngLat, accuracy: found.coords.accuracy });
    },
    (error) => fail(error.code),
    LOCATE_OPTIONS,
  );
}

const groups = computed(() => {
  const m = map.value;
  const disabled = !m;
  const styleBusy = !m || !ready.value;
  const t = copy.value;
  const zoomControls: Control[] = props.zoom
    ? [
        { name: "zoom-in", label: t.zoomIn, icon: PlusIcon, disabled: disabled || atMaxZoom.value, run: () => m?.zoomIn() },
        { name: "zoom-out", label: t.zoomOut, icon: MinusIcon, disabled: disabled || atMinZoom.value, run: () => m?.zoomOut() },
      ]
    : [];
  const viewControls: Control[] = [];
  if (props.compass) {
    viewControls.push({
      name: "compass",
      label: t.compass,
      icon: Navigation2Icon,
      iconStyle: { transform: `rotate(${-bearing.value}deg)` },
      disabled,
      run: () => m?.resetNorthPitch(),
    });
  }
  if (props.globe) {
    viewControls.push({ name: "globe", label: t.globe, icon: GlobeIcon, pressed: isGlobe.value, disabled: styleBusy, run: toggleGlobe });
  }
  if (props.terrain) {
    viewControls.push({ name: "terrain", label: t.terrain, icon: MountainIcon, pressed: terrainPressed.value, disabled: styleBusy, run: toggleTerrain });
  }
  if (props.locate) {
    viewControls.push({
      name: "locate",
      label: t.locate,
      icon: LocateFixedIcon,
      iconClass: locating.value ? "animate-pulse" : undefined,
      busy: locating.value,
      disabled,
      run: locateMe,
    });
  }
  if (props.fullscreen) {
    viewControls.push({
      name: "fullscreen",
      label: t.fullscreen,
      icon: isFullscreen.value ? MinimizeIcon : MaximizeIcon,
      pressed: isFullscreen.value,
      disabled,
      run: toggleFullscreen,
    });
  }
  return [
    { name: "zoom", label: t.zoomGroup, controls: zoomControls },
    { name: "view", label: t.viewGroup, controls: viewControls },
  ].filter((group) => group.controls.length > 0);
});

const side = computed(() => (props.position.endsWith("right") ? "left" : "right"));
</script>

<template>
  <TooltipProvider>
    <div
      v-bind="$attrs"
      data-unmap-controls=""
      :class="cn('absolute z-[5] flex flex-col gap-2', CORNERS[props.position], props.class)"
    >
      <ButtonGroup v-for="group in groups" :key="group.name" orientation="vertical" :aria-label="group.label">
        <Tooltip v-for="control in group.controls" :key="control.name">
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="outline"
              size="icon"
              :aria-label="control.label"
              :aria-pressed="control.pressed"
              class="bg-popover text-popover-foreground hover:bg-accent dark:bg-popover dark:hover:bg-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground"
              :aria-busy="control.busy || undefined"
              :disabled="control.disabled"
              @click="control.run"
            >
              <component :is="control.icon" :class="control.iconClass" :style="control.iconStyle" />
            </Button>
          </TooltipTrigger>
          <TooltipContent :side="side">{{ control.label }}</TooltipContent>
        </Tooltip>
      </ButtonGroup>
      <Alert v-if="locateError" variant="destructive" class="w-56">
        <AlertDescription>{{ copy.errors[locateError] }}</AlertDescription>
      </Alert>
    </div>
  </TooltipProvider>
</template>
