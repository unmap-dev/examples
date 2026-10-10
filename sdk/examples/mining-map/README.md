---
title: Mining map
description: Compose the mining overlay set with one profile option.
category: maps
order: 13
---

# Mining map

`profile: "mining"` is a composition preset, not a style. Prefer `muted` so customer
markers stay visually dominant.

<LiveExample kind="map" style="muted" overlays="mining.occurrences" overlayChoices="mining.occurrences,mining.prospectivity,mining.sk-potential,mining.lithium,mining.rare-earths,mining.graphite" center="-114.5,56" zoom="6" />

A key without the `mining` add-on still gets the basemap;
asking for a mining overlay explicitly is `403 addon_required`. Tenure in this preset
is `energy.mineral-tenure`.

```ts
import { Unmap } from "@unmap/sdk";

const unmap = new Unmap({
  key: "um_live_...",
  container: "map",
  style: "muted",
  profile: "mining",
  center: [-114.5, 56],
  zoom: 6,
});
```

[Mining profile](/docs/overlays/mining) and [Layers](/docs/overlays/layers) have the catalog and the
coverage caveats.
