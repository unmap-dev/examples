<script setup lang="ts">
/**
 * <UnmapMarker> - a declarative pin for an unmap map.
 *
 * Attaches to the shared map from `map-context` via `useMap()`. Places a pin at a coordinate,
 * optionally rendering custom content into the marker element through the `marker` slot, and
 * exposes its MapLibre handle to a nested <UnmapPopup> (click-to-open, or hover with
 * `trigger="hover"`) and <UnmapMarkerTooltip>.
 * A `draggable` pin emits `dragend` with where it was dropped.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 * Import it as `import { UnmapMarker } from "@/components/ui/marker-popup"`; Nuxt auto-imports
 * it as `<UiUnmapMarker>` through shadcn-nuxt.
 */

import { computed, provide, ref, shallowRef, useSlots, watch, type InjectionKey, type Ref, type ShallowRef } from "vue";
import { maplibregl } from "@unmap/maps";
import { useMap, useMapGeneration } from "@/lib/map-context";

type MarkerHandle = InstanceType<typeof maplibregl.Marker>;

/**
 * Marker/route styling the gateway resolved from a `?theme=` code, embedded in the style's
 * metadata under "unmap:theme". Absent (empty object) on unthemed styles. Duplicated per
 * component file on purpose: registry items must stand alone once copied into a project.
 */
type UnmapThemeMeta = {
  marker?: { color?: string; scale?: number };
  route?: {
    color?: string;
    width?: number;
    opacity?: number;
    casingColor?: string;
    casingWidth?: number;
    casingOpacity?: number;
  };
};

function themeMeta(map: { getStyle: () => { metadata?: unknown } | undefined } | null): UnmapThemeMeta {
  const meta = map?.getStyle()?.metadata;
  const t = meta && typeof meta === "object" ? (meta as Record<string, unknown>)["unmap:theme"] : undefined;
  return t && typeof t === "object" ? (t as UnmapThemeMeta) : {};
}

/** Theme metadata may carry `var()` strings; MapLibre cannot take those, so treat them as absent. */
function concrete(value: string | undefined): string | null {
  return value && !value.includes("var(") ? value : null;
}

/** The last resort when neither a theme nor a design-system token supplies a colour. */
const FALLBACK_ACCENT = "#ff3e9a";
/** A value no design system uses, so an invalid token can be told apart from a real colour. */
const SENTINEL = "#010203";

type MapLike = {
  getStyle: () => { metadata?: unknown } | undefined;
  getContainer?: () => HTMLElement | null;
};

/** The `<Map>` root: carries `data-unmap-accent` and the design-system custom properties. */
function hostOf(map: MapLike | null): HTMLElement | null {
  const element = map?.getContainer?.() ?? null;
  return element?.closest?.("[data-unmap-map]") ?? element;
}

function accentOf(host: HTMLElement | null): "theme" | "system" {
  return host?.getAttribute("data-unmap-accent") === "system" ? "system" : "theme";
}

/**
 * Resolve a design-system custom property (`--primary`, `--background`) to a concrete `#rrggbb`
 * string. MapLibre paint and the marker SVG cannot take `var()`, so the computed value is read off
 * the map container, painted into a 1x1 canvas, and the pixel read back. The pixel, not the
 * serialisation: a colour-managed canvas (Chrome 111+) hands `fillStyle` back in the colour's own
 * space, so an OKLCH token — what Tailwind v4 emits — comes back as `oklch(...)`, never as hex.
 * Returns null when the property is unset or the browser rejects the value. A translucent
 * token composites over the empty canvas and comes back as opaque RGB; its alpha is dropped.
 */
function resolveToken(host: HTMLElement | null, name: string): string | null {
  if (!host || typeof getComputedStyle !== "function") return null;
  const raw = getComputedStyle(host).getPropertyValue(name).trim();
  if (!raw) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = SENTINEL;
  context.fillStyle = raw; // left at the sentinel when the browser rejects `raw`
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  const hex = `#${[r, g, b].map((channel) => channel!.toString(16).padStart(2, "0")).join("")}`;
  return hex === SENTINEL && raw.toLowerCase() !== SENTINEL ? null : hex;
}

/**
 * The pin colour. Explicit prop first. Then, under `accent="theme"`, the theme's marker colour
 * before `--primary`; under `accent="system"`, `--primary` before the theme's colour. Magenta only
 * when nothing else exists.
 */
function markerColor(map: MapLike | null, explicit: string | undefined): string {
  if (explicit) return explicit;
  const host = hostOf(map);
  const themed = concrete(themeMeta(map).marker?.color);
  const system = () => resolveToken(host, "--primary");
  return (accentOf(host) === "system" ? system() ?? themed : themed ?? system()) ?? FALLBACK_ACCENT;
}

