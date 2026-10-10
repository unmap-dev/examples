---
title: Add a marker
description: Geocode a place and drop a MapLibre marker on the answer.
category: maps
order: 6
---

# Add a marker

Search for a place, then put a [MapLibre marker](https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/) on the first result. The popup is the place name.

<LiveExample kind="marker" query="Calgary Tower" center="-114.0719,51.0447" zoom="11" />

`unmap.map` is the MapLibre GL map, so the marker API is MapLibre's, not an unmap wrapper. The colour here is the brand magenta (`#FF3E9A`); use whatever colour your own data needs. Magenta is kept out of the basemap so a pin like this always wins.

The [Geocoding API](/docs/apis/geocoding) documents the result shape.

## Install a React example

For a fixed-coordinate marker and popup composed with shadcn components, add the editable registry block:

```bash
npx shadcn@latest add https://registry.unmap.dev/r/map-markers-01.json
```

```tsx
import { MapMarkers } from "@/components/unmap-map-markers"

<MapMarkers apiKey="um_live_..." />
```

The block uses Prince's Island Park as sample content. Replace its coordinates and popup text in the copied component. Allow your site's origin on your browser key. For a complete location list or guided experience, explore [map templates](/templates).
