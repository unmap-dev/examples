---
title: Show the globe
description: Every unmap map is a globe. Zoom out to see the sphere.
category: maps
order: 8
---

# Show the globe

Every unmap map is a globe, so there is nothing to pass. Zoom out and it is a sphere; zoom in and it flattens into Mercator. For the flat map at every zoom, pass `projection: "mercator"`.

<LiveExample kind="map" center="-96,56" zoom="0" />

unmap serves worldwide vector tiles within Web Mercator bounds. At globe zooms those tiles wrap around the sphere; the polar caps outside those bounds have no vector tiles. A city centre without a zoom still frames the city, not the planet.

[Maps API](/docs/apis/maps) documents every style.