/**
 * Repaint MapLibre's default pin without rebuilding it, so a popup open on it stays open. The pin
 * colour sits on the one element whose `fill` is the colour it was drawn with; the shadow, border
 * and icon carry fixed fills. False when there is not exactly one such element (a pin drawn in
 * one of those fixed colours, or a MapLibre that builds its pin differently); the caller then
 * recreates the marker.
 */
function recolourPin(element: HTMLElement, from: string, to: string): boolean {
  const painted = Array.from(element.querySelectorAll("[fill]")).filter((node) => node.getAttribute("fill") === from);
  if (painted.length !== 1) return false;
  painted[0]!.setAttribute("fill", to);
  return true;
}

/** Shared with <UnmapPopup> through `Symbol.for`, so neither file has to import the other. */
const MARKER_KEY: InjectionKey<ShallowRef<MarkerHandle | null>> = Symbol.for("unmap:marker");

const props = withDefaults(
  defineProps<{
    /** Pin position as [longitude, latitude]. Changing the coordinates moves the pin. */
    lngLat: [number, number];
    /** Map id when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Pin colour. Defaults to the theme's marker colour or your design system's --primary, per the map's accent. */
    color?: string;
    /**
     * Let the reader drag the pin. It stays where it is dropped; `lngLat` moves it again whenever
     * its coordinates change, so write `@dragend` back into state if you keep one.
     * To reject a drop, set `lngLat` to a different value; setting it to the value it already had is not a change and leaves the pin where it was dropped.
     */
    draggable?: boolean;
  }>(),
  { draggable: false },
);

const emit = defineEmits<{
  /** Fired when the marker element is clicked. Not fired for the click that ends a drag. */
  click: [event: MouseEvent];
  /** Fired once a drag ends, with the pin's new [longitude, latitude]. */
  dragend: [lngLat: [number, number]];
}>();

const slots = useSlots();
const map = useMap(() => props.mapId);
const generation = useMapGeneration(() => props.mapId);
const marker = shallowRef<MarkerHandle | null>(null);
const markerElement = shallowRef<HTMLDivElement | null>(null);
// Custom content replaces MapLibre's default pin; nested popup children are intentionally separate.
const hasCustomMarker = computed(() => slots.marker != null);

// Bumped only when an in-place recolour cannot find the pin, to force a rebuild.
const rebuild = shallowRef(0);
// The colour the live default pin is drawn in; null for a custom-content marker.
let painted: string | null = null;
// Where the pin is: the last `lngLat` coordinates, or where a drag left it. A rebuild draws it here.
let position: [number, number] = [props.lngLat[0], props.lngLat[1]];
// The same position, reactive, for a tooltip that has to follow the pin.
const where = shallowRef<[number, number]>(position);
const moveTo = (to: [number, number]) => {
  if (where.value[0] !== to[0] || where.value[1] !== to[1]) where.value = to;
};

// Resolved once per style generation (or when the caller's own inputs change), not on every
// render. A new colour is painted onto the existing pin (below), so a swap, including a
// dark-mode toggle that changes `--primary`, keeps the marker and any popup open on it. Only a
// new `scale` rebuilds the marker, since MapLibre sizes its pin once, at construction.
const pin = computed(() => {
  generation.value; // establish the dependency: recomputed once per style generation
  const current = map.value;
  return current && !hasCustomMarker.value ? markerColor(current, props.color) : null;
});
const scale = computed(() => {
  generation.value;
  const current = map.value;
  return current && !hasCustomMarker.value ? themeMeta(current).marker?.scale : undefined;
});

watch(
  [map, scale, hasCustomMarker, rebuild],
  ([current, scaleValue, custom], _previous, onCleanup) => {
    if (!current) return;
    const el = custom ? document.createElement("div") : undefined;
    if (el) {
      el.style.cursor = "pointer";
      markerElement.value = el;
    }
    // Read, not watched: a new pin colour is painted in place by the watcher below.
    const fill = pin.value ?? FALLBACK_ACCENT;
    const handle = new maplibregl.Marker(
      el ? { element: el } : { color: fill, ...(scaleValue != null ? { scale: scaleValue } : {}) },
    )
      .setLngLat(position)
      .addTo(current);
    painted = el ? null : fill;
    marker.value = handle;
    const element = handle.getElement();
    // A drag ends with the pointer released over the pin; a click the browser sends after it is
    // not a click. The flag clears on the next pointer-down, which starts every real click.
    // A real or keyboard drag often gets no click at all, so the flag can stay set until the next
    // pointer-down; a click with no pointer-down before it (assistive tech, element.click()) is
    // swallowed once.
    let dragged = false;
    const onDragEnd = () => {
      const { lng, lat } = handle.getLngLat();
      position = [lng, lat];
      moveTo(position);
      dragged = true;
      emit("dragend", [lng, lat]);
    };
    const onPointerDown = () => {
      dragged = false;
    };
    const onClick = (event: MouseEvent) => {
      if (dragged) {
        dragged = false;
        return;
      }
      emit("click", event);
    };
    handle.on("dragend", onDragEnd);
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("click", onClick);
    onCleanup(() => {
      handle.off("dragend", onDragEnd);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("click", onClick);
      handle.remove();
      if (marker.value === handle) marker.value = null;
      if (markerElement.value === el) markerElement.value = null;
    });
  },
  { immediate: true, flush: "post" },
);

