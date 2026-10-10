<script setup lang="ts">
/**
 * <UnmapEnergyPopup> - identify energy features on click and show a popup.
 *
 * Pair with a map already composed with `profile="energy"`. Click queries wells, pipelines,
 * and facilities. Identify is not a search call and does not send `profile=`. Each click is one
 * `GET /identify`; a newer click aborts the lookup before it, so a slow one never lands on a
 * newer point, and unmounting aborts the one in flight.
 *
 * `lookup` fires as a click starts a lookup, then exactly one of `identify` (a hit, the popup
 * opens), `miss` (nothing there, the popup closes) or `error` (the lookup failed, the popup
 * closes; the error carries the gateway's `status` and `code`). Each carries the clicked point.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 */

import { computed, watch } from "vue";
import { Geocoder, type IdentifyResult } from "@unmap/geocoding";
import { maplibregl } from "@unmap/maps";
import { useMap } from "@/lib/map-context";

/** Identify-capable energy layers shown on click. */
const ENERGY_CLICK_LAYERS = ["energy.wells", "energy.pipelines", "energy.facilities"] as const;

const props = defineProps<{
  /** unmap API key. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** Map id when multiple maps share a page. Defaults to "default". */
  mapId?: string;
}>();

const emit = defineEmits<{
  /** Emitted as a click starts a lookup, with the clicked [lng, lat]. */
  lookup: [at: [number, number]];
  /** Emitted when identify returns a hit, with the clicked [lng, lat]. */
  identify: [result: IdentifyResult, at: [number, number]];
  /** Emitted when identify finds nothing at the clicked [lng, lat]. */
  miss: [at: [number, number]];
  /** Emitted when identify fails. The error carries the gateway's `status` and `code`. */
  error: [error: unknown, at: [number, number]];
}>();

const map = useMap(() => props.mapId);
const client = computed(() => new Geocoder({ key: props.apiKey, gateway: props.gateway }));

function label(result: IdentifyResult): string {
  return [result.name, result.uwi, result.operator].filter(Boolean).join(" · ");
}

watch(
  map,
  (current, _previous, onCleanup) => {
    if (!current) return;
    const popup = new maplibregl.Popup({ offset: 24, className: "unmap-popup" });
    let inFlight: AbortController | null = null;
    const onClick = (event: { lngLat: { lng: number; lat: number } }) => {
      const at: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      emit("lookup", at);
      void client.value
        .identify({ at, layers: ENERGY_CLICK_LAYERS, signal: controller.signal })
        .then(({ results }) => {
          if (controller.signal.aborted) return;
          const hit = results[0];
          if (!hit) {
            popup.remove();
            emit("miss", at);
            return;
          }
          emit("identify", hit, at);
          popup.setLngLat(at).setText(label(hit)).addTo(current);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          popup.remove();
          emit("error", error, at);
        });
    };
    current.on("click", onClick);
    onCleanup(() => {
      inFlight?.abort();
      current.off("click", onClick);
      popup.remove();
    });
  },
  { immediate: true },
);
</script>

<template></template>
