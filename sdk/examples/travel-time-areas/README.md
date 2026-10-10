---
title: Travel-time areas
description: Isochrones. The area you can reach from a point inside a time budget.
category: routing
order: 23
---

# Travel-time areas

An isochrone is the area you can reach from a point within a time budget, returned as a GeoJSON `FeatureCollection` of polygons. `minutes` is required, takes up to four values, and each must be 120 or less.

<LiveExample kind="isochrone" center="-114.0719,51.0447" zoom="11" minutes="10,20" travelMode="auto" />

The live pane fills the polygons at 18% magenta. In your own map, colour the bands however you like; the response is plain GeoJSON.

```ts
const bands = await unmap.router.isochrone([-114.07, 51.05], {
  minutes: [10, 20],
  mode: "pedestrian",
});
```

By transit, pass a departure. A transit band can be a `MultiPolygon`, because a ride drops you in
areas you cannot walk between, and a centre with no scheduled transit nearby is a `RouterError`
with code `outside_coverage`:

```ts
const transitBands = await unmap.router.isochrone([-79.3806, 43.6452], {
  minutes: [30, 60],
  mode: "transit",
  departAt: "2026-10-15T08:30",
});
```

The [Routing API](/docs/apis/routing) documents the isochrone endpoint, including the contour limit.