// Declared after the watcher above, so when both fire in one flush the rebuild runs first and
// this one sees the pin already drawn in the new colour.
watch(
  pin,
  (next) => {
    const handle = marker.value;
    if (!handle || next == null || painted == null || next === painted) return;
    if (recolourPin(handle.getElement(), painted, next)) painted = next;
    else rebuild.value += 1;
  },
  { flush: "post" },
);

// Applied to every marker, the rebuilt ones included.
watch(
  [marker, () => props.draggable],
  ([handle, draggable]) => {
    handle?.setDraggable(draggable);
  },
  { immediate: true, flush: "post" },
);

// Keep position reactive without recreating the marker. Keyed on the numbers, not the array: a
// template's `:lng-lat="[lng, lat]"` is a new array on every render, and following it would pull
// a dropped pin back to where it started whenever the parent re-rendered.
watch([() => props.lngLat[0], () => props.lngLat[1]], ([lng, lat]) => {
  position = [lng, lat];
  moveTo(position);
  marker.value?.setLngLat(position);
});

/** Shared with <UnmapPopup> and <UnmapMarkerTooltip>: true while a mouse or pen is over the pin or it has keyboard focus, false while it is dragged. */
const MARKER_HOVER_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol.for("unmap:marker-hover");
/** Shared with <UnmapMarkerTooltip>: where the pin is, so a tooltip follows it. */
const MARKER_POSITION_KEY: InjectionKey<Readonly<Ref<[number, number]>>> = Symbol.for("unmap:marker-position");
/** Written by the bound <UnmapPopup>, read by <UnmapMarkerTooltip>: whether it is open, and whether it opens on hover. */
const MARKER_POPUP_KEY: InjectionKey<Ref<{ open: boolean; hover: boolean }>> = Symbol.for("unmap:marker-popup");
const hovered = ref(false);
const popup = ref({ open: false, hover: false });

// Touch has no hover: a tap is a click. MapLibre turns pointer events off on the pin while it
// moves, so a drag clears the pointer until it enters again.
watch(
  marker,
  (handle, _previous, onCleanup) => {
    if (!handle) return;
    const element = handle.getElement();
    let pointer = false;
    let focus = false;
    let dragging = false;
    // A press focuses the pin (a popup or `draggable` gives it a tab stop) without reading as
    // hover: on touch the tap would show a tooltip that sticks, and a hover popup would open on
    // the focus and be closed again by MapLibre's click toggle. Only focus that arrives without
    // a press, from the keyboard, counts.
    let pressed = false;
    const sync = () => {
      hovered.value = (pointer || focus) && !dragging;
    };
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = true;
      sync();
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = false;
      sync();
    };
    const onPress = () => {
      pressed = true;
    };
    // A press's focus arrives before its click, so a press that ends first (a touch that became a
    // map pan, or a pin that cannot take focus) must not swallow the keyboard focus after it.
    const onRelease = () => {
      pressed = false;
    };
    const onFocusIn = () => {
      if (pressed) return;
      focus = true;
      sync();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      pressed = false;
      focus = false;
      sync();
    };
    const onDragStart = () => {
      dragging = true;
      sync();
    };
    // A touch drag ends with no click and no focus, so it clears its own press.
    const onDragEnd = () => {
      dragging = false;
      pointer = false;
      pressed = false;
      sync();
    };
    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("pointerdown", onPress);
    element.addEventListener("pointercancel", onRelease);
    element.addEventListener("click", onRelease);
    element.addEventListener("focusin", onFocusIn);
    element.addEventListener("focusout", onFocusOut);
    handle.on("dragstart", onDragStart);
    handle.on("dragend", onDragEnd);
    onCleanup(() => {
      element.removeEventListener("pointerenter", onEnter);
      element.removeEventListener("pointerleave", onLeave);
      element.removeEventListener("pointerdown", onPress);
      element.removeEventListener("pointercancel", onRelease);
      element.removeEventListener("click", onRelease);
      element.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("focusout", onFocusOut);
      handle.off("dragstart", onDragStart);
      handle.off("dragend", onDragEnd);
      hovered.value = false;
    });
  },
  // Immediate: the first watcher above sets `marker` synchronously during setup when the map is
  // already there, before this one exists, so waiting for a change would never see it.
  { immediate: true, flush: "post" },
);

provide(MARKER_HOVER_KEY, hovered);
provide(MARKER_POSITION_KEY, where);
provide(MARKER_POPUP_KEY, popup);
provide(MARKER_KEY, marker);
</script>

<template>
  <Teleport v-if="markerElement" :to="markerElement">
    <slot name="marker" />
  </Teleport>
  <slot />
</template>
