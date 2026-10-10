---
title: Find the elevation of a point
description: Click to read elevation from the active DEM and understand its coverage.
category: maps
order: 24
---

# Find the elevation of a point

Click the map to read elevation in metres from the active DEM. Coverage is worldwide within
Web Mercator, and source datums and models vary. After a rollback, the Canadian MRDEM serves
again. Check
[/coverage.json](https://api.unmap.dev/coverage.json).

<LiveExample kind="elevation" center="-114.0719,51.0447" zoom="11" />

A click with no data or beyond approximately ±85.0511° returns `null`, meaning missing data.
Ocean zero may be fill rather than a measured sea level.

The [Elevation API](/docs/apis/elevation) documents the endpoint behind this example.
