<script setup lang="ts">
/**
 * <UnmapMarkerTooltip> - a small popup shown while the pointer is over an <UnmapMarker>'s pin, or
 * while the pin has focus. Nest it inside an <UnmapMarker>; it sits beside an <UnmapPopup>, which
 * keeps opening on click, and steps aside while that popup is open; beside a `trigger="hover"`
 * popup, which opens on the same hover, it never shows. Touch screens have no hover, so it never
 * shows there: keep anything essential in an <UnmapMarkerLabel> or an <UnmapPopup>. A pin is
 * focusable only when it has an <UnmapPopup> or is `draggable` (a default pin), so on a pin with
 * neither the tooltip is hover-only and keyboard users do not get it.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 * Import it as `import { UnmapMarkerTooltip } from "@/components/ui/marker-popup"`; Nuxt
 * auto-imports it as `<UiUnmapMarkerTooltip>` through shadcn-nuxt.
 */

import { inject, onMounted, shallowRef, watch, type InjectionKey, type Ref, type ShallowRef } from "vue";
import { maplibregl } from "@unmap/maps";
import { useMap } from "@/lib/map-context";

type MarkerHandle = InstanceType<typeof maplibregl.Marker>;
type PopupHandle = InstanceType<typeof maplibregl.Popup>;

/** Shared with <UnmapMarker> through `Symbol.for`, so neither file has to import the other. */
const MARKER_KEY: InjectionKey<ShallowRef<MarkerHandle | null>> = Symbol.for("unmap:marker");
/** True while a mouse or pen is over the parent pin or it has keyboard focus; false while it is dragged. */
const MARKER_HOVER_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol.for("unmap:marker-hover");
/** Where the parent pin is: its `lngLat`, or where a drag left it. */
const MARKER_POSITION_KEY: InjectionKey<Readonly<Ref<[number, number]>>> = Symbol.for("unmap:marker-position");
/** The parent pin's bound <UnmapPopup>: whether it is open, and whether it opens on hover. */
const MARKER_POPUP_KEY: InjectionKey<Ref<{ open: boolean; hover: boolean }>> = Symbol.for("unmap:marker-popup");

const props = withDefaults(
  defineProps<{
    /** Map id when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Offset in pixels from the pin. Defaults to 24. */
    offset?: number;
  }>(),
  { offset: 24 },
);

const map = useMap(() => props.mapId);
const marker = inject(MARKER_KEY, null);
const hovered = inject(MARKER_HOVER_KEY, null);
const at = inject(MARKER_POSITION_KEY, null);
const bound = inject(MARKER_POPUP_KEY, null);
// The tooltip's DOM host. Created after mount so server rendering never touches `document`.
const content = shallowRef<HTMLDivElement | null>(null);
const tooltip = shallowRef<PopupHandle | null>(null);

onMounted(() => {
  content.value = document.createElement("div");
});

watch(
  [content, () => props.offset],
  ([host, offset], _previous, onCleanup) => {
    if (!host) return;
    // Not bound with `setPopup` (a marker holds one popup), and never focused or closed by a click.
    const created: PopupHandle = new maplibregl.Popup({
      offset,
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
      className: "unmap-popup unmap-tooltip",
    }).setDOMContent(host);
    tooltip.value = created;
    onCleanup(() => {
      created.remove();
      if (tooltip.value === created) tooltip.value = null;
    });
  },
  { immediate: true, flush: "post" },
);

watch(
  [
    map,
    () => marker?.value ?? null,
    tooltip,
    // The pin's popup wins: a hover one opens on this same hover, a click one covers the pin.
    () => (hovered?.value ?? false) && !bound?.value.open && !bound?.value.hover,
    () => at?.value ?? null,
  ],
  ([current, handle, created, shown, position]) => {
    if (!current || !handle || !created) return;
    // Shown at the pin, and moved with it while shown.
    if (shown) {
      const { lng, lat } = handle.getLngLat();
      created.setLngLat(position ?? [lng, lat]).addTo(current);
    } else {
      created.remove();
    }
  },
  { immediate: true, flush: "post" },
);
</script>

<template>
  <Teleport v-if="content" :to="content">
    <slot />
  </Teleport>
</template>
