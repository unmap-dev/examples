---
title: Outdoor map
description: The outdoor style, with terrain shading where the DEM covers.
category: maps
order: 5
---

# Outdoor map

`outdoor` is the style built for trails and relief. Hillshade is drawn where the terrain tiles have data. Relief is worldwide within Web Mercator, z0–12, from global release 6, while contours remain Canadian. Check /coverage.json for the active release.

<LiveExample kind="map" style="outdoor" mode="light" center="-114.0719,51.0447" zoom="11" />

This is still a 2D map with hillshade, not a 3D terrain mesh. Contours are a separate tile source (`/contours/{version}/{z}/{x}/{y}`) that the outdoor style already requests.

[Maps API](/docs/apis/maps) documents the terrain and contour endpoints.
