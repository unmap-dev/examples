---
title: Energy map
description: Compose the energy overlay set with one profile option.
category: maps
order: 10
---

# Energy map

`profile: "energy"` is a composition preset, not a style. Prefer `muted` so customer markers
stay the loudest thing on the page. Buildings are hidden via the existing layer groups.

<LiveExample kind="map" style="muted" overlays="energy.wells" overlayChoices="energy.wells,energy.pipelines,energy.facilities,energy.fields,energy.petroleum-tenure,energy.mineral-tenure,energy.ccs,energy.geothermal" center="-114.0719,51.0447" zoom="8" />

A key without the `energy` add-on still gets the basemap; asking for an energy
overlay explicitly is `403 addon_required`. Searching a UWI is Energy 0.2.

```ts
import { Unmap } from "@unmap/sdk";

const unmap = new Unmap({
  key: "um_live_...",
  container: "map",
  style: "muted",
  profile: "energy",
  center: [-114.0719, 51.0447],
  zoom: 8,
});
```

The registry item `energy-map` is this composition as a copied component (`profile="energy"`,
muted by default). Pair it with `well-search`, `energy-popup`, and `energy-layer-control`.

When you also pass `overlays=`, that list replaces the profile set. [Energy profile](/docs/overlays/energy)
and [Layers](/docs/overlays/layers) have the catalog and the entitlement contract.
