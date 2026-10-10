"use client";

/**
 * <EnergyMap> - an unmap map already composed with `profile="energy"`.
 *
 * Thin wrapper around `<Map>`: locks the energy composition preset and defaults the
 * cartography to `muted`. Overlay tiles still come from the gateway catalog. This is not a
 * style, and it does not change search — pair it with `<WellSearch>` / `<LegalLandSearch>`.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { Map, type MapProps } from "@/components/ui/map";

export type EnergyMapProps = Omit<MapProps, "profile">;

export function EnergyMap({ style = "muted", ...props }: EnergyMapProps) {
  return <Map {...props} style={style} profile="energy" />;
}
