<script setup lang="ts">
/**
 * The alive-route-explorer block's camera: frames the endpoints, then the walks once they arrive,
 * into the area right of the panel (above the summary card on a phone), with room above and around
 * for the cards and bubbles. Renders nothing; it sits inside <UnmapMap>. Edit freely.
 */
import { watch } from "vue";
import { useMap, useMapReady } from "@/lib/map-context";
import type { LngLat } from "@/lib/alive-route-explorer/alive-signals";
import { ALIVE_MAP_ID, CAMERA_MS, boundsOf, prefersReducedMotion } from "@/lib/alive-route-explorer/alive-view";

const props = defineProps<{
  frame: LngLat[];
  /** Changes when there is something new to frame. */
  frameKey: string;
  /** The panel, whose side of the map the walks stay clear of. */
  panel: () => HTMLElement | null;
  phone: boolean;
  /** A card found no room: give the walk wider margins above and to the right, where cards go. */
  roomy?: boolean;
}>();

const map = useMap(ALIVE_MAP_ID);
const ready = useMapReady(ALIVE_MAP_ID);

watch(
  [map, ready, () => props.frameKey, () => props.phone, () => props.roomy],
  ([live, isReady, , phone, roomy]) => {
    if (!live || !isReady || props.frame.length === 0) return;
    const box = live.getContainer().getBoundingClientRect();
    const panel = props.panel()?.getBoundingClientRect();
    let padding = phone ? { top: 120, right: 40, bottom: 40, left: 40 } : roomy ? { top: 240, right: 200, bottom: 120, left: 96 } : { top: 140, right: 96, bottom: 96, left: 96 };
    if (panel && panel.width > 0 && box.width > 0) {
      if (phone) padding.bottom = Math.max(padding.bottom, Math.round(box.bottom - panel.top + 40));
      else padding.left = Math.round(panel.right - box.left + 48);
    }
    // A window too small for the reference padding gets an even one rather than an empty frame.
    if (box.width - padding.left - padding.right < 160 || box.height - padding.top - padding.bottom < 160) padding = { top: 24, right: 24, bottom: 24, left: 24 };
    live.fitBounds(boundsOf(props.frame), { padding, maxZoom: 17, duration: prefersReducedMotion() ? 0 : CAMERA_MS });
  },
  { immediate: true, flush: "post" },
);
</script>

<template>
  <slot />
</template>
