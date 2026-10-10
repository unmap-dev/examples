---
title: Travel modes
description: Driving, cycling, walking, and truck routing on the same two points.
category: routing
order: 22
---

# Travel modes

`mode` picks the costing profile. This is a bicycle route across the same two Calgary points as [Get directions](/docs/guides/examples/get-directions).

<LiveExample kind="route" from="-114.0719,51.0447" to="-113.9871,51.0899" travelMode="bicycle" center="-114.03,51.07" zoom="11" />

The five values are `auto`, `car`, `bicycle`, `pedestrian`, and `truck`. `car` is the same driving profile as `auto`; it exists because `auto` reads as "automatic" to anyone who does not know Valhalla. Anything else is a `400`.

`truck` takes an optional vehicle profile (`height`, `width`, `length`, `weight`, and the rest) that the other modes reject. Defaults, ranges, and what the data covers are on the [Routing API](/docs/apis/routing).
