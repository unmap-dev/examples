<script setup lang="ts">
/**
 * <UnmapLegalLandSearch> - search box for Canadian legal land descriptions.
 *
 * Sends the query string only. The gateway detects LSD vs civic; this widget does not pass
 * `profile=` or `layers=` as a search source.
 *
 * Coordinates typed into the box are searched as text, not reverse geocoded: a civic address is
 * not what an LSD box is for. Pass `:reverse-geocode="true"` to turn the lookup back on.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 */

import { computed, type HTMLAttributes } from "vue";
import type { GeocodeResult } from "@unmap/geocoding";
import { UnmapGeocoder } from "@/components/ui/geocoder";

const props = withDefaults(
  defineProps<{
    /** unmap API key. */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** Map id to control when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Placeholder text, also used as the accessible label. Defaults to a line in `lang`. */
    placeholder?: string;
    /** Max suggestions to request. Defaults to 5. */
    limit?: number;
    /** Result language. */
    lang?: "en" | "fr";
    /** Zoom level to fly to on selection. Defaults to 15. */
    flyToZoom?: number;
    /** Reverse geocode coordinates typed into the box instead of searching for them. Defaults to false. */
    reverseGeocode?: boolean;
    /** What the list says when a search finds nothing. Defaults to the geocoder's own line. */
    emptyText?: string;
    /** What the list says when a search fails, from the error (it carries the gateway's `status` and `code`). */
    errorText?: (error: unknown) => string;
    class?: HTMLAttributes["class"];
  }>(),
  // An absent Vue boolean is `false` already; the default is spelled out so it reads as a choice.
  { reverseGeocode: false },
);

const emit = defineEmits<{
  /** Emitted after a result is chosen (before the map flies). */
  select: [result: GeocodeResult];
}>();

// The default speaks the language the box searches in.
const placeholder = computed(() => props.placeholder ?? (props.lang === "fr" ? "Chercher une terre légale" : "Search legal land"));
</script>

<template>
  <UnmapGeocoder v-bind="props" :placeholder="placeholder" @select="emit('select', $event)" />
</template>
