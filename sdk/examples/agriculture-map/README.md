---
title: Agriculture map
description: Compose the agriculture overlay set with one profile option.
category: maps
order: 11
---

# Agriculture map

`profile: "agriculture"` is a composition preset, not a style. Prefer `muted` so customer
markers stay the loudest thing on the page. Buildings are hidden via the existing layer groups.

<LiveExample kind="map" style="muted" overlays="agriculture.crops" overlayChoices="agriculture.crops,agriculture.soils,agriculture.capability,agriculture.alr,agriculture.bc-capability,agriculture.soil-orders" center="-113.5,52.1" zoom="8" />

A key without the `agriculture` add-on still gets the basemap; asking for an
agriculture overlay explicitly is `403 addon_required`. Legal-land search and ParcelMap BC
PID search / identify (`survey.parcels`) are separate from this profile.

```ts
import { Unmap } from "@unmap/sdk";

const unmap = new Unmap({
  key: "um_live_...",
  container: "map",
  style: "muted",
  profile: "agriculture",
  center: [-113.5, 52.1],
  zoom: 8,
});
```

When you also pass `overlays=`, that list replaces the profile set.
[Agriculture profile](/docs/overlays/agriculture) and [Layers](/docs/overlays/layers) have the catalog and the
entitlement contract.
