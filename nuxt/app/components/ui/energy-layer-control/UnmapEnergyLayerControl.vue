<script setup lang="ts">
/**
 * <UnmapEnergyLayerControl> - toggles the energy overlay set on the shared map.
 *
 * An `<UnmapLayerLegend>` preset: one row per energy overlay, each matching every style layer the
 * gateway adds for it (`overlay_<id>_*`: the circle and label of a point overlay, the line and
 * label of a polygon one). The map must already be composed with `profile="energy"` (or an
 * explicit energy `overlays` list) so those layers exist. Hidden overlays stay hidden across a
 * style swap.
 *
 * The legend owns these layers' visibility and applies it again on every `styledata`, so drive it
 * with the checkboxes, not `setLayoutProperty`. Like any legend it owns a layer only if it is the
 * first legend to apply to it (usually the first mounted), until it unmounts; another legend then
 * takes over on its next pass. State is uncontrolled (`default-value`) or controlled (`v-model`),
 * keyed by overlay id, so another control can stay in step with it. It renders a bare fieldset:
 * wrap it in your Card or Popover when floating it over the map.
 *
 * Copied into your project by `npx shadcn-vue add` or `unmap add`. Edit freely.
 */

import { computed, type HTMLAttributes } from "vue";
import { UnmapLayerLegend } from "@/components/ui/layer-legend";

/** Same ids `?profile=energy` expands to. Keep in sync with the gateway catalog. */
const ENERGY_OVERLAYS = [
  { id: "energy.wells", label: "Wells" },
  { id: "energy.pipelines", label: "Pipelines" },
  { id: "energy.facilities", label: "Facilities" },
  { id: "energy.fields", label: "Fields" },
  { id: "energy.petroleum-tenure", label: "Petroleum tenure" },
  { id: "energy.mineral-tenure", label: "Mineral tenure" },
  { id: "energy.ccs", label: "CCS" },
  { id: "energy.geothermal", label: "Geothermal" },
] as const;

/** The legend's state, `LayerLegendValue` in the layer-legend item (whose index exports only the component). */
type LayerLegendValue = { hidden?: string[]; excluded?: Record<string, Array<string | number>> };

/** An energy overlay's id, as `ENERGY_OVERLAYS` lists it. */
type EnergyOverlayId = (typeof ENERGY_OVERLAYS)[number]["id"];

/** The overlays' names in French, by id. */
const ENERGY_LABELS_FR: Record<EnergyOverlayId, string> = {
  "energy.wells": "Puits",
  "energy.pipelines": "Pipelines",
  "energy.facilities": "Installations",
  "energy.fields": "Gisements",
  "energy.petroleum-tenure": "Titres pétroliers",
  "energy.mineral-tenure": "Titres miniers",
  "energy.ccs": "CSC",
  "energy.geothermal": "Géothermie",
};

/** One legend row, `LayerLegendItem` in the layer-legend item. */
type LegendRow = { id: string; label: string; layers: string[]; color?: string | false };

const ENERGY_ITEMS: Record<"en" | "fr", LegendRow[]> = {
  en: ENERGY_OVERLAYS.map(({ id, label }) => ({ id, label, layers: [`overlay_${id}_*`] })),
  fr: ENERGY_OVERLAYS.map(({ id }) => ({ id, label: ENERGY_LABELS_FR[id], layers: [`overlay_${id}_*`] })),
};
const ENERGY_TITLE = { en: "Energy layers", fr: "Couches énergétiques" };

const props = withDefaults(
  defineProps<{
    /** Map id when multiple maps share a page. Defaults to `"default"`. */
    mapId?: string;
    /** Controlled state, for `v-model`: rows keyed by overlay id (`energy.wells`). */
    modelValue?: LayerLegendValue;
    /** Starting state when uncontrolled. */
    defaultValue?: LayerLegendValue;
    /** Language of the title and the rows. Defaults to "en". */
    lang?: "en" | "fr";
    /**
     * Swatch colour per overlay id: a colour, or `false` for no swatch. Pass the colours you paint
     * the overlays with, so the legend matches the map. A row left out takes its first layer's
     * paint colour, as without the prop.
     */
    colors?: Partial<Record<EnergyOverlayId, string | false>>;
    class?: HTMLAttributes["class"];
  }>(),
  { lang: "en" },
);

const items = computed(() => {
  const colors = props.colors;
  if (!colors) return ENERGY_ITEMS[props.lang];
  return ENERGY_ITEMS[props.lang].map((item) => {
    const color = colors[item.id as EnergyOverlayId];
    return color === undefined ? item : { ...item, color };
  });
});

const emit = defineEmits<{
  /** The next state, on every checkbox change. */
  "update:modelValue": [value: LayerLegendValue];
}>();
</script>

<template>
  <UnmapLayerLegend
    :map-id="props.mapId"
    :class="props.class"
    :title="ENERGY_TITLE[props.lang]"
    :items="items"
    :model-value="props.modelValue"
    :default-value="props.defaultValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
