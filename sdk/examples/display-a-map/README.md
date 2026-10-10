---
title: Display a map
description: Initialize a map in an HTML element with the unmap SDK.
category: maps
order: 0
---

# Display a map

Initialize a map in an HTML element. This is the whole Hello World: a key, a container, and a centre.

<LiveExample kind="map" center="-114.0719,51.0447" zoom="11" controls="" />

`center` is `[longitude, latitude]`, in that order. Leave `style`, `mode`, and `lang` off and you get `base` in light mode, with labels in the reader's language. The container needs a height; without one the map is zero pixels tall and MapLibre reports no error.

The map is a MapLibre GL map on `unmap.map`, so anything [the MapLibre API](https://maplibre.org/maplibre-gl-js/docs/API/) can do, you can do to this one. To move the camera after load, call `flyTo`:

```ts
unmap.map!.on("load", () => {
  unmap.map!.flyTo({ center: [-73.5673, 45.5017], zoom: 12 });
});
```

See the [Quickstart](/docs/start/quickstart) for install, and [Maps API](/docs/apis/maps) for every style.
