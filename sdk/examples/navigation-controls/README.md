---
title: Navigation controls
description: Zoom, compass, and how to move or hide them.
category: maps
order: 7
---

# Navigation controls

Zoom in, zoom out, and a compass land at `top-right` by default. That is `controls: true`, and you do not have to pass it.

<LiveExample kind="map" center="-114.0719,51.0447" zoom="11" controls="" />

Pass an object to move them, or `false` to add none:

```ts
import { Unmap } from "@unmap/sdk";

const unmap = new Unmap({
  key: "um_live_...",
  container: "map",
  center: [-114.0719, 51.0447],
  controls: { position: "top-left" },
});
```

```ts
const unmap = new Unmap({
  key: "um_live_...",
  container: "map",
  center: [-114.0719, 51.0447],
  controls: false,
});
```

`position` is a MapLibre [control corner](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/): `top-right`, `top-left`, `bottom-right`, or `bottom-left`. Attribution stays on the map either way; it collapses to the ⓘ affordance.

The [Quickstart](/docs/start/quickstart) covers the rest of the constructor.
