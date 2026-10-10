---
title: Get directions
description: A driving route between two points, drawn on the map.
category: routing
order: 20
---

# Get directions

Point-to-point directions over the Canada road graph. `route()` returns the distance in metres, the duration in seconds, and a GeoJSON `LineString` you can add as a source.

<LiveExample kind="route" from="-114.0719,51.0447" to="-113.9871,51.0899" travelMode="auto" center="-114.03,51.07" zoom="11" />

Coordinates are `[lng, lat]`. There are no intermediate waypoints: a request carries exactly two points. The first and last coordinates of the geometry are snapped to the nearest routable edge, so they sit near the points you asked for rather than exactly on them.

The road network covers Canada only. A point in the United States is `422` `outside_coverage`. Iqaluit is inside Canada and is not road-connected to the mainland, so Calgary to Iqaluit is `422` `no_route`.

The [Routing API](/docs/apis/routing) documents every parameter, including the truck vehicle profile. `@unmap/routing` is the same client with no map dependency.
