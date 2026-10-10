<script setup lang="ts">
/**
 * <UnmapMarkerLabel> - text beside an <UnmapMarker>'s pin, always shown, on your `--background` and
 * `--foreground`. It is drawn into the marker element, so it moves with the pin and never catches
 * the pointer.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 * Import it as `import { UnmapMarkerLabel } from "@/components/ui/marker-popup"`; Nuxt
 * auto-imports it as `<UiUnmapMarkerLabel>` through shadcn-nuxt.
 */

import { inject, shallowRef, watch, type HTMLAttributes, type InjectionKey, type ShallowRef } from "vue";
import { maplibregl } from "@unmap/maps";
import { cn } from "@/lib/utils";

// `class` lands on the label itself, not on the Teleport.
defineOptions({ inheritAttrs: false });

type MarkerHandle = InstanceType<typeof maplibregl.Marker>;

/** Shared with <UnmapMarker> through `Symbol.for`, so neither file has to import the other. */
const MARKER_KEY: InjectionKey<ShallowRef<MarkerHandle | null>> = Symbol.for("unmap:marker");

/** Where the label sits against the pin. Layout only: colour and type come from your tokens. */
const LABEL_POSITION = {
  right: "left-full top-1/2 ml-1 -translate-y-1/2",
  left: "right-full top-1/2 mr-1 -translate-y-1/2",
  top: "bottom-full left-1/2 mb-1 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1 -translate-x-1/2",
} as const;

const props = withDefaults(
  defineProps<{
    /** Which side of the pin the label sits on. Defaults to "right". */
    position?: keyof typeof LABEL_POSITION;
    class?: HTMLAttributes["class"];
  }>(),
  { position: "right" },
);

const marker = inject(MARKER_KEY, null);
const host = shallowRef<HTMLSpanElement | null>(null);

watch(
  () => marker?.value ?? null,
  (handle, _previous, onCleanup) => {
    if (!handle) return;
    const span = document.createElement("span");
    span.setAttribute("data-unmap-marker-label", "");
    handle.getElement().appendChild(span);
    host.value = span;
    onCleanup(() => {
      span.remove();
      if (host.value === span) host.value = null;
    });
  },
  { immediate: true, flush: "post" },
);
</script>

<template>
  <Teleport v-if="host" :to="host">
    <span
      :class="
        cn(
          'pointer-events-none absolute whitespace-nowrap rounded-md bg-background/90 px-1.5 py-0.5 text-xs font-medium text-foreground',
          LABEL_POSITION[props.position],
          props.class,
        )
      "
    >
      <slot />
    </span>
  </Teleport>
</template>
