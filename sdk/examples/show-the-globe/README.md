---
title: Show the globe
description: The same map, drawn as a sphere.
category: maps
order: 8
---

# Show the globe

The same map, drawn as a sphere. Pass `projection: "globe"` and a low zoom.

<LiveExample kind="map" projection="globe" center="-96,56" zoom="0" />

unmap serves worldwide vector tiles within Web Mercator bounds. At globe zooms those tiles wrap around the sphere; the polar caps outside those bounds have no vector tiles. A city centre without a zoom still frames the city, not the planet.

[Maps API](/docs/apis/maps) documents every style.
