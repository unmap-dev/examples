---
title: Walking directions
description: A pedestrian route between two points.
category: routing
order: 21
---

# Walking directions

The same `route()` call, with `mode: "pedestrian"`. The engine uses the walking profile: sidewalks and paths where the data has them, and a walking speed for the duration.

<LiveExample kind="route" from="-114.0719,51.0447" to="-113.9871,51.0899" travelMode="pedestrian" center="-114.03,51.07" zoom="11" />

`durationSeconds` is still seconds, not minutes. A fifteen-minute walk is `900`. The geometry is the walking path, which can differ from the driving path on the same two points.

`mode` is `'auto' | 'car' | 'bicycle' | 'pedestrian' | 'truck' | 'transit'`. `car` and `auto` are the same driving profile. See [Travel modes](/docs/guides/examples/travel-modes) for the others, and the [Routing API](/docs/apis/routing) for the contract.
