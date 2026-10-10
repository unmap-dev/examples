"use client";

/**
 * <EnergyLayerControl> - toggles the energy overlay set on the shared map.
 *
 * A `<LayerLegend>` preset: one row per energy overlay, each matching every style layer the
 * gateway adds for it (`overlay_<id>_*`: the circle and label of a point overlay, the line and
 * label of a polygon one). The map must already be composed with `profile="energy"` (or an
 * explicit energy `overlays` list) so those layers exist. Hidden overlays stay hidden across a
 * style swap.
 *
 * The legend owns these layers' visibility and applies it again on every `styledata`, so drive it
 * with the checkboxes, not `setLayoutProperty`. Like any legend it owns a layer only if it is the
 * first legend to apply to it (usually the first mounted), until it unmounts; another legend then
 * takes over on its next pass. State is uncontrolled (`defaultValue`) or controlled (`value` +
 * `onValueChange`), keyed by overlay id, so another control can stay in step with it. It renders
 * a bare fieldset: wrap it in your Card or Popover when floating it over the map.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { LayerLegend, type LayerLegendItem, type LayerLegendValue } from "@/components/ui/layer-legend";

/** Same ids `?profile=energy` expands to. Keep in sync with the gateway catalog. */
export const ENERGY_OVERLAYS = [
  { id: "energy.wells", label: "Wells" },
  { id: "energy.pipelines", label: "Pipelines" },
  { id: "energy.facilities", label: "Facilities" },
  { id: "energy.fields", label: "Fields" },
  { id: "energy.petroleum-tenure", label: "Petroleum tenure" },
  { id: "energy.mineral-tenure", label: "Mineral tenure" },
  { id: "energy.ccs", label: "CCS" },
  { id: "energy.geothermal", label: "Geothermal" },
] as const;

/** An energy overlay's id, as `ENERGY_OVERLAYS` lists it. */
export type EnergyOverlayId = (typeof ENERGY_OVERLAYS)[number]["id"];

/** The overlays' names in French, by id. */
export const ENERGY_LABELS_FR: Record<EnergyOverlayId, string> = {
  "energy.wells": "Puits",
  "energy.pipelines": "Pipelines",
  "energy.facilities": "Installations",
  "energy.fields": "Gisements",
  "energy.petroleum-tenure": "Titres pétroliers",
  "energy.mineral-tenure": "Titres miniers",
  "energy.ccs": "CSC",
  "energy.geothermal": "Géothermie",
};

const ENERGY_ITEMS = {
  en: ENERGY_OVERLAYS.map(({ id, label }): LayerLegendItem => ({ id, label, layers: [`overlay_${id}_*`] })),
  fr: ENERGY_OVERLAYS.map(({ id }): LayerLegendItem => ({ id, label: ENERGY_LABELS_FR[id], layers: [`overlay_${id}_*`] })),
};
const ENERGY_TITLE = { en: "Energy layers", fr: "Couches énergétiques" };

export interface EnergyLayerControlProps {
  /** Map id when multiple maps share a page. Defaults to `"default"`. */
  mapId?: string;
  /** Controlled state, rows keyed by overlay id (`energy.wells`). Pair with `onValueChange`. */
  value?: LayerLegendValue;
  /** Starting state when uncontrolled. */
  defaultValue?: LayerLegendValue;
  /** Called with the next state on every checkbox change. */
  onValueChange?: (value: LayerLegendValue) => void;
  /** Language of the title and the rows. Defaults to "en". */
  lang?: "en" | "fr";
  /**
   * Swatch colour per overlay id: a colour, or `false` for no swatch. Pass the colours you paint
   * the overlays with, so the legend matches the map. A row left out takes its first layer's paint
   * colour, as without the prop.
   */
  colors?: Partial<Record<EnergyOverlayId, string | false>>;
  className?: string;
}

export function EnergyLayerControl({ mapId, value, defaultValue, onValueChange, lang = "en", colors, className }: EnergyLayerControlProps) {
  const items = colors
    ? ENERGY_ITEMS[lang].map((item) => {
        const color = colors[item.id as EnergyOverlayId];
        return color === undefined ? item : { ...item, color };
      })
    : ENERGY_ITEMS[lang];
  return (
    <LayerLegend
      mapId={mapId}
      className={className}
      title={ENERGY_TITLE[lang]}
      items={items}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    />
  );
}
