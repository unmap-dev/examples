<script setup lang="ts">
/**
 * <UnmapEnergyMap> - an unmap map already composed with `profile="energy"`.
 *
 * Thin wrapper around `<UnmapMap>`: locks the energy composition preset and defaults the
 * cartography to `muted`. Overlay tiles still come from the gateway catalog. This is not a
 * style, and it does not change search — pair it with `<UnmapWellSearch>` /
 * `<UnmapLegalLandSearch>`.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 */

import { computed, useAttrs } from "vue";
import { UnmapMap } from "@/components/ui/map";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** unmap API key (`um_live_...` / `um_test_...`). */
  apiKey: string;
  /**
   * A named style. Named `mapStyle` so the plain `style` attribute keeps styling the
   * container. Defaults to `"muted"` for energy composition.
   */
  mapStyle?: string;
}>();

const attrs = useAttrs();
const mapStyle = computed(() => props.mapStyle ?? "muted");
</script>

<template>
  <UnmapMap :api-key="props.apiKey" :map-style="mapStyle" v-bind="attrs" profile="energy">
    <slot />
  </UnmapMap>
</template>
