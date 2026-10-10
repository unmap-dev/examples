---
title: Find nearby places
description: Category search around a point, sorted by distance.
category: geocoding
order: 13
---

# Find nearby places

Nearby search is the category lookup: the nearest pharmacies, cafés, or banks to a point. Pass a category word or id and an anchor. Results arrive sorted by distance, and each one carries `distance` in metres.

<LiveExample kind="nearby" category="pharmacy" radius="1500" limit="5" center="-114.0719,51.0447" />

`near` is `[lng, lat]`. `radius` is metres, default 5000, clamped to 50–50 000. You can pass `bbox` instead of `near`; the API then anchors at the box centre. Exactly one of the two is required.

```ts
const cafes = await unmap.geocoder.nearby("café", {
  near: [-73.5673, 45.5017],
  radius: 1000,
  limit: 5,
});
```

The [Geocoding API](/docs/apis/geocoding) lists the category vocabulary and the nearby parameters.
