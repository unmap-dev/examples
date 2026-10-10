<script setup lang="ts">
/**
 * <UnmapPopup> - an anchored bubble on an unmap map.
 *
 * Attaches to the shared map from `map-context` via `useMap()`. Standalone (with `lngLat`) it
 * is added to the map directly; nested inside an <UnmapMarker> it binds to that marker and opens
 * on click, or with `trigger="hover"` while the pointer is over the pin. Slot content is
 * teleported into the popup so it stays reactive.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 * Import it as `import { UnmapPopup } from "@/components/ui/marker-popup"`; Nuxt auto-imports it
 * as `<UiUnmapPopup>` through shadcn-nuxt.
 */

import { inject, onMounted, shallowRef, watch, type InjectionKey, type Ref, type ShallowRef } from "vue";
import { maplibregl } from "@unmap/maps";
import { useMap } from "@/lib/map-context";

type MarkerHandle = InstanceType<typeof maplibregl.Marker>;
type PopupHandle = InstanceType<typeof maplibregl.Popup>;

/** Shared with <UnmapMarker> through `Symbol.for`, so neither file has to import the other. */
const MARKER_KEY: InjectionKey<ShallowRef<MarkerHandle | null>> = Symbol.for("unmap:marker");
/** True while a mouse or pen is over the parent pin or it has focus; false while it is dragged. */
const MARKER_HOVER_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol.for("unmap:marker-hover");
/** Tells the parent pin's <UnmapMarkerTooltip> whether this popup is open, and whether it opens on hover. */
const MARKER_POPUP_KEY: InjectionKey<Ref<{ open: boolean; hover: boolean }>> = Symbol.for("unmap:marker-popup");

const props = withDefaults(
  defineProps<{
    /**
     * Popup position as [longitude, latitude]. Omit when nested inside an <UnmapMarker>: the
     * popup binds to the marker and opens on click.
     */
    lngLat?: [number, number];
    /** Map id when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Offset in pixels from the anchor. Defaults to 24. */
    offset?: number;
    /** Show a close button. Defaults to true, except on a hover popup nested in an <UnmapMarker>, which cannot be reached to click it. */
    closeButton?: boolean;
    /**
     * How a popup nested in an <UnmapMarker> opens. "click" (the default) opens and closes it on
     * a click or tap. "hover" opens it while the pointer is over the pin or the pin has focus; a
     * click, a tap or Enter still toggles it, which is how it opens on a touch screen. Ignored by
     * a standalone popup. A hover popup closes when the pointer or focus leaves the pin, so its
     * content cannot be reached: keep it read-only, and use the default click trigger for
     * anything interactive.
     */
    trigger?: "click" | "hover";
  }>(),
  { offset: 24, closeButton: undefined, trigger: "click" },
);

const map = useMap(() => props.mapId);
const marker = inject(MARKER_KEY, null);
const hovered = inject(MARKER_HOVER_KEY, null);
const bound = inject(MARKER_POPUP_KEY, null);
// The popup's DOM host. Created after mount so server rendering never touches `document`.
const content = shallowRef<HTMLDivElement | null>(null);
const popup = shallowRef<PopupHandle | null>(null);
let standaloneAttached = false;

onMounted(() => {
  content.value = document.createElement("div");
});

watch(
  [
    map,
    () => marker?.value ?? null,
    content,
    () => props.offset,
    () => props.closeButton ?? !(marker && props.trigger === "hover"),
    () => props.trigger === "hover",
  ],
  ([current, handle, host, offset, closeButton, hover], _previous, onCleanup) => {
    if (!current || !host) return;
    // A hover popup must not pull focus to its close button as the pointer passes over the pin.
    const created: PopupHandle = new maplibregl.Popup({
      offset,
      closeButton,
      className: "unmap-popup",
      ...(hover ? { focusAfterOpen: false } : {}),
    }).setDOMContent(host);
    popup.value = created;
    // Tells the pin's tooltip when this popup opens and closes, however it was opened.
    const sync = () => {
      if (bound) bound.value = { open: created.isOpen(), hover };
    };
    if (handle) {
      handle.setPopup(created);
      created.on("open", sync);
      created.on("close", sync);
      sync();
    } else if (props.lngLat) {
      created.setLngLat(props.lngLat).addTo(current);
      standaloneAttached = true;
    }
    onCleanup(() => {
      created.off("open", sync);
      created.off("close", sync);
      if (handle && bound) bound.value = { open: false, hover: false };
      created.remove();
      standaloneAttached = false;
      if (handle) handle.setPopup(undefined);
      if (popup.value === created) popup.value = null;
    });
  },
  { immediate: true, flush: "post" },
);

// Keep a standalone popup's position reactive: add, move, remove and re-add as coordinates come and go.
watch(
  [map, () => marker?.value ?? null, () => props.lngLat],
  ([current, handle, lngLat]) => {
    const existing = popup.value;
    if (handle || !existing) return;
    if (lngLat) {
      existing.setLngLat(lngLat);
      if (!standaloneAttached && current) {
        existing.addTo(current);
        standaloneAttached = true;
      }
    } else if (standaloneAttached) {
      existing.remove();
      standaloneAttached = false;
    }
  },
  { flush: "post" },
);

// A hover popup follows the pin's hover state. It stays bound with `setPopup`, so MapLibre keeps
// it on the pin through drags and moves, and a click, a tap or Enter still toggles it.
watch(
  [() => marker?.value ?? null, popup, () => props.trigger, () => hovered?.value ?? false],
  ([handle, created, trigger, over]) => {
    if (!handle || !created || trigger !== "hover") return;
    if (over !== created.isOpen()) handle.togglePopup();
  },
  { flush: "post" },
);
</script>

<template>
  <Teleport v-if="content" :to="content">
    <slot />
  </Teleport>
</template>
